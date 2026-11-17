import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { componentExports, scanProject } from '../cli/scan.mjs';
import { initialize, addComponents, refreshInventory } from '../cli/setup.mjs';
import { startDev } from '../cli/dev.mjs';

// Dev servers started here keep their Vite cache out of the real per-user cache directory.
process.env.XDG_CACHE_HOME = await fs.mkdtemp(path.join(os.tmpdir(), 'designbench-cache-'));
after(() => fs.rm(process.env.XDG_CACHE_HOME, { recursive: true, force: true }));

async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'design-workbench-test-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'src'));
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'test-host', dependencies: { react: '^19' } }));
  await fs.writeFile(path.join(root, 'src/Button.tsx'), "import React from 'react'; export function Button() { return <button>Hello</button>; }");
  return root;
}

test('scanner recognizes component export forms without matching types, constants, or comments', () => {
  const source = `
    // export function Ghost() {}
    export type Card = { label: string };
    export const Theme = { color: 'red' };
    export function Button() { return null; }
    const Inner = () => null;
    export { Inner as CardView };
    export default Inner;
    export const Input = React.forwardRef(() => null);
    export const Label = memo(() => null);
    export class Panel extends React.Component { render() { return null; } }
    export class PlainClass {}
    export { Other } from './other';
  `;
  assert.deepEqual(componentExports(source, 'src/UI.tsx').map(x => x.exportName), ['Button', 'CardView', 'default', 'Input', 'Label', 'Panel']);
  assert.deepEqual(componentExports('export default () => <div />', 'src/empty-state.tsx'), [{ exportName: 'default', name: 'EmptyState' }]);
});

test('discovery excludes tests, declarations, dependencies, symlinks and never runs source', async t => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root, 'src/Button.test.tsx'), 'export function Fake() {}');
  await fs.writeFile(path.join(root, 'src/Button.stories.tsx'), 'export const Default = {};');
  await fs.writeFile(path.join(root, 'src/Button.d.ts'), 'export declare function Declared(): void;');
  await fs.writeFile(path.join(root, 'src/Danger.tsx'), "throw new Error('must not execute'); export const Danger = () => null;");
  await fs.mkdir(path.join(root, 'src/node_modules'));
  await fs.writeFile(path.join(root, 'src/node_modules/Hidden.tsx'), 'export const Hidden = () => null;');
  await fs.symlink(path.join(root, 'src/Button.tsx'), path.join(root, 'src/Link.tsx'));
  const result = await scanProject(root);
  assert.deepEqual(result.components.map(x => x.exportName), ['Button', 'Danger']);
  assert.deepEqual(result.stories, ['src/Button.stories.tsx']);
  assert.equal(result.components[0].status, 'needs-review');
  await assert.rejects(scanProject(root, ['../']), /inside the project/);
});

test('init is runnable, add preserves edits, and scan refresh never overwrites authored fixtures', async t => {
  const root = await fixture(t);
  await initialize(root);
  await assert.rejects(initialize(root), { code: 'EEXIST' });
  const added = await addComponents(root, { id: 'src/Button.tsx#Button' });
  assert.equal(added[0].status, 'added');
  const target = path.join(root, added[0].file);
  assert.match(await fs.readFile(target, 'utf8'), /\.\.\/\.\.\/src\/Button\.tsx/);
  assert.match(await fs.readFile(target, 'utf8'), /"draft": true/);
  await fs.writeFile(target, '// authored fixture');
  const repeated = await addComponents(root, { all: true });
  assert.equal(repeated[0].status, 'preserved');
  await refreshInventory(root);
  assert.equal(await fs.readFile(target, 'utf8'), '// authored fixture');
  await assert.rejects(addComponents(root, { id: 'missing#Missing' }), /No matching/);
});

test('init and add reject symlinked output directories', async t => {
  const root = await fixture(t);
  await fs.mkdir(path.join(root, 'elsewhere'));
  await fs.symlink(path.join(root, 'elsewhere'), path.join(root, '.design-workbench'));
  await assert.rejects(initialize(root), { code: 'EEXIST' });
  await assert.rejects(refreshInventory(root), /real directory/);
});

