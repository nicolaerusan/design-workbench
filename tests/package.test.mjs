import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Workbench, validateCatalog, resolveSelection, previewUrl, patternGardenReferences } from '../dist/index.js';
const entry = {id:'button',name:'Button',group:'Controls',source:'Button.tsx',description:'A generic button',variants:['Default','Disabled'],width:400};
test('standalone package renders without a host framework',()=>{const html=renderToStaticMarkup(createElement(Workbench,{project:'Fixture',projectId:'fixture',basePath:'/design',entries:[entry]}));assert.match(html,/Fixture/);assert.doesNotMatch(html,/named components/);assert.match(html,/Button/);});
test('selection URLs preserve identity and normalize unknown states',()=>{const selected=resolveSelection([entry],new URLSearchParams('component=button&state=Disabled&viewport=375'));assert.equal(selected.state,'Disabled');assert.equal(previewUrl('/design',entry,selected),'/design/button?design=current&state=Disabled');assert.equal(resolveSelection([entry],new URLSearchParams('state=unknown')).state,'Default');assert.deepEqual(validateCatalog([entry]),[]);assert.ok(validateCatalog([entry,entry]).length);});
test('PatternGarden adapter preserves provenance and excludes unsafe URLs',()=>{const refs=patternGardenReferences({name:'Example',canonicalUrl:'https://example.com',limitations:['Public page only.'],captures:[{id:'capture-1',patternGardenUrl:'http://127.0.0.1:4317/library/capture-1/reference.md'},{id:'bad',patternGardenUrl:'javascript:alert(1)'}]});assert.equal(refs.length,2);assert.match(refs[1].notes,/Public page only/);assert.match(refs[1].title,/capture-1/);});

test('properties apply defaults, state presets, and only validated shared overrides', async () => {
  const { resolvePreviewProps } = await import('../dist/index.js');
  const controlled = { ...entry, propControls: {
    label: { type: 'text', defaultValue: 'Continue' },
    disabled: { type: 'boolean', defaultValue: false },
    size: { type: 'select', defaultValue: 'Small', options: ['Small', 'Large'] },
    radius: { type: 'number', defaultValue: 8, min: 0, max: 32 },
  }, stateProps: { Disabled: { disabled: true } } };
  const selected = resolveSelection([controlled], new URLSearchParams({ state: 'Disabled', props: JSON.stringify({ label: 'Save & close', disabled: false, size: 'Bogus', radius: 100, injected: 'bad' }) }));
  assert.deepEqual(resolvePreviewProps(controlled, selected), { label: 'Save & close', disabled: false, size: 'Small', radius: 8 });
  const query = new URL(previewUrl('/design', controlled, selected), 'http://localhost').searchParams;
  assert.deepEqual(resolvePreviewProps(controlled, resolveSelection([controlled], query)), resolvePreviewProps(controlled, selected));
  assert.deepEqual(resolvePreviewProps(controlled, resolveSelection([controlled], new URLSearchParams('state=Disabled&props=invalid'))), { label: 'Continue', disabled: true, size: 'Small', radius: 8 });
  assert.deepEqual(validateCatalog([controlled]), []);
  assert.match(validateCatalog([{ ...controlled, stateProps: { Missing: { radius: -1 } } }]).join(' '), /Unknown property preset state.*Invalid preset property/);
  assert.equal(resolveSelection([entry], new URLSearchParams({ props: '{"label":"ignored"}' })).props, undefined);
});

test('empty catalog explains setup and the preview controls explain their meaning', () => {
  const empty = renderToStaticMarkup(createElement(Workbench, { project:'Fixture', projectId:'fixture', basePath:'/design', entries:[] }));
  assert.match(empty, /Bring your first component/);
  assert.match(empty, /designbench add --all/);
  const html = renderToStaticMarkup(createElement(Workbench, { project:'Fixture', projectId:'fixture', basePath:'/design', entries:[entry], initialSelection:{ component:'button', design:'current', state:'Default', viewport:'fit' } }));
  assert.match(html, /Share/);
  assert.doesNotMatch(html, /Copy link|Link copied/);
  assert.doesNotMatch(html, /How to use this preview/);
  assert.match(html, /State preset/);
  assert.match(html, /Resize inspector panel/);
  assert.match(html, /aria-label="Inspector layout"/);
  assert.match(html, /role="tab"[^>]*>Feedback</);
  assert.match(html, /role="tab"[^>]*>Variants</);
  assert.match(html, /target="_blank"/);
});

