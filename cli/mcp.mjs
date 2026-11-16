import path from 'node:path';
import fs from 'node:fs/promises';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { projectCommand, readRuntime } from './runtime.mjs';

// The Model Context Protocol over stdio: one JSON-RPC message per line. Tools and prompts are the same in each revision.
const versions = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const clientNames = { 'claude-code': 'Claude Code', 'claude-ai': 'Claude', 'codex-mcp-client': 'Codex', 'cursor-vscode': 'Cursor' };
const exists = file => fs.access(file).then(() => true, () => false);

const instructions = `DesignBench is this project's component workbench. The user looks at components, their states, and saved variants in a browser while you edit the code.

- When the user refers to what they have open ("this", "this variant", "the button I'm looking at"), call get_current_view before you act.
- After you change something, use open_view to put it on their screen.
- list_components gives component ids, states, variants, drafts, and the component files that still have no preview.

These tools never edit files; you do. Read .design-workbench/AGENT.md first. Editing a saved variant under .design-workbench/ideas/ changes only its preview. Editing a component's source file changes the app itself, so try ideas as variants unless the user asks otherwise.`;

const tools = [
  {
    name: 'get_current_view', title: 'What is open in DesignBench',
    description: 'What the user has open in their DesignBench workbench right now: the component, the variant (the source component their app uses, or a saved variant), the state, any properties they edited, and the files behind it. Call this before acting when the user refers to what they are looking at.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'open_view', title: 'Open a view in DesignBench',
    description: 'Shows a component in the user’s DesignBench tab, optionally at a variant, state, or viewport width. Use it to show the user what you changed. It changes what is on screen, never files. Returns the URL, which you can also open in your own browser.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      component: { type: 'string', description: 'Component id or name. Leave out to stay on the component that is open.' },
      variant: { type: 'string', description: 'Variant id or name, or "source" for the component the app uses.' },
      state: { type: 'string', description: 'State name, for example "Disabled".' },
      viewport: { type: 'string', enum: ['fit', '375', '768', '1280'], description: 'Preview width in pixels, or "fit".' },
      page: { type: 'string', enum: ['overview', 'settings'], description: 'Open a workbench page instead of a component.' },
    } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'list_components', title: 'Components in DesignBench',
    description: 'The components in this project’s DesignBench workbench with their ids, source files, states, and variants, the previews still marked as drafts, and the component files that have no preview yet.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      search: { type: 'string', description: 'Only components whose name, id, group, or source file contains this text.' },
    } },
    annotations: { readOnlyHint: true },
  },
];

const prompts = [
  { name: 'populate', title: 'Populate the workbench', description: 'Find every UI component in this project and build a finished DesignBench preview for each.' },
  { name: 'refresh', title: 'Keep the workbench up to date', description: 'Rescan the project, add previews for new components, and finish drafts.' },
  { name: 'variants', title: 'Create variants', description: 'Create a few visual variants of a component to compare side by side.', arguments: [
    { name: 'component', description: 'Component name or id. Leave out to use the one open in the workbench.', required: false },
    { name: 'direction', description: 'What to explore, for example "more compact" or "friendlier".', required: false },
  ] },
];

const ago = at => {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  return seconds < 60 ? 'moments ago' : seconds < 3600 ? `${Math.round(seconds / 60)} min ago` : `${Math.round(seconds / 3600)} h ago`;
};