test('standalone Vite serves catalog, imported component, and isolated routes without Storybook', async t => {
  const root = await fixture(t);
  await initialize(root);
  const [added] = await addComponents(root, { all: true });
  for (const name of ['.env', '.npmrc', '.netrc']) await fs.writeFile(path.join(root, name), 'sensitive-fixture');
  const server = await startDev(root, { port: 0 });
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const home = await fetch(base).then(r => r.text());
  assert.match(home, /DesignBench/);
  assert.match(home, /cli\/app\/main.js/);
  const preview = await fetch(`${base}/welcome?design=solid&state=Disabled`).then(r => r.text());
  assert.match(preview, /cli\/app\/main.js/);
  const catalog = await server.transformRequest('/.design-workbench/catalog.ts');
  assert.match(catalog.code, /welcome.tsx/);
  const component = await server.transformRequest('/' + added.file);
  assert.match(component.code, /Button.tsx/);
  assert.match(component.code, /fixtureProps/);
  for (const name of ['.env', '.npmrc', '.netrc']) {
    const blocked = await fetch(`${base}/${name}`);
    assert.notEqual(blocked.status, 200);
    assert.doesNotMatch(await blocked.text(), /sensitive-fixture/);
  }
  const crossOrigin = await fetch(base, { headers: { Origin: 'https://untrusted.example' } });
  assert.equal(crossOrigin.headers.get('access-control-allow-origin'), null);
  await server.close();
});

test('CLI reports invalid arguments and emits machine-readable scan output', async t => {
  const root = await fixture(t);
  const cli = new URL('../cli/index.mjs', import.meta.url);
  const output = execFileSync(process.execPath, [cli.pathname, 'scan', '--cwd', root], { encoding: 'utf8' });
  assert.equal(JSON.parse(output).components[0].name, 'Button');
  assert.throws(() => execFileSync(process.execPath, [cli.pathname, 'add', '--cwd', root], { stdio: 'pipe' }), error => {
    assert.match(error.stderr.toString(), /Use add/); return true;
  });
});

test('dev serves setup guidance before init and can discover setup created while running', async t => {
  const root = await fixture(t);
  const server = await startDev(root, { port: 0 });
  t.after(() => server.close());
  const initial = await server.transformRequest('virtual:design-workbench');
  assert.match(initial.code, /needsInit = true/);
  assert.match(initial.code, /setupCommand/);
  assert.match(initial.code, /entries = \[\]/);
  await initialize(root);
  // The watcher invalidates on new setup files; explicitly invalidate here to avoid timing assumptions.
  server.moduleGraph.invalidateAll();
  const configured = await server.transformRequest('virtual:design-workbench');
  assert.match(configured.code, /needsInit = false/);
  assert.match(configured.code, /catalog.ts/);
  await server.close();
});

test('fixtures load one by one: a failed import is listed with its error and the rest render', async () => {
  const { loadPreviews, PreviewLoadError, validateCatalog } = await import('../dist/index.js');
  const entry = id => ({ id, name: id, group: 'Controls', source: `src/${id}.tsx`, description: '', variants: ['Default'], width: 400 });
  const catalog = await loadPreviews({
    './previews/button.tsx': async () => ({ entry: entry('button'), render: () => 'button rendered' }),
    './previews/header-d866acee847f8d93.tsx': async () => { throw new ReferenceError('process is not defined'); },
    './previews/Empty File.tsx': async () => ({}),
    // Its file name matches a loaded fixture's ID, so the stand-in needs another one.
    './previews/card.tsx': async () => { throw new Error('boom'); },
    './previews/other.tsx': async () => ({ entry: entry('card'), render: () => 'card rendered' }),
  });
  assert.deepEqual(catalog.entries.map(item => item.id), ['empty-file', 'button', 'card-unloaded', 'header-d866acee847f8d93', 'card']);
  assert.deepEqual(validateCatalog(catalog.entries), []);
  assert.deepEqual(catalog.failures.map(item => [item.file, item.id, item.message]), [
    ['.design-workbench/previews/Empty File.tsx', 'empty-file', 'A fixture must export `entry` and `render`.'],
    ['.design-workbench/previews/card.tsx', 'card-unloaded', 'boom'],
    ['.design-workbench/previews/header-d866acee847f8d93.tsx', 'header-d866acee847f8d93', 'process is not defined'],
  ]);
  const header = catalog.entries.find(item => item.id === 'header-d866acee847f8d93');
  assert.deepEqual([header.name, header.group, header.source], ['header', 'Needs attention', '.design-workbench/previews/header-d866acee847f8d93.tsx']);
  assert.match(header.description, /could not be loaded\. process is not defined/);
  const select = component => ({ component, design: 'current', state: 'Default', viewport: 'fit' });
  assert.equal(catalog.renderPreview(select('button')), 'button rendered');
  assert.equal(catalog.renderPreview(select('card')), 'card rendered');
  assert.throws(() => catalog.renderPreview(select('header-d866acee847f8d93')), error =>
    error instanceof PreviewLoadError && error.file === '.design-workbench/previews/header-d866acee847f8d93.tsx' && error.reason === 'process is not defined');
  assert.throws(() => catalog.renderPreview(select('missing')), /Unknown component: missing/);
  assert.deepEqual((await loadPreviews({})).entries, []);
});

