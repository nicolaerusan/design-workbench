import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readConfig } from './setup.mjs';

export async function startDev(root, { port = 7070 } = {}) {
  root = await fs.realpath(root);
  const config = await readConfig(root);
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
      { find: '@design-workbench/react/styles.css', replacement: path.join(packageRoot, 'src/styles.css') },
      { find: '@design-workbench/react', replacement: path.join(packageRoot, 'dist/index.js') },
      ...reactAliases,
    ] },
    plugins: [{
      name: 'design-workbench-entry',
      resolveId(id) { if (id === 'virtual:design-workbench') return '\0virtual:design-workbench'; },
      load(id) {
        if (id === '\0virtual:design-workbench') return `export * from ${JSON.stringify(path.join(root, '.design-workbench/catalog.ts'))};\nexport const project = ${JSON.stringify(config.project)};`;
      },
      configureServer(vite) {
        // Run before Vite's fallback so all component URLs resolve to our shell.
        vite.middlewares.use(async (req, res, next) => {
          const pathname = (req.url ?? '/').split('?')[0];
          if (req.method !== 'GET' || !(pathname === '/' || /^\/[a-z0-9-]+$/.test(pathname))) return next();
          try {
            const entry = '/@fs/' + path.join(packageRoot, 'cli/app/main.js');
            const html = await vite.transformIndexHtml(req.url, `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Design Workbench</title></head><body style="margin:0"><div id="root"></div><script type="module" src=${JSON.stringify(entry)}></script></body></html>`);
            res.setHeader('Content-Type', 'text/html');
            res.end(html);
          } catch (error) { next(error); }
        });
      },
    }],
    server: { host: '127.0.0.1', port, strictPort: true, fs: { strict: true, allow: [root, packageRoot] } },
  });
  await server.listen();
  return server;
}
