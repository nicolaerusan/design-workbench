import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { componentExports, scanProject } from '../cli/scan.mjs';
import { initialize, addComponents, refreshInventory } from '../cli/setup.mjs';
import { startDev } from '../cli/dev.mjs';

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
  const server = await startDev(root, { port: 0 });
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const home = await fetch(base).then(r => r.text());
  assert.match(home, /Design Workbench/);
  assert.match(home, /cli\/app\/main.js/);
  const preview = await fetch(`${base}/welcome?design=solid&state=Disabled`).then(r => r.text());
  assert.match(preview, /cli\/app\/main.js/);
  const catalog = await server.transformRequest('/.design-workbench/catalog.ts');
  assert.match(catalog.code, /welcome.tsx/);
  const component = await server.transformRequest('/' + added.file);
  assert.match(component.code, /Button.tsx/);
  assert.match(component.code, /fixtureProps/);
  const blocked = await fetch(`${base}/.env`);
  assert.notEqual(blocked.status, 200);
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
