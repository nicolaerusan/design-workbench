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
  assert.doesNotMatch(html, /role="tab"[^>]*>Feedback</);
  assert.doesNotMatch(html, /Local preview · source edits refresh live/);
  assert.match(html, />Settings</);
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
  // A variant copied from a .jsx, .js, or .ts component keeps that extension; its fixture and info file are still listed.
  for (const extension of ['jsx', 'js', 'ts'])
    assert.deepEqual(designFiles(fixtureEntry, { ...ink, source: `.design-workbench/ideas/button/ink/component.${extension}` }).map(file => file.path), [`component.${extension}`, 'index.tsx', 'variant.json'].map(name => `.design-workbench/ideas/button/ink/${name}`));
  assert.deepEqual(designFiles(fixtureEntry, { ...ink, source: '.design-workbench/ideas/button/ink/component.css' }).map(file => file.path), ['.design-workbench/ideas/button/ink/component.css']);
  assert.deepEqual(designFiles(fixtureEntry, { ...ink, files: [{ path: 'custom.tsx', label: 'Custom' }] }).map(file => file.path), ['custom.tsx']);
  assert.deepEqual(designFiles({ ...entry, source: 'welcome.tsx', fixture: 'welcome.tsx' }, { id: 'solid', name: 'Solid', source: 'welcome.tsx' }).map(file => file.path), ['welcome.tsx']);
  const html = renderToStaticMarkup(createElement(Workbench, { project:'Fixture', projectId:'fixture', basePath:'/design', entries:[{ ...fixtureEntry, designs:[source, ink] }], initialSelection:{ component:'button', design:'ink', state:'Default', viewport:'fit' } }));
  assert.match(html, /role="tab"[^>]*>Code</);
  assert.match(html, /\.design-workbench\/ideas\/button\/ink\/variant\.json/);
  assert.match(html, /aria-label="View options\. Viewport: Fit panel"/);
  assert.match(html, /aria-label="Variant: Ink"/);
  assert.match(html, /Use Ink in your app/);
  assert.doesNotMatch(html, /Read \.design-workbench\/AGENT\.md/);
  // Files show their type; .tsx files get the React mark and JSON gets braces.
  assert.match(html, /dw-file-icon-react/);
  assert.match(html, /dw-file-icon-json/);
  // The source is its own button, separate from the variant menu.
  assert.match(html, /<button[^>]*class="dw-design-choice dw-design-source"[^>]*aria-pressed="false"[^>]*>.*?Source component<\/button>/);
  // Without dev-server actions the tab shows the terminal command; with them, one button.
  assert.match(html, /variant promote button ink/);
  const withActions = renderToStaticMarkup(createElement(Workbench, { project:'Fixture', projectId:'fixture', basePath:'/design', entries:[{ ...fixtureEntry, designs:[source, ink] }], initialSelection:{ component:'button', design:'ink', state:'Default', viewport:'fit' }, variantActions:{ promote: async () => ({ status:'applied', target:'Button.tsx' }) } }));
  assert.match(withActions, />Use Ink in my app</);
  assert.doesNotMatch(withActions, /variant promote button ink/);
});