/** A sentence for the agent, followed by the details as JSON. */
function describeView({ view, viewAt, tabOpen, url }) {
  if (!view) return `The workbench is running at ${url}, but no browser tab has it open, so there is no current view. Open ${url} (your own browser tool works) and ask again.`;
  let subject, detail = '', advice = '';
  if (view.page === 'component') {
    subject = view.component.name;
    const shown = `${view.variant.kind === 'source' ? 'the source component their app uses' : `the saved variant "${view.variant.name}"`} in the state "${view.state}"`;
    // In the grid nothing is hidden: the selected cell is only the one the Properties tab describes.
    detail = view.grid ? `, as a grid with every variant at every state on screen; the selected cell is ${shown}`
      : `, showing ${shown}${view.comparing ? ', with every variant side by side' : ''}`;
    advice = view.variant.kind === 'source'
      ? ` Editing ${view.component.source} changes the app itself; to try an idea without that, create a variant.`
      : ` Editing ${view.variant.files[0]?.path ?? 'its files'} changes only this preview.`;
  } else subject = { overview: 'the component overview', settings: 'the Settings page', coverage: 'the Coverage & gaps page' }[view.page] ?? view.page;
  const lead = tabOpen ? `The user has ${subject} open in DesignBench${detail}.${advice}` : `No workbench tab is open now. The last view, ${ago(viewAt)}, was ${subject}${detail}.${advice}`;
  const { previewPath, ...rest } = view;
  return `${lead}\n\n${JSON.stringify({ ...rest, ...(previewPath ? { previewUrl: new URL(previewPath, url).href } : {}), updated: ago(viewAt) }, null, 2)}`;
}

function describeComponents({ components, coverage, project, url }, search) {
  if (!components) return `The workbench is running at ${url}, but it has not been opened in a browser yet, so its components are not known. Open ${url} (your own browser tool works) and ask again.`;
  const text = String(search ?? '').trim().toLowerCase();
  const shown = text ? components.filter(item => `${item.name} ${item.id} ${item.group} ${item.source}`.toLowerCase().includes(text)) : components;
  const missing = (coverage ?? []).filter(item => item.status === 'missing').map(item => item.source);
  return JSON.stringify({
    project, url,
    summary: `${components.length} ${components.length === 1 ? 'component' : 'components'}${text ? `, ${shown.length} matching "${search}"` : ''}. ${coverage?.length ? `${coverage.length - missing.length} of ${coverage.length} component files have a preview.` : 'Run scan --write to see which component files lack a preview.'}`,
    components: shown,
    drafts: components.filter(item => item.draft).map(item => item.id),
    missingPreviews: missing,
  }, null, 2);
}

