import fs from 'node:fs/promises';
import path from 'node:path';
import { scanProject } from './scan.mjs';

export const setupDir = '.design-workbench';
export async function readConfig(root) {
  const config = JSON.parse(await fs.readFile(path.join(root, setupDir, 'config.json'), 'utf8'));
  if (config.schemaVersion !== 1 || typeof config.project !== 'string' || !Array.isArray(config.sources) || config.sources.some(item => typeof item !== 'string'))
    throw new Error('Invalid .design-workbench/config.json. Expected schemaVersion 1, project, and sources.');
  return config;
}

export async function initialize(root, { sources } = {}) {
  const inventory = await scanProject(root, sources);
  const config = { schemaVersion: 1, project: inventory.project, sources: inventory.sources };
  const dir = path.join(root, setupDir);
  // Exclusive creation prevents replacing an existing setup or following a symlink.
  await fs.mkdir(dir);
  await fs.mkdir(path.join(dir, 'previews'));
  await fs.writeFile(path.join(dir, 'config.json'), JSON.stringify(config, null, 2) + '\n', { flag: 'wx' });
  await fs.writeFile(path.join(dir, 'inventory.json'), JSON.stringify(inventory, null, 2) + '\n', { flag: 'wx' });
  await fs.writeFile(path.join(dir, 'catalog.ts'), `/// <reference types="vite/client" />
// This file belongs to your project. Customize it for providers or shared styles.
// Import your global CSS here if required by your components.
const modules = import.meta.glob('./previews/*.tsx', { eager: true });
export const previews = Object.values(modules) as Array<{
  entry: import('designbench').WorkbenchEntry;
  render: (selection: import('designbench').Selection) => import('react').ReactNode;
}>;
export const entries = previews.map(preview => preview.entry);
export function renderPreview(selection: import('designbench').Selection) {
  const preview = previews.find(preview => preview.entry.id === selection.component);
  if (!preview) throw new Error('Unknown component: ' + selection.component);
  return preview.render(selection);
}
`, { flag: 'wx' });
  await fs.writeFile(path.join(dir, 'previews/welcome.tsx'), `import React from 'react';
import { resolvePreviewProps, type WorkbenchEntry, type Selection } from 'designbench';
export const entry: WorkbenchEntry = {
  id: 'welcome', name: 'Welcome button', group: 'Getting started',
  source: '.design-workbench/previews/welcome.tsx',
  description: 'A working fixture. Add your own components with designbench add.',
  width: 400, variants: ['Default', 'Disabled'],
  propControls: {
    label: { type: 'text', label: 'Label', defaultValue: 'Your next design', description: 'Text shown on the button.' },
    disabled: { type: 'boolean', label: 'Disabled', defaultValue: false, description: 'Prevent clicks.' },
    size: { type: 'select', label: 'Size', defaultValue: 'Medium', options: ['Small', 'Medium', 'Large'] },
    radius: { type: 'number', label: 'Corner radius', defaultValue: 10, min: 0, max: 32 },
  },
  stateProps: { Disabled: { disabled: true } },
  designs: [
    { id: 'solid', name: 'Solid', kind: 'exploration', source: '.design-workbench/previews/welcome.tsx' },
    { id: 'outline', name: 'Outline', kind: 'exploration', source: '.design-workbench/previews/welcome.tsx' },
  ],
};
export function render(selection: Selection) {
  const props = resolvePreviewProps(entry, selection);
  const solid = selection.design === 'solid';
  return <div style={{ padding: 32, fontFamily: 'system-ui' }}>
    <button disabled={props.disabled === true} style={{
      padding: props.size === 'Small' ? '8px 12px' : props.size === 'Large' ? '16px 28px' : '12px 20px', borderRadius: Number(props.radius), border: '1px solid #18181b',
      background: solid ? '#18181b' : 'white', color: solid ? 'white' : '#18181b',
      opacity: props.disabled ? 0.4 : 1,
    }}>{props.label}</button>
  </div>;
}
`, { flag: 'wx' });
  await fs.writeFile(path.join(dir, 'AGENT.md'), `# Set up and iterate on this project's components

Read config.json, inventory.json, catalog.ts, and previews/ in this directory. Follow the user's request and the repository's existing instructions.

## First setup

1. Review the discovered candidates against their source. The inventory is a heuristic, not verified preview coverage.
2. Use designbench add 'path/to/File.tsx#ExportName' for selected components, or designbench add --all for all discovered candidates. Existing fixture files are preserved.
3. Edit the generated fixtureProps and render functions. Supply realistic synthetic data, useful states, providers, and callbacks. Empty props are a starting point, not a guarantee of a valid render.
4. Import required shared CSS in catalog.ts. The standalone Vite runner supports client-renderable React code. For framework-specific server components, use a client fixture or mount Workbench in the host app as documented in the package README.
5. Mock network, authentication, and server dependencies. Do not call real write APIs from fixtures.
6. Run designbench dev and verify actual previews. Fix failures before claiming a component is covered.
7. Rerun designbench scan --write after source changes. Keep decisions in fixture files; inventory.json is generated.

## Design iteration

Declare entry.propControls for editable text, boolean, select, and number values. Use entry.stateProps for named presets and resolvePreviewProps(entry, selection) in render to apply preset values and URL overrides.

Keep earlier implementations while exploring named alternatives. Use entry.designs for visual directions and entry.variants for fixture states. In render(selection), choose the implementation and props using selection.design and selection.state. Record references alongside each design, compare panels, and inspect parent compositions using entry.contexts. Verify production usage against actual render sites before adding productionUsage.

## Saved variants and promotion

In standalone mode, create a variant with:

    npx designbench variant create <catalog-component-id> <variant-id> --from 'src/components/Button.tsx#Button' --name 'Soft button'

Use the entry.id from the preview catalog, not the scanner's file#export ID. IDs are lowercase words separated by hyphens. Inspect the actual export before running the command. The command copies the complete source file and rebases relative imports; it does not modify application source. Unsupported dynamic imports and import.meta require manual setup.

Edit .design-workbench/ideas/<component-id>/<variant-id>/component.tsx (or its original extension). The adjacent index.tsx provides the preview renderer; supply required fixture data, providers, styles, and callbacks there. Public props and state presets are forwarded automatically. The CLI discovers these index.tsx files, and variants appear without manual catalog registration. Commit the entire variant directory including variant.json. Treat metadata as project-owned code, not an untrusted upload format.

Verify each variant in the browser, switch states and properties, and compare at matching viewports. Use synthetic data and mock side effects. Annotation tools belong to the user's coding environment; use their feedback to edit variants. No model API key is required by DesignBench.

When the user chooses a direction, run:

    npx designbench variant promote <component-id> <variant-id>

This prints a source replacement diff without writing. Review the whole file, check public exports and behavior, and run the host's tests. Only after the user requests adoption, rerun with --apply. Promotion replaces that single original source file, rebases imports, and saves before-promotion.* beside the variant. It rejects changed source and symlinks. New dependencies, additional files, parent composition wiring, and fixture data are not promoted automatically. Use Git to review or revert. Older variants must be reconciled manually after source changes; do not bypass the base hash. Selecting a variant never promotes it.

For an embedded host, use entry.designs and its render function, or merge saved modules with withVariants(entries, renderSource, modules) before passing them to both routes. Standalone CLI auto-discovery does not run in embedded hosts.

Pattern Garden reference metadata can use patternGardenReferences. Direct universal-library search, site indexing, autonomous code generation, and shared feedback storage are future integrations. This setup is local and requires no model API key or Storybook.
`, { flag: 'wx' });
  return inventory;
}