test('the grid view lays every variant against every state and asks an agent for more', async () => {
  const { VariantGrid } = await import('../dist/variant-grid.js');
  const { variantsPrompt } = await import('../dist/index.js');
  const source = { id: 'current', name: 'Source component', source: 'Button.tsx' };
  const ink = { id: 'ink', name: 'Ink', kind: 'exploration', source: '.design-workbench/ideas/button/ink/component.tsx' };
  const soft = { id: 'soft', name: 'Soft', kind: 'exploration', source: '.design-workbench/ideas/button/soft/component.tsx' };
  const states = ['Default', 'Loading', 'Disabled'];
  // The app's component is listed after a variant here; the grid still puts it first.
  const button = { ...entry, variants: states, designs: [ink, source, soft] };
  const html = renderToStaticMarkup(createElement(VariantGrid, {
    entry: button, designs: button.designs, active: ink, state: 'Loading', command: 'npx designbench', onOpen() {},
    cellUrl: (design, state) => `/design/button?design=${design}&state=${state}`,
    cellHref: (design, state) => `/design?component=button&design=${design}&state=${state}`,
  }));
  // Columns are the states.
  assert.deepEqual([...html.matchAll(/<th scope="col" class="dw-grid-state">([^<]+)<\/th>/g)].map(match => match[1]), states);
  // Rows are the variants, each named and tagged.
  assert.deepEqual([...html.matchAll(/<span class="dw-grid-name">([^<]+)<\/span><span class="dw-grid-tag">([^<]+)<\/span>/g)].map(match => `${match[1]}: ${match[2]}`),
    ['Source component: Source', 'Ink: Variant', 'Soft: Variant']);
  // One cell for each variant at each state. Each is a link to that view, so it also opens in a new tab.
  const cells = [...html.matchAll(/<a class="dw-grid-cell" data-cell="([^"]+)" href="([^"]+)" aria-label="([^"]+)"/g)].map(match => match.slice(1));
  assert.deepEqual(cells.map(cell => cell[0]), ['current', 'ink', 'soft'].flatMap(design => states.map(state => `${design}/${state}`)));
  assert.deepEqual(cells[5], ['ink/Disabled', '/design?component=button&amp;design=ink&amp;state=Disabled', 'Open Ink, Disabled']);
  // Only the selected variant and state is marked.
  assert.deepEqual([...html.matchAll(/data-cell="([^"]+)"[^>]*aria-current="true"/g)].map(match => match[1]), ['ink/Loading']);
  // Previews start only once their cell nears the visible canvas, so the server sends none.
  assert.doesNotMatch(html, /<iframe/);
  // The last row copies a prompt: the agent makes variants, the workbench only asks.
  assert.match(html, /<tfoot>.*New variants.*<td colSpan="3">.*Your coding agent makes variants\..*>Copy prompt<\/button>.*<\/tfoot>/);
  assert.match(variantsPrompt('npx designbench', { component: button.name }), /^Create 3 visual variants of the Button component\./);

  // The toggle is offered when there is something to lay out: more than one state, or more than one variant.
  const page = entries => renderToStaticMarkup(createElement(Workbench, { project:'Fixture', projectId:'fixture', basePath:'/design', entries, initialSelection:{ component:'button', design:'current', state:'Default', viewport:'fit' } }));
  const toggle = /<button[^>]*class="dw-design-choice dw-grid-toggle"[^>]*aria-pressed="false"[^>]*>.*?Grid<\/button>/;
  assert.match(page([entry]), toggle, 'two states, one variant');
  assert.match(page([{ ...entry, variants: ['Default'], designs: [source, ink] }]), toggle, 'one state, two variants');
  assert.doesNotMatch(page([{ ...entry, variants: ['Default'] }]), /dw-grid-toggle/, 'one state, one variant');
  // Until it is pressed the page shows one preview, and "Compare all side by side" stays in the variant menu's place.
  assert.doesNotMatch(page([{ ...entry, designs: [source, ink] }]), /dw-grid-canvas/);
});

test('Settings hands the work to a coding agent: agent choice, populate prompt, coverage, and drafts', async () => {
  const { populatePrompt, refreshPrompt, memoryLine, agents, isDraft } = await import('../dist/index.js');
  assert.deepEqual(agents.map(agent => agent.label), ['Claude', 'ChatGPT', 'Cursor', 'Other agents']);
  assert.match(populatePrompt('npx designbench'), /npx designbench scan --write[\s\S]*npx designbench add --all[\s\S]*Do not change application source files/);
  assert.doesNotMatch(populatePrompt('npx designbench'), /designbench init/);
  assert.match(populatePrompt('npx designbench', true), /Run `npx designbench init`/);
  assert.match(refreshPrompt('node cli.mjs'), /node cli\.mjs scan --write/);
  // A long command is stated once instead of being repeated in every step.
  const long = "node '/Users/someone/Projects/app/.worktrees/feature/cli/index.mjs' --cwd '/Users/someone/Projects/app'";
  assert.equal(populatePrompt(long).split(long).length - 1, 1);
  assert.match(populatePrompt(long), /written as `designbench` below[\s\S]*Run `designbench scan --write`/);
  assert.equal(refreshPrompt(long).split(long).length - 1, 1);
  assert.match(memoryLine('npx designbench'), /\.design-workbench\/AGENT\.md/);
  const draft = { ...entry, id: 'card', name: 'Card', source: 'Card.tsx', description: 'Draft fixture: review props, providers, and states.', draft: true };
  assert.equal(isDraft(draft), true);
  assert.equal(isDraft({ ...draft, draft: undefined }), true, 'older generated fixtures are recognised by their placeholder description');
  assert.equal(isDraft({ ...draft, draft: false }), false);
  assert.equal(isDraft(entry), false);
  const coverage = [{ source: 'Button.tsx', status: 'previewed' }, { source: 'Card.tsx', status: 'previewed' }, { source: 'Dialog.tsx', status: 'missing' }];
  const html = renderToStaticMarkup(createElement(Workbench, { project:'Fixture', projectId:'fixture', basePath:'/design', entries:[entry, draft], coverage, initialSelection:{ component:'button', design:'current', state:'Default', viewport:'fit', view:'setup' } }));
  assert.match(html, /Use DesignBench with your agent/);
  assert.match(html, /aria-label="Your agent"/);
  // Each choice carries its agent's mark.
  for (const label of ['Claude', 'ChatGPT', 'Cursor', 'Other agents']) assert.match(html, new RegExp(`dw-agent-choice[^>]*><svg[^>]*dw-agent-icon.*?</svg>${label}<`));
  assert.match(html, /Populate the workbench/);
  assert.match(html, /Keep it up to date/);
  assert.match(html, /<strong>2 of 3<\/strong> component files have a preview, <strong>1<\/strong> to go\./);
  assert.match(html, /1 preview is still a draft\./);
  assert.match(html, /CLAUDE\.md/);
  // The sidebar marks the unfinished preview and links to the gaps.
  assert.match(html, /dw-nav-draft[^>]*>Draft</);
  assert.match(html, /Coverage &amp; gaps/);
  const complete = renderToStaticMarkup(createElement(Workbench, { project:'Fixture', projectId:'fixture', basePath:'/design', entries:[entry], coverage: coverage.slice(0, 2), initialSelection:{ component:'button', design:'current', state:'Default', viewport:'fit', view:'setup' } }));
  assert.match(complete, /All <strong>2<\/strong> component files have a preview\./);
  assert.doesNotMatch(complete, /Coverage &amp; gaps|dw-nav-draft/);
  const fresh = renderToStaticMarkup(createElement(Workbench, { project:'Fixture', projectId:'fixture', basePath:'/design', entries:[], needsInit:true }));
  assert.match(fresh, /Set up and populate the workbench/);
});

test('Settings offers an MCP connection where the workbench supports one, with setup for each agent', async () => {
  const { mcpSetup, variantsPrompt, SetupGuide, describeView, describeCatalog } = await import('../dist/index.js');
  assert.deepEqual(mcpSetup('claude', 'npx designbench'), { kind: 'command', text: 'claude mcp add designbench -- npx designbench mcp', how: 'Run this once in your project folder.', then: 'Then start a new Claude Code session in this project.' });
  assert.equal(mcpSetup('chatgpt', 'npx --no-install designbench').text, 'codex mcp add designbench -- npx --no-install designbench mcp');
  // Cursor may start servers outside the project, so an installed copy is addressed through the workspace folder.
  assert.deepEqual(JSON.parse(mcpSetup('cursor', 'npx --no-install designbench').text), { mcpServers: { designbench: { command: 'node', args: ['${workspaceFolder}/node_modules/designbench/cli/index.mjs', '--cwd', '${workspaceFolder}', 'mcp'] } } });
  // A checkout command keeps its quoted paths as single arguments.
  const checkout = "node '/Users/some one/it''s/cli/index.mjs' --cwd '/Users/some one/app'";
  assert.deepEqual(JSON.parse(mcpSetup('cursor', checkout).text).mcpServers.designbench, { command: 'node', args: ['/Users/some one/its/cli/index.mjs', '--cwd', '/Users/some one/app', 'mcp'] });
  assert.deepEqual(JSON.parse(mcpSetup('other', 'npx designbench').text).mcpServers.designbench, { command: 'npx', args: ['designbench', 'mcp'] });
  assert.match(mcpSetup('other', 'npx designbench').text, /"args": \["designbench", "mcp"\]/);
  assert.match(variantsPrompt('npx designbench', { component: 'Button', count: 4 }), /^Create 4 visual variants of the Button component\.[\s\S]*npx designbench variant create[\s\S]*do not promote a variant until I choose one\.$/);

  const props = { project:'Fixture', projectId:'fixture', basePath:'/design', entries:[entry], initialSelection:{ component:'button', design:'current', state:'Default', viewport:'fit', view:'setup' } };
  // An embedded workbench has no MCP server, so it offers prompts only.
  const embedded = renderToStaticMarkup(createElement(Workbench, props));
  assert.doesNotMatch(embedded, /How your agent works with DesignBench|connect it over MCP/);
  // The CLI's workbench offers both; prompts stay the default.
  const waiting = renderToStaticMarkup(createElement(Workbench, { ...props, agentConnection: null }));
  assert.match(waiting, /aria-label="How your agent works with DesignBench"/);
  assert.match(waiting, /copy a prompt or connect it over MCP/);
  assert.match(waiting, /Populate the workbench/);
  assert.doesNotMatch(waiting, /Connect Claude to this workbench|dw-mcp-dot/);
  const guide = { embedded: true, empty: false, command: 'npx designbench', coverage: [{ source: 'Button.tsx', status: 'previewed' }, { source: 'Card.tsx', status: 'missing' }], defaultConnect: 'mcp' };
  const notConnected = renderToStaticMarkup(createElement(SetupGuide, { ...guide, connection: null }));
  assert.match(notConnected, /Connect Claude to this workbench/);
  assert.match(notConnected, /claude mcp add designbench -- npx designbench mcp/);
  assert.match(notConnected, />Copy command</);
  assert.match(notConnected, /Then start a new Claude Code session in this project\. This line turns green when it connects\./);
  assert.match(notConnected, /\/mcp__designbench__populate/);
  assert.match(notConnected, /<strong>1 of 2<\/strong> component files have a preview/);
  assert.doesNotMatch(notConnected, /Keep it up to date|data-connected/);
  const connected = renderToStaticMarkup(createElement(SetupGuide, { ...guide, connection: { client: 'Claude Code', at: Date.now() } }));
  assert.match(connected, /<strong>Claude Code is connected\.<\/strong> It last called at /);
  assert.match(connected, /dw-mcp-dot" data-connected="true"/);
  // Without an MCP server the choice is ignored.
  assert.doesNotMatch(renderToStaticMarkup(createElement(SetupGuide, guide)), /Connect Claude to this workbench/);

  // What the page reports to the dev server for agents: names, ids and files, in the workbench's own words.
  const ink = { id: 'ink', name: 'Ink', kind: 'exploration', source: '.design-workbench/ideas/button/ink/component.tsx' };
  const controlled = { ...entry, designs: [{ id: 'current', name: 'Source component', source: 'Button.tsx' }, ink], propControls: { label: { type: 'text', defaultValue: 'Continue' } } };
  const view = describeView([controlled], { page: 'component', comparing: true, selection: { component: 'button', design: 'ink', state: 'Disabled', viewport: '375', props: '{"label":"Send"}' } }, '/design');
  assert.deepEqual({ ...view, variant: { ...view.variant, files: view.variant.files.length } }, {
    page: 'component', component: { id: 'button', name: 'Button', source: 'Button.tsx' }, variant: { id: 'ink', name: 'Ink', kind: 'variant', files: 3 },
    state: 'Disabled', viewport: '375', comparing: true, properties: { label: 'Send' }, editedProperties: { label: 'Send' },
    previewPath: '/design/button?design=ink&state=Disabled&props=%7B%22label%22%3A%22Send%22%7D',
  });
  // The grid is reported the same way, so an agent knows every state is on screen.
  const gridView = describeView([controlled], { page: 'component', comparing: false, grid: true, selection: { component: 'button', design: 'ink', state: 'Disabled', viewport: 'fit' } }, '/design');
  assert.equal(gridView.grid, true);
  assert.equal('comparing' in gridView, false);
  assert.equal('grid' in view, false);
  assert.deepEqual(describeView([controlled], { page: 'settings', comparing: false, grid: true, selection: { component: 'button', design: 'current', state: 'Default', viewport: 'fit' } }), { page: 'settings' });
  const described = describeCatalog('Fixture', [controlled], [{ source: 'Button.tsx', status: 'previewed', reason: 'ignored' }]);
  assert.deepEqual(described.components[0].states, ['Default', 'Disabled']);
  assert.deepEqual(described.components[0].variants, [{ id: 'current', name: 'Source component', kind: 'source', source: 'Button.tsx' }, { id: 'ink', name: 'Ink', kind: 'variant', source: ink.source }]);
  assert.deepEqual(described.coverage, [{ source: 'Button.tsx', status: 'previewed' }]);
});
