import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readConfig } from './setup.mjs';
import { promoteVariant } from './variants.mjs';
import { createBridge } from './bridge.mjs';
import { projectCommand, writeRuntime, removeRuntime } from './runtime.mjs';

export async function startDev(root, { port = 7070 } = {}) {
  root = await fs.realpath(root);
  const configFile = path.join(root, '.design-workbench/config.json');
  const catalogFile = path.join(root, '.design-workbench/catalog.ts');
  const inventoryFile = path.join(root, '.design-workbench/inventory.json');
  const exists = file => fs.access(file).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
  const setupCommand = await projectCommand(root);
  const packageRoot = fileURLToPath(new URL('../', import.meta.url));
  const hostRequire = createRequire(path.join(root, 'package.json'));
  const ownRequire = createRequire(import.meta.url);
  // Every frame must use one React instance, preferably the host application's.
  const reactAliases = ['react', 'react-dom'].map(name => {
    let manifest;
    try { manifest = hostRequire.resolve(`${name}/package.json`); }
    catch { manifest = ownRequire.resolve(`${name}/package.json`); }
    return { find: name, replacement: path.dirname(manifest) };
  });
  const { createServer } = await import('vite');
  // What the workbench page is showing, for `designbench mcp`. Assigned once the server exists.
  let bridge;
  const server = await createServer({
    configFile: false,
    root,
    publicDir: false,
    cacheDir: path.join(os.tmpdir(), 'design-workbench-vite', createHash('sha256').update(packageRoot + root).digest('hex').slice(0, 16)),
    resolve: { tsconfigPaths: true, alias: [
      { find: 'designbench/styles.css', replacement: path.join(packageRoot, 'src/styles.css') },
      { find: 'designbench', replacement: path.join(packageRoot, 'dist/index.js') },
      ...reactAliases,
    ] },
    plugins: [{
      name: 'design-workbench-entry',
      resolveId(id) { if (id === 'virtual:design-workbench') return '\0virtual:design-workbench'; },
      async load(id) {
        if (id !== '\0virtual:design-workbench') return;
        const hasConfig = await exists(configFile);
        const config = hasConfig ? await readConfig(root) : { project: path.basename(root) };
        const needsInit = !hasConfig;
        const hasCatalog = hasConfig && await exists(catalogFile);
        if (hasConfig && !hasCatalog) throw new Error('Missing .design-workbench/catalog.ts. Restore the catalog file from your project before loading previews.');
        // Component files found by the last scan, so the workbench can show which still lack a preview.
        let discovered = [];
        try { discovered = [...new Set(JSON.parse(await fs.readFile(inventoryFile, 'utf8')).components.map(component => component.file))].filter(file => typeof file === 'string').sort(); } catch {}
        return `${hasCatalog ? `import { entries as sourceEntries, renderPreview as renderSource } from ${JSON.stringify(catalogFile)};
import { withVariants } from ${JSON.stringify(path.join(packageRoot, 'dist/index.js'))};
const modules = import.meta.glob('/.design-workbench/ideas/*/*/index.tsx', { eager: true });
const catalog = withVariants(sourceEntries, renderSource, Object.values(modules));
// Generated fixtures are named after their entry; listing them does not import anything.
const fixtureFiles = new Set(Object.keys(import.meta.glob('/.design-workbench/previews/*.tsx')).map(file => file.slice(1)));
export const entries = catalog.entries.map(entry => {
  const fixture = '.design-workbench/previews/' + entry.id + '.tsx';
  return !entry.fixture && fixtureFiles.has(fixture) ? { ...entry, fixture } : entry;
});
export const renderPreview = catalog.renderPreview;` : 'export const entries = []; export const renderPreview = () => null;'}
export const project = ${JSON.stringify(config.project)};
export const needsInit = ${needsInit};
export const setupCommand = ${JSON.stringify(setupCommand)};
export const projectRoot = ${JSON.stringify(root)};
export const discovered = ${JSON.stringify(discovered)};`;
      },
      configureServer(vite) {
        vite.watcher.add([path.join(root, '.design-workbench'), configFile, catalogFile]);
        const refreshSetup = file => {
          if (file !== configFile && file !== catalogFile && file !== inventoryFile) return;
          const module = vite.moduleGraph.getModuleById('\0virtual:design-workbench');
          if (module) vite.moduleGraph.invalidateModule(module);
          vite.ws.send({ type: 'full-reload' });
        };
        vite.watcher.on('add', refreshSetup).on('change', refreshSetup).on('unlink', refreshSetup);
        for (const event of ['add', 'change', 'unlink']) vite.watcher.on(event, () => bridge.fileChanged());
        bridge = createBridge({ root, send: (event, data) => vite.ws.send({ type: 'custom', event, data }) });
        vite.middlewares.use(async (req, res, next) => {
          const route = (req.url ?? '').split('?')[0];
          if (!route.startsWith('/__designbench/')) return next();
          const reply = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };
          const host = req.headers.host ?? '';
          // A local Host rules out DNS rebinding for every route.
          const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
          // The workbench page: a matching Origin, and a custom header that cross-site pages cannot send
          // without a CORS preflight this server never grants.
          const fromPage = local && req.headers.origin === `http://${host}` && req.headers['x-designbench'] === '1' && /^application\/json\b/.test(req.headers['content-type'] ?? '');
          const json = async limit => {
            let body = '';
            for await (const chunk of req) { body += chunk; if (body.length > limit) throw Object.assign(new Error('Request too large.'), { status: 413 }); }
            return body ? JSON.parse(body) : {};
          };
          try {
            // The Variants tab's "Use … in my app" button. It writes application source, so only the page may call it.
            if (route === '/__designbench/promote') {
              if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });
              if (!fromPage) return reply(403, { error: 'Switching variants is only available from the DesignBench page.' });
              try {
                const { component, variant } = await json(4096);
                const { status, target, backup } = await promoteVariant(root, { component, variant, apply: true });
                return reply(200, { status, target, backup });
              } catch (error) {
                if (error?.status) throw error;
                return reply(409, { error: error?.code === 'SOURCE_CHANGED'
                  ? `${error.target} has changed since this variant was made, so it was not replaced. Ask your agent to bring the variant up to date with the current source, then try again.`
                  : error?.code === 'EEXIST'
                    ? 'A backup from an earlier switch is already saved beside this variant. Move or delete before-promotion.* in the variant folder, then try again.'
                    : error?.message ?? 'The variant could not be applied.' });
              }
            }
            if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });
            // The page reports which component, variant and state it is showing.
            if (route === '/__designbench/view') {
              if (!fromPage) return reply(403, { error: 'Only the DesignBench page reports its view.' });
              return reply(200, bridge.report(await json(4_000_000)));
            }
            // `designbench mcp` reads that view and can ask the page to open another. It proves itself with the token
            // from this server's runtime file, which only this user can read.
            if (route === '/__designbench/agent/state' || route === '/__designbench/agent/open') {
              if (!local || !bridge.authorized(req)) return reply(403, { error: 'Only designbench mcp, started by the same user, may call this.' });
              bridge.contact(req);
              if (route.endsWith('/state')) return reply(200, await bridge.state());
              return reply(200, await bridge.open(await json(4096)));
            }
            return reply(404, { error: 'Unknown DesignBench route.' });
          } catch (error) {
            reply(error?.status ?? (error?.code === 'BAD_TARGET' || error instanceof SyntaxError ? 400 : 500), { error: error?.message ?? 'Request failed.' });
          }
        });
        // Run before Vite's fallback so all component URLs resolve to our shell.
        vite.middlewares.use(async (req, res, next) => {
          const pathname = (req.url ?? '/').split('?')[0];
          if (req.method !== 'GET' || !(pathname === '/' || /^\/[a-z0-9-]+$/.test(pathname))) return next();
          try {
            const entry = '/@fs/' + path.join(packageRoot, 'cli/app/main.js');
            const html = await vite.transformIndexHtml(req.url, `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DesignBench</title><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect width='48' height='48' rx='10' fill='%23242523'/%3E%3Cpath d='M8 14h32M16 14 10 36M32 14l6 22M13 28h23' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"></head><body style="margin:0"><div id="root"></div><script type="module" src=${JSON.stringify(entry)}></script></body></html>`);
            res.setHeader('Content-Type', 'text/html');
            res.end(html);
          } catch (error) { next(error); }
        });
      },
    }],
    server: { host: '127.0.0.1', port, strictPort: true, cors: false, fs: { strict: true, allow: [root, packageRoot], deny: ['.env', '.env.*', '*.pem', '*.crt', '**/.git/**', '**/.npmrc', '**/.netrc', '**/.ssh/**'] } },
  });
  await server.listen();
  const address = server.httpServer.address();
  const url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : port}`;
  bridge.setOrigin(url);
  // Lets `designbench mcp` find this server. The workbench still runs if the record cannot be written.
  await writeRuntime(root, { url, token: bridge.token, pid: process.pid }).catch(error => console.warn(`DesignBench: agents cannot connect over MCP (${error.message}).`));
  const close = server.close.bind(server);
  server.close = async () => { await removeRuntime(root, bridge.token).catch(() => {}); return close(); };
  return server;
}