test('dev isolates a fixture that cannot build, explains why, and gives browser code a process.env', async t => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root, 'src/Broken.tsx'), "import React from 'react'; import { missing } from './does-not-exist'; export function Broken() { return <p>{missing}</p>; }");
  await initialize(root);
  const added = await addComponents(root, { all: true });
  const broken = added.find(item => item.id === 'src/Broken.tsx#Broken').file.split(path.sep).join('/');
  const server = await startDev(root, { port: 0 });
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const status = (query = '') => fetch(`${base}/__designbench/status${query}`).then(response => response.json());

  // Next.js client modules and others read process.env while loading. Nothing from the host environment is exposed.
  assert.match(await fetch(base).then(r => r.text()), /<script>globalThis\.process \?\?= \{ env: \{ NODE_ENV: "development" \}, browser: true \};<\/script>/);
  const catalog = await fs.readFile(path.join(root, '.design-workbench/catalog.ts'), 'utf8');
  assert.match(catalog, /await loadPreviews\(import\.meta\.glob\('\.\/previews\/\*\.tsx'\)\)/);
  assert.doesNotMatch(catalog, /eager/);
  const virtual = (await server.transformRequest('virtual:design-workbench')).code;
  assert.doesNotMatch(virtual, /eager/);
  assert.match(virtual, /PreviewLoadError/);
  assert.equal(server.config.server.hmr.overlay, false);
  assert.deepEqual(await status(), { errors: [], eagerCatalog: false });

  // Load what a browser would: the catalog, the fixture, then the component the fixture imports.
  assert.equal((await fetch(`${base}/.design-workbench/catalog.ts`)).status, 200);
  assert.equal((await fetch(`${base}/${broken}`)).status, 200);
  const before = Date.now();
  assert.equal((await fetch(`${base}/src/Broken.tsx`)).status, 500);
  const { errors } = await status(`?since=${before}`);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].file, 'src/Broken.tsx');
  assert.match(errors[0].message, /does-not-exist/);
  assert.doesNotMatch(errors[0].message, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.deepEqual(errors[0].fixtures, [broken]);
  // The same failure requested again by another preview frame is one record, not two.
  assert.equal((await fetch(`${base}/src/Broken.tsx`)).status, 500);
  assert.equal((await status()).errors.length, 1);
  assert.deepEqual((await status(`?since=${Date.now() + 60_000}`)).errors, []);
  // The working component still builds.
  assert.equal((await fetch(`${base}/src/Button.tsx`)).status, 200);

  // A catalog written by an earlier version is recognised, so the page can say how to update it.
  await fs.writeFile(path.join(root, '.design-workbench/catalog.ts'), "const modules = import.meta.glob('./previews/*.tsx', { eager: true });\nexport const entries = [];\nexport const renderPreview = () => null;\n");
  assert.equal((await status()).eagerCatalog, true);
  await server.close();
});
