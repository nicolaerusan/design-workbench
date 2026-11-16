import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { initialize } from '../cli/setup.mjs';
import { startDev } from '../cli/dev.mjs';
import { createBridge, resolveTarget } from '../cli/bridge.mjs';
import { runtimeFile, readRuntime } from '../cli/runtime.mjs';
import { describeView, describeCatalog } from '../dist/index.js';

const cli = fileURLToPath(new URL('../cli/index.mjs', import.meta.url));
const entries = [
  { id: 'button', name: 'Button', group: 'Controls', source: 'src/Button.tsx', fixture: '.design-workbench/previews/button.tsx', description: 'A button', width: 400, variants: ['Default', 'Disabled'],
    designs: [{ id: 'current', name: 'Source component', source: 'src/Button.tsx' }, { id: 'ink', name: 'Ink', kind: 'exploration', source: '.design-workbench/ideas/button/ink/component.tsx' }],
    propControls: { label: { type: 'text', defaultValue: 'Save' } } },
  { id: 'card', name: 'Card', group: 'Layout', source: 'src/Card.tsx', description: 'Draft fixture: review props, providers, and states.', width: 400, variants: ['Default'], draft: true },
];
const catalog = describeCatalog('Fixture', entries, [{ source: 'src/Button.tsx', status: 'previewed' }, { source: 'src/Card.tsx', status: 'previewed' }, { source: 'src/Dialog.tsx', status: 'missing' }]);
const viewOf = (base, selection, comparing = false) => ({ ...describeView(entries, { page: 'component', comparing, selection: { viewport: 'fit', ...selection } }), url: `${base}/?${new URLSearchParams(selection)}` });

async function project(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'designbench-mcp-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'src'));
  await fs.writeFile(path.join(root, 'package.json'), '{"name":"mcp-test"}');
  await fs.writeFile(path.join(root, 'src/Button.tsx'), 'export function Button() { return <button>Save</button>; }\n');
  await initialize(root);
  return root;
}
/** A minimal MCP client: newline-delimited JSON-RPC over the server's standard streams. */
function connect(t, cwd, { args = [], capabilities = {}, roots = [] } = {}) {
  const child = spawn(process.execPath, [cli, ...args, 'mcp'], { cwd, stdio: ['pipe', 'pipe', 'inherit'] });
  t.after(() => child.kill());
  const waiting = new Map();
  const write = message => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
  let buffer = '', next = 0;
  child.stdout.on('data', chunk => {
    buffer += chunk;
    for (let end; (end = buffer.indexOf('\n')) >= 0;) {
      const message = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      if (message.method === 'roots/list') write({ id: message.id, result: { roots } });
      else waiting.get(message.id)?.(message);
    }
  });
  const request = (method, params) => new Promise(resolve => { const id = ++next; waiting.set(id, resolve); write({ id, method, params }); });
  return {
    request,
    async start() {
      const { result } = await request('initialize', { protocolVersion: '2025-06-18', capabilities, clientInfo: { name: 'claude-code', version: '2.0.0' } });
      write({ method: 'notifications/initialized' });
      return result;
    },
    async tool(name, input = {}) {
      const { result } = await request('tools/call', { name, arguments: input });
      return { text: result.content[0].text, isError: !!result.isError };
    },
  };
}
const details = text => JSON.parse(text.slice(text.indexOf('{')));