test('empty and uninitialized workbenches retain project navigation and setup commands', () => {
  const props = { project:'My project', projectId:'fixture', basePath:'/design', entries:[], setupCommand:'node ./tools/bench.mjs' };
  const empty = renderToStaticMarkup(createElement(Workbench, props));
  assert.match(empty, /My project/);
  assert.match(empty, /aria-label="Components"/);
  assert.match(empty, /view=setup/);
  assert.match(empty, /aria-current="page"/);
  assert.match(empty, /node .\/tools\/bench.mjs add --all/);
  assert.doesNotMatch(empty, /named components|Coverage &amp; gaps/);
  const uninitialized = renderToStaticMarkup(createElement(Workbench, { ...props, needsInit:true }));
  assert.match(uninitialized, /Set up your workbench/);
  assert.match(uninitialized, /node .\/tools\/bench.mjs init/);
});

test('page navigation distinguishes overview, component links, and setup with retained selection', async () => {
  const { resolveWorkbenchPage } = await import('../dist/navigation.js');
  const page = (query, entries = [entry], needsInit = false) => resolveWorkbenchPage(entries, new URLSearchParams(query), needsInit);
  assert.equal(page(''), 'overview');
  assert.equal(page('component=button&state=Disabled'), 'components');
  assert.equal(page('component=button&view=setup'), 'setup');
  assert.equal(page('component=button&view=components'), 'overview');
  assert.equal(page('component=missing'), 'overview');
  assert.equal(page('', []), 'setup');
  assert.equal(page('component=button', [entry], true), 'setup');
  const html = renderToStaticMarkup(createElement(Workbench, { project:'Fixture', projectId:'fixture', basePath:'/design', entries:[entry] }));
  assert.match(html, /aria-label="Component overview"/);
  assert.match(html, /aria-label="Breadcrumb"/);
  assert.match(html, /href="\/design\?component=button"/);
  assert.doesNotMatch(html, /Resize inspector panel/);
});

test('bundled fonts referenced by the stylesheet ship with the package', async () => {
  const { readFile, access } = await import('node:fs/promises');
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  const fonts = [...css.matchAll(/url\('(\.\/fonts\/[^']+)'\)/g)].map(match => match[1]);
  assert.ok(fonts.length >= 2);
  for (const font of fonts) await access(new URL(`../src/${font.slice(2)}`, import.meta.url));
  await access(new URL('../src/fonts/OFL.txt', import.meta.url));
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(manifest.files.includes('src'));
});

test('the Code tab lists the files behind the source component and each saved variant', async () => {
  const { designFiles } = await import('../dist/index.js');
  const fixtureEntry = { ...entry, fixture: '.design-workbench/previews/button.tsx' };
  const source = { id: 'current', name: 'Source component', source: 'Button.tsx' };
  const ink = { id: 'ink', name: 'Ink', kind: 'exploration', source: '.design-workbench/ideas/button/ink/component.tsx' };
  assert.deepEqual(designFiles(fixtureEntry, source).map(file => file.path), ['Button.tsx', '.design-workbench/previews/button.tsx']);
  assert.deepEqual(designFiles(fixtureEntry, ink).map(file => file.path), ['component.tsx', 'index.tsx', 'variant.json'].map(name => `.design-workbench/ideas/button/ink/${name}`));
  assert.deepEqual(designFiles(fixtureEntry, { ...ink, files: [{ path: 'custom.tsx', label: 'Custom' }] }).map(file => file.path), ['custom.tsx']);
  const html = renderToStaticMarkup(createElement(Workbench, { project:'Fixture', projectId:'fixture', basePath:'/design', entries:[{ ...fixtureEntry, designs:[source, ink] }], initialSelection:{ component:'button', design:'ink', state:'Default', viewport:'fit' } }));
  assert.match(html, /role="tab"[^>]*>Code</);
  assert.match(html, /\.design-workbench\/ideas\/button\/ink\/variant\.json/);
  assert.match(html, /aria-label="View options\. Viewport: Fit panel"/);
});
