import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createVariant, promoteVariant } from '../cli/variants.mjs';
import { initialize } from '../cli/setup.mjs';
import { withVariants, resolveSelection } from '../dist/index.js';

async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'designbench-variants-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'src'));
  await fs.writeFile(path.join(root, 'package.json'), '{"name":"variant-test"}');
  await fs.writeFile(path.join(root, 'src/tokens.ts'), "export const color = 'blue';");
  const original = 'import { color } from "./tokens";\nexport function Button() { return <button style={{color}}>Before</button>; }\n';
  await fs.writeFile(path.join(root, 'src/Button.tsx'), original);
  await initialize(root);
  return { root, original };
}
const options = { component: 'button', variant: 'soft', from: 'src/Button.tsx#Button', name: 'Soft' };

test('variants preserve app source, rebase imports, review then promote with a recoverable backup', async t => {
  const { root, original } = await fixture(t);
  const created = await createVariant(root, options);
  assert.equal(await fs.readFile(path.join(root, 'src/Button.tsx'), 'utf8'), original);
  const file = path.join(root, created.source);
  const copy = await fs.readFile(file, 'utf8');
  assert.match(copy, /\.\.\/\.\.\/\.\.\/\.\.\/src\/tokens/);
  await assert.rejects(createVariant(root, options), { code: 'EEXIST' });
  await fs.writeFile(file, copy.replace('Before', 'After'));
  const review = await promoteVariant(root, options);
  assert.equal(review.status, 'review');
  assert.match(review.diff, /--- a\/src\/Button.tsx/);
  assert.match(review.diff, /\+export function Button.*After/);
  assert.equal(await fs.readFile(path.join(root, 'src/Button.tsx'), 'utf8'), original);
  const applied = await promoteVariant(root, { ...options, apply: true });
  assert.equal(applied.status, 'applied');
  assert.equal(await fs.readFile(path.join(root, 'src/Button.tsx'), 'utf8'), original.replace('Before', 'After'));
  assert.equal(await fs.readFile(path.join(root, applied.backup), 'utf8'), original);
  await assert.rejects(promoteVariant(root, { ...options, apply: true }), /source changed/);
});

test('promotion rejects stale source and removed public exports without changing files', async t => {
  const { root, original } = await fixture(t);
  const created = await createVariant(root, options);
  await fs.writeFile(path.join(root, created.source), 'export function Different() { return null; }');
  await assert.rejects(promoteVariant(root, { ...options, apply: true }), /original component/);
  await fs.writeFile(path.join(root, 'src/Button.tsx'), original + '// new app edit');
  await assert.rejects(promoteVariant(root, { ...options, apply: true }), /source changed/);
  assert.equal(await fs.readFile(path.join(root, 'src/Button.tsx'), 'utf8'), original + '// new app edit');
});

test('variant creation and promotion refuse traversal, symlinks, hidden targets and unsupported imports', async t => {
  const { root } = await fixture(t);
  for (const changed of [{ variant: '../escape' }, { component: '../escape' }, { from: '../Button.tsx#Button' }, { from: 'src/../.design-workbench/previews/welcome.tsx#Button' }, { from: 'src/Button.tsx#Missing' }])
    await assert.rejects(createVariant(root, { ...options, ...changed }));
  await fs.symlink(path.join(root, 'src/Button.tsx'), path.join(root, 'src/Link.tsx'));
  await assert.rejects(createVariant(root, { ...options, from: 'src/Link.tsx#Button' }), /Symlinks/);
  const created = await createVariant(root, options);
  const originalTarget = path.join(root, 'src/Button.tsx');
  await fs.rename(originalTarget, path.join(root, 'src/Original.tsx'));
  await fs.symlink(path.join(root, 'src/Original.tsx'), originalTarget);
  await assert.rejects(promoteVariant(root, { ...options, apply: true }), /Symlinks/);
  const manifestFile = path.join(root, created.directory, 'variant.json');
  const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
  await fs.writeFile(manifestFile, JSON.stringify({ ...manifest, source: 'src/../.design-workbench/previews/welcome.tsx' }));
  await assert.rejects(promoteVariant(root, options), /Invalid variant metadata/);
  await fs.writeFile(path.join(root, 'src/Dynamic.tsx'), 'export function Dynamic() { return import(window.location.hash); }');
  await assert.rejects(createVariant(root, { ...options, variant: 'dynamic', from: 'src/Dynamic.tsx#Dynamic' }), /Dynamic module paths/);
});

test('saved variants share property presets and overrides while keeping the source renderer and catalog intact', () => {
  const entry = { id: 'button', name: 'Button', group: 'UI', source: 'Button.tsx', description: '', width: 400, variants: ['Default', 'Disabled'], propControls: { label: { type: 'text', defaultValue: 'Go' }, disabled: { type: 'boolean', defaultValue: false } }, stateProps: { Disabled: { disabled: true } } };
  const alternative = { componentId: 'button', design: { id: 'soft', name: 'Soft', source: 'soft.tsx', productionUsage: [{ file: 'fake' }] }, render: (_, props) => props };
  const catalog = withVariants([entry], () => 'source renderer', [alternative]);
  assert.equal(entry.designs, undefined);
  assert.equal(catalog.entries[0].designs.length, 2);
  assert.equal(catalog.entries[0].designs[1].productionUsage, undefined);
  const selection = resolveSelection(catalog.entries, new URLSearchParams({ component: 'button', design: 'soft', state: 'Disabled', props: '{"label":"Save"}' }));
  assert.deepEqual(catalog.renderPreview(selection), { label: 'Save', disabled: true });
  assert.equal(catalog.renderPreview({ ...selection, design: 'current' }), 'source renderer');
  assert.throws(() => withVariants([entry], () => null, [alternative, alternative]), /Duplicate design/);
  assert.throws(() => withVariants([], () => null, [alternative]), /unknown component/);
});