/** Serves MCP on the given streams until the input closes. `cwd` pins the project; otherwise it is found from the client. */
export async function runMcp({ cwd, input = process.stdin, output = process.stdout } = {}) {
  const manifest = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const send = message => output.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
  const asked = new Map();
  let nextId = 0, client = { name: 'An agent' }, capabilities = {}, found;
  const ask = (method, params) => new Promise((resolve, reject) => {
    const id = `designbench-${++nextId}`;
    const timer = setTimeout(() => { asked.delete(id); reject(new Error('No answer.')); }, 2000);
    asked.set(id, result => { clearTimeout(timer); asked.delete(id); resolve(result); });
    send({ id, method, params });
  });

  const hasWorkbench = async directory => await exists(path.join(directory, '.design-workbench/config.json')) || !!await readRuntime(directory);
  /** --cwd, then the folder the agent started this server in, then the folders the agent says it has open. */
  async function projectRoot() {
    if (found) return found;
    const real = directory => fs.realpath(directory).catch(() => path.resolve(directory));
    if (cwd) return found = await real(cwd);
    const candidates = [await real(process.cwd())];
    if (!await hasWorkbench(candidates[0]) && capabilities.roots) try {
      for (const root of (await ask('roots/list')).roots ?? []) if (String(root.uri).startsWith('file:')) candidates.push(await real(fileURLToPath(root.uri)));
    } catch {}
    for (const candidate of candidates) if (await hasWorkbench(candidate)) return found = candidate;
    // Not cached: the user may still create the workbench during this session.
    return candidates[1] ?? candidates[0];
  }

  /** Calls the running workbench. Resolves to null when it is not running. */
  async function workbench(route, body) {
    const root = await projectRoot();
    const info = await readRuntime(root);
    if (!info) return null;
    let response;
    try {
      response = await fetch(`${info.url}/__designbench/agent/${route}`, {
        method: 'POST', signal: AbortSignal.timeout(8000),
        headers: { Authorization: `Bearer ${info.token}`, 'Content-Type': 'application/json', 'X-DesignBench-Client': clientNames[client.name] ?? client.title ?? client.name },
        body: JSON.stringify(body ?? {}),
      });
    } catch { return null; } // The record outlived its server.
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? `The workbench answered ${response.status}.`);
    return result;
  }
  async function notRunning() {
    const root = await projectRoot();
    const command = await projectCommand(root);
    return await exists(path.join(root, '.design-workbench/config.json'))
      ? `The DesignBench workbench for ${root} is not running. Start it with \`${command} dev\` and keep it running (in the background if you can), then open the URL it prints.`
      : `${root} has no DesignBench workbench yet. Create one with \`${command} init\`, then start it with \`${command} dev\`. This server's "populate" prompt covers the whole setup.`;
  }

  async function callTool(name, args = {}) {
    if (name === 'get_current_view') { const state = await workbench('state'); return state ? describeView(state) : notRunning(); }
    if (name === 'list_components') { const state = await workbench('state'); return state ? describeComponents(state, args.search) : notRunning(); }
    const result = await workbench('open', args);
    if (!result) return notRunning();
    return result.opened
      ? `Opened ${result.label} in the user's workbench tab.\n${result.url}`
      : `No workbench tab is open, so nothing changed on screen. Open this URL to show ${result.label}:\n${result.url}${result.unchecked ? '\nThe names were not checked, because the workbench has not been loaded in a browser yet.' : ''}`;
  }
  async function getPrompt(name, args = {}) {
    const text = await import('../dist/agent-prompts.js').catch(() => { throw new Error('DesignBench is not built. Run npm run build in the designbench package.'); });
    const root = await projectRoot();
    const command = await projectCommand(root);
    if (name === 'populate') return text.populatePrompt(command, !await exists(path.join(root, '.design-workbench/config.json')));
    if (name === 'refresh') return text.refreshPrompt(command);
    return text.variantsPrompt(command, { component: args.component || undefined, direction: args.direction || undefined });
  }

  async function handle(message) {
    const { id, method, params } = message;
    if (method === undefined) return asked.get(id)?.(message.result ?? {}); // An answer to something this server asked.
    if (id === undefined) { // A notification.
      if (method === 'notifications/initialized') workbench('state').catch(() => {}); // Lets Settings show the connection.
      return;
    }
    const fail = (code, text) => send({ id, error: { code, message: text } });
    try {
      if (method === 'initialize') {
        client = params?.clientInfo ?? client;
        capabilities = params?.capabilities ?? {};
        return send({ id, result: {
          protocolVersion: versions.includes(params?.protocolVersion) ? params.protocolVersion : versions[0],
          capabilities: { tools: {}, prompts: {} },
          serverInfo: { name: 'designbench', title: 'DesignBench', version: manifest.version },
          instructions,
        } });
      }
      if (method === 'ping') return send({ id, result: {} });
      if (method === 'tools/list') return send({ id, result: { tools } });
      if (method === 'prompts/list') return send({ id, result: { prompts } });
      if (method === 'tools/call') {
        if (!tools.some(tool => tool.name === params?.name)) return fail(-32602, `Unknown tool: ${params?.name}`);
        try { return send({ id, result: { content: [{ type: 'text', text: await callTool(params.name, params.arguments) }] } }); }
        catch (error) { return send({ id, result: { content: [{ type: 'text', text: error.message }], isError: true } }); }
      }
      if (method === 'prompts/get') {
        const prompt = prompts.find(item => item.name === params?.name);
        if (!prompt) return fail(-32602, `Unknown prompt: ${params?.name}`);
        return send({ id, result: { description: prompt.description, messages: [{ role: 'user', content: { type: 'text', text: await getPrompt(prompt.name, params.arguments) } }] } });
      }
      fail(-32601, `Method not found: ${method}`);
    } catch (error) { fail(-32603, error.message); }
  }

  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  const running = new Set();
  for await (const line of lines) {
    if (!line.trim()) continue;
    let message;
    try { message = JSON.parse(line); } catch { send({ id: null, error: { code: -32700, message: 'Parse error' } }); continue; }
    for (const item of Array.isArray(message) ? message : [message]) {
      const task = handle(item).finally(() => running.delete(task));
      running.add(task);
    }
  }
  await Promise.all(running);
}