async function writableDirectory(root, relative) {
  const directory = path.join(root, relative);
  const info = await fs.lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Expected a real directory: ${relative}`);
  const realRoot = await fs.realpath(root);
  const real = await fs.realpath(directory);
  const difference = path.relative(realRoot, real);
  if (difference.startsWith('..' + path.sep) || path.isAbsolute(difference)) throw new Error('Setup directory resolves outside the project.');
  return directory;
}

export async function refreshInventory(root) {
  const dir = await writableDirectory(root, setupDir);
  const config = await readConfig(root);
  const inventory = await scanProject(root, config.sources);
  const target = path.join(dir, 'inventory.json');
  const temporary = path.join(dir, `.inventory-${process.pid}-${Date.now()}.json`);
  try {
    await fs.writeFile(temporary, JSON.stringify(inventory, null, 2) + '\n', { flag: 'wx' });
    await fs.rename(temporary, target);
  } finally { await fs.rm(temporary, { force: true }); }
  return inventory;
}

export async function addComponents(root, { id, all = false }) {
  await writableDirectory(root, setupDir);
  const dir = await writableDirectory(root, path.join(setupDir, 'previews'));
  const config = await readConfig(root);
  const inventory = await scanProject(root, config.sources);
  const components = inventory.components.filter(component => all || component.id === id);
  if (!components.length) throw new Error('No matching component candidates. Run scan and use an exact component id.');
  const results = [];
  for (const component of components) {
    // Stable identity is based on source + export, independent of scan order.
    const { createHash } = await import('node:crypto');
    const key = `${component.name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}-${createHash('sha256').update(component.id).digest('hex').slice(0, 16)}`;
    const target = path.join(dir, `${key}.tsx`);
    let importPath = path.relative(dir, path.join(root, component.file)).split(path.sep).join('/');
    if (!importPath.startsWith('.')) importPath = './' + importPath;
    const source = `import React from 'react';
import * as Source from ${JSON.stringify(importPath)};
import type { WorkbenchEntry, Selection } from 'designbench';

// Review required props, providers, and side effects before using this fixture.
const Component = Source[${JSON.stringify(component.exportName)}] as React.ComponentType<any>;
const fixtureProps: Record<string, unknown> = {}; // TODO: supply representative props.
export const entry: WorkbenchEntry = ${JSON.stringify({
      id: key, name: component.name, group: 'Discovered components', source: component.file,
      description: 'Draft fixture: review props, providers, and states.', width: 640, variants: ['Default'],
    }, null, 2)};
export function render(_selection: Selection) {
  return <Component {...fixtureProps} />;
}
`;
    try { await fs.writeFile(target, source, { flag: 'wx' }); results.push({ id: component.id, file: path.relative(root, target), status: 'added' }); }
    catch (error) { if (error.code === 'EEXIST') results.push({ id: component.id, file: path.relative(root, target), status: 'preserved' }); else throw error; }
  }
  return results;
}
