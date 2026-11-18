import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { scanProject } from '../cli/scan.mjs';
import { validateCatalog, resolveSelection, isDraft } from '../dist/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));

// DesignBench previews its own components in .design-workbench/. This keeps that catalog complete and working.
test('DesignBench’s own workbench has a finished, rendering preview for every component file', async t => {
  // A plain Vite server renders the fixtures on the server; dependencies load from node_modules as usual.
  const server = await createServer({ configFile: false, root, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true } });
  t.after(() => server.close());
  const { entries, renderPreview } = await server.ssrLoadModule('/.design-workbench/catalog.ts');
  assert.deepEqual(validateCatalog(entries), []);
  assert.ok(entries.length >= 20, `expected a full catalog, found ${entries.length} entries`);
  assert.deepEqual(entries.filter(isDraft).map(entry => entry.id), [], 'no preview is left as a draft');
  for (const entry of entries) {
    assert.ok(entry.description.length > 20 && !entry.description.includes('TODO'), `${entry.id} needs a real description`);
    for (const state of entry.variants) {
      const selection = resolveSelection(entries, new URLSearchParams({ component: entry.id, state }));
      assert.equal(selection.state, state);
      const html = renderToStaticMarkup(renderPreview(selection));
      assert.ok(html.length > 40, `${entry.id} / ${state} rendered nothing`);
    }
  }
  const inventory = await scanProject(root, ['src']);
  const previewed = new Set(entries.map(entry => entry.source));
  const missing = [...new Set(inventory.components.map(component => component.file))].filter(file => !previewed.has(file));
  assert.deepEqual(missing, [], 'every component file under src/ has a preview in .design-workbench/previews/');
  await server.close();
});
