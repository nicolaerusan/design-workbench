import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readConfig } from './setup.mjs';

export async function startDev(root, { port = 7070 } = {}) {
  root = await fs.realpath(root);
  const configFile = path.join(root, '.design-workbench/config.json');
  const catalogFile = path.join(root, '.design-workbench/catalog.ts');
  const exists = file => fs.access(file).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
  const shellQuote = value => "'" + value.replaceAll("'", "'\\''") + "'";
  const cliFile = fileURLToPath(new URL('./index.mjs', import.meta.url));
  const setupCommand = await exists(path.join(root, 'node_modules/.bin/designbench'))
    ? 'npx --no-install designbench'
    : `node ${shellQuote(cliFile)} --cwd ${shellQuote(root)}`;
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
        return `${hasCatalog ? `import { entries as sourceEntries, renderPreview as renderSource } from ${JSON.stringify(catalogFile)};
import { withVariants } from ${JSON.stringify(path.join(packageRoot, 'dist/index.js'))};
const modules = import.meta.glob('/.design-workbench/ideas/*/*/index.tsx', { eager: true });
const catalog = withVariants(sourceEntries, renderSource, Object.values(modules));
export const entries = catalog.entries;
export const renderPreview = catalog.renderPreview;` : 'export const entries = []; export const renderPreview = () => null;'}
export const project = ${JSON.stringify(config.project)};
export const needsInit = ${needsInit};
export const setupCommand = ${JSON.stringify(setupCommand)};`;
      },
      configureServer(vite) {
        vite.watcher.add([path.join(root, '.design-workbench'), configFile, catalogFile]);
        const refreshSetup = file => {
          if (file !== configFile && file !== catalogFile) return;
          const module = vite.moduleGraph.getModuleById('\0virtual:design-workbench');
          if (module) vite.moduleGraph.invalidateModule(module);
          vite.ws.send({ type: 'full-reload' });
        };
        vite.watcher.on('add', refreshSetup).on('change', refreshSetup).on('unlink', refreshSetup);
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
  return server;
}