test('designbench mcp tells an agent what is open, opens views, and lists components', async t => {
  const root = await project(t);
  const server = await startDev(root, { port: 0 });
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const page = body => fetch(`${base}/__designbench/view`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-DesignBench': '1', Origin: base }, body: JSON.stringify(body) }).then(response => response.json());

  // The running server records where it is, readable by this user only.
  const runtime = await readRuntime(root);
  assert.equal(runtime.url, base);
  if (process.platform !== 'win32') assert.equal((await fs.stat(runtimeFile(root))).mode & 0o777, 0o600);

  const mcp = connect(t, root);
  const started = await mcp.start();
  assert.equal(started.protocolVersion, '2025-06-18');
  assert.equal(started.serverInfo.name, 'designbench');
  assert.match(started.instructions, /get_current_view[\s\S]*never edit files/);
  assert.deepEqual((await mcp.request('tools/list')).result.tools.map(tool => tool.name), ['get_current_view', 'open_view', 'list_components']);

  // Before a browser has loaded the workbench there is nothing to report, and names cannot be checked.
  assert.match((await mcp.tool('get_current_view')).text, new RegExp(`running at ${base}/, but no browser tab has it open`));
  assert.match((await mcp.tool('list_components')).text, /has not been opened in a browser yet/);
  const unchecked = await mcp.tool('open_view', { component: 'button' });
  assert.match(unchecked.text, new RegExp(`No workbench tab is open[\\s\\S]*${base}/\\?component=button\\n[\\s\\S]*names were not checked`));

  // The page reports its view; the reply tells it which agent has called in.
  const reported = await page({ tab: 'one', catalog, view: viewOf(base, { component: 'button', design: 'ink', state: 'Disabled', props: '{"label":"Send"}' }) });
  assert.equal(reported.agent.client, 'Claude Code');
  assert.equal(reported.needsCatalog, false);

  const current = await mcp.tool('get_current_view');
  assert.match(current.text, /^The user has Button open in DesignBench, showing the saved variant "Ink" in the state "Disabled"\. Editing \.design-workbench\/ideas\/button\/ink\/component\.tsx changes only this preview\./);
  const view = details(current.text);
  assert.deepEqual(view.component, { id: 'button', name: 'Button', source: 'src/Button.tsx', fixture: '.design-workbench/previews/button.tsx' });
  assert.deepEqual(view.variant.files.map(file => file.path), ['component.tsx', 'index.tsx', 'variant.json'].map(name => `.design-workbench/ideas/button/ink/${name}`));
  assert.deepEqual(view.editedProperties, { label: 'Send' });
  assert.equal(view.previewUrl, `${base}/button?design=ink&state=Disabled&props=%7B%22label%22%3A%22Send%22%7D`);

  const listed = details((await mcp.tool('list_components')).text);
  assert.equal(listed.summary, '2 components. 2 of 3 component files have a preview.');
  assert.deepEqual(listed.components[0].variants.map(variant => `${variant.id}:${variant.kind}`), ['current:source', 'ink:variant']);
  assert.deepEqual(listed.drafts, ['card']);
  assert.deepEqual(listed.missingPreviews, ['src/Dialog.tsx']);
  assert.deepEqual(details((await mcp.tool('list_components', { search: 'layout' })).text).components.map(item => item.id), ['card']);

  // A wrong name comes back as a correctable error that lists the choices.
  const wrong = await mcp.tool('open_view', { state: 'Hover' });
  assert.equal(wrong.isError, true);
  assert.match(wrong.text, /Button has no state "Hover"\. States: Default, Disabled\./);
  // Nothing confirms this open request (no real page is listening), so the agent gets the URL to open itself.
  // The component stays the same, so the variant on screen is kept.
  const opened = await mcp.tool('open_view', { state: 'default' });
  assert.match(opened.text, new RegExp(`No workbench tab is open[\\s\\S]*${base}/\\?component=button&design=ink&state=Default$`));

  await page({ tab: 'two', view: viewOf(base, { component: 'card', design: 'current', state: 'Default' }) });
  await page({ tab: 'two', closed: true });
  assert.match((await mcp.tool('get_current_view')).text, /^No workbench tab is open now\. The last view, moments ago, was Card, showing the source component their app uses/);

  // The Settings prompts are also served as MCP prompts.
  assert.deepEqual((await mcp.request('prompts/list')).result.prompts.map(prompt => prompt.name), ['populate', 'refresh', 'variants']);
  const populate = (await mcp.request('prompts/get', { name: 'populate' })).result.messages[0];
  assert.equal(populate.role, 'user');
  assert.match(populate.content.text, /scan --write[\s\S]*Do not change application source files/);
  assert.doesNotMatch(populate.content.text, /designbench init|` init`/);
  const variants = (await mcp.request('prompts/get', { name: 'variants', arguments: { direction: 'more compact' } })).result.messages[0].content.text;
  assert.match(variants, /the component I have open in DesignBench \(call get_current_view[\s\S]*exploring this direction: more compact/);
  assert.equal((await mcp.request('tools/call', { name: 'edit_file', arguments: {} })).error.code, -32602);
  assert.equal((await mcp.request('resources/list')).error.code, -32601);

  // Once the workbench stops, its record is removed and the tools say how to start it again.
  await server.close();
  assert.equal(await readRuntime(root), null);
  assert.match((await mcp.tool('get_current_view')).text, /is not running\. Start it with `.* dev`/);
});

test('the view and agent routes accept only the workbench page and designbench mcp', async t => {
  const root = await project(t);
  const server = await startDev(root, { port: 0 });
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const { token } = await readRuntime(root);
  const post = (route, headers, body = {}) => fetch(`${base}/__designbench/${route}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const pageHeaders = { 'Content-Type': 'application/json', 'X-DesignBench': '1', Origin: base };
  assert.equal((await post('view', { 'Content-Type': 'application/json', Origin: base }, { tab: 'x' })).status, 403);
  assert.equal((await post('view', { ...pageHeaders, Origin: 'https://untrusted.example' }, { tab: 'x' })).status, 403);
  assert.equal((await fetch(`${base}/__designbench/view`)).status, 405);
  assert.equal((await post('view', pageHeaders, {})).status, 400);
  assert.equal((await post('view', pageHeaders, { tab: 'x' })).status, 200);
  // Agents need the token from the runtime file, and a browser (which always sends an Origin) is refused even with it.
  const agent = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  assert.equal((await post('agent/state', { 'Content-Type': 'application/json' })).status, 403);
  assert.equal((await post('agent/state', { ...agent, Authorization: 'Bearer wrong' })).status, 403);
  assert.equal((await post('agent/state', { ...agent, Origin: base })).status, 403);
  assert.equal((await post('agent/open', pageHeaders, { component: 'button' })).status, 403);
  const state = await post('agent/state', agent);
  assert.equal(state.status, 200);
  assert.deepEqual(Object.keys(await state.json()).sort(), ['components', 'coverage', 'project', 'root', 'tabOpen', 'url', 'view', 'viewAt']);
  assert.equal((await post('agent/open', agent, { viewport: 'huge' })).status, 400);
  assert.equal((await post('other', pageHeaders)).status, 404);
  await server.close();
});

test('an open request goes to the tab the user used last and is confirmed by that tab', async () => {
  const sent = [];
  const bridge = createBridge({ root: '/project', send: (event, data) => sent.push({ event, data }) });
  bridge.setOrigin('http://127.0.0.1:7070');
  const base = 'http://localhost:7070';
  bridge.report({ tab: 'a', catalog, view: viewOf(base, { component: 'button', design: 'ink', state: 'Disabled' }) });
  bridge.report({ tab: 'b', view: viewOf(base, { component: 'card', design: 'current', state: 'Default' }) });
  bridge.report({ tab: 'a', view: viewOf(base, { component: 'button', design: 'ink', state: 'Disabled' }) });
  const opening = bridge.open({ component: 'Card' });
  await new Promise(setImmediate);
  const { event, data } = sent.at(-1);
  assert.equal(event, 'designbench:open');
  assert.equal(data.tab, 'a');
  assert.equal(data.search, '?component=card');
  bridge.report({ tab: 'a', view: viewOf(base, { component: 'card', design: 'current', state: 'Default' }), ack: data.id });
  // The URL uses the address the user's tab is on.
  assert.deepEqual(await opening, { url: 'http://localhost:7070/?component=card', label: 'Card', unchecked: false, opened: true });
  assert.equal((await bridge.state()).view.component.id, 'card');
});

test('an agent that asks while the page reloads after a file edit gets the reloaded tab', async () => {
  const sent = [];
  const bridge = createBridge({ root: '/project', send: (event, data) => sent.push({ event, data }), confirmWithin: 30, reloadWithin: 2000 });
  const base = 'http://localhost:7070';
  const button = viewOf(base, { component: 'button', design: 'ink', state: 'Disabled' });
  bridge.report({ tab: 'before', catalog, view: button });
  // The user closing the tab is reported at once.
  bridge.report({ tab: 'before', closed: true });
  assert.equal((await bridge.state()).tabOpen, false);
  // After a file change, the gap between the old tab leaving and the new one reporting is waited out.
  bridge.report({ tab: 'before', view: button });
  bridge.fileChanged();
  bridge.report({ tab: 'before', closed: true });
  const asking = bridge.state();
  setTimeout(() => bridge.report({ tab: 'after', view: button }), 60);
  const state = await asking;
  assert.equal(state.tabOpen, true);
  assert.equal(state.view.component.id, 'button');
  // An open request sent to a tab that has just gone is repeated for the tab that replaced it.
  bridge.report({ tab: 'stale', view: button });
  const opening = bridge.open({ state: 'Default' });
  await new Promise(setImmediate);
  assert.equal(sent.at(-1).data.tab, 'stale');
  bridge.report({ tab: 'reloaded', view: button });
  while (sent.at(-1).data.tab !== 'reloaded') await new Promise(resolve => setTimeout(resolve, 5));
  bridge.report({ tab: 'reloaded', view: button, ack: sent.at(-1).data.id });
  assert.equal((await opening).opened, true);
});

test('open targets accept ids or names, keep what is open, and explain what does not match', () => {
  const open = viewOf('http://localhost:7070', { component: 'button', design: 'ink', state: 'Disabled', viewport: '768' });
  const search = request => resolveTarget(catalog, open, request).search;
  assert.equal(search({ state: 'Default' }), '?component=button&design=ink&state=Default&viewport=768');
  assert.equal(search({ component: 'BUTTON', variant: 'source' }), '?component=button&design=current&state=Disabled&viewport=768');
  assert.equal(search({ component: 'src/Button.tsx', variant: 'Ink', viewport: 'fit' }), '?component=button&design=ink&state=Disabled');
  assert.equal(search({ component: 'card' }), '?component=card');
  assert.equal(search({ page: 'overview' }), '');
  assert.equal(search({ page: 'settings' }), '?view=setup');
  assert.equal(resolveTarget(catalog, open, { variant: 'ink' }).label, 'Button, variant Ink, state Disabled');
  assert.throws(() => resolveTarget(catalog, open, { component: 'card', variant: 'ink' }), /Card has no variant "ink"\. Variants: source \(Source component\)\./);
  assert.throws(() => resolveTarget(catalog, open, { component: 'dialog' }), /No component matches "dialog"\. Components: button, card\./);
  assert.throws(() => resolveTarget(catalog, open, { viewport: '500' }), /viewport must be one of/);
  assert.throws(() => resolveTarget(catalog, { page: 'overview' }, { state: 'Default' }), /Name a component/);
  assert.deepEqual(resolveTarget(null, null, { component: 'button', state: 'Disabled' }), { search: '?component=button&state=Disabled', label: 'button', unchecked: true });
});

test('designbench mcp finds the project from --cwd or from the folders the agent has open', async t => {
  const root = await project(t);
  const server = await startDev(root, { port: 0 });
  t.after(() => server.close());
  const elsewhere = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'designbench-elsewhere-')));
  t.after(() => fs.rm(elsewhere, { recursive: true, force: true }));
  const running = new RegExp(`running at http://127\\.0\\.0\\.1:${server.httpServer.address().port}/`);
  // Some agents start servers outside the project folder. Without a hint the server reports on the folder it was started in.
  const lost = connect(t, elsewhere);
  await lost.start();
  assert.match((await lost.tool('get_current_view')).text, new RegExp(`${elsewhere.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} has no DesignBench workbench yet`));
  const pinned = connect(t, elsewhere, { args: ['--cwd', root] });
  await pinned.start();
  assert.match((await pinned.tool('get_current_view')).text, running);
  const asked = connect(t, elsewhere, { capabilities: { roots: {} }, roots: [{ uri: pathToFileURL(elsewhere).href }, { uri: pathToFileURL(root).href, name: 'app' }] });
  await asked.start();
  assert.match((await asked.tool('get_current_view')).text, running);
  await server.close();
});
