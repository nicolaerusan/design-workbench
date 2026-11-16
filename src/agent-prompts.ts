/** The coding agents the Settings page gives instructions for. `name` is how a sentence refers to the agent. */
export const agents = [
  { id: 'claude', label: 'Claude', name: 'Claude', where: 'Open this project in Claude Code (in a terminal, your editor, or the Code tab of the Claude desktop app) and paste a prompt below.', memory: 'CLAUDE.md' },
  { id: 'chatgpt', label: 'ChatGPT', name: 'Codex', where: 'Open this project in Codex, the coding agent that comes with ChatGPT, and paste a prompt below.', memory: 'AGENTS.md' },
  { id: 'cursor', label: 'Cursor', name: 'Cursor', where: 'Open this project in Cursor, start an Agent chat, and paste a prompt below.', memory: 'AGENTS.md' },
  { id: 'other', label: 'Other agents', name: 'your agent', where: 'Any coding agent that can run commands and edit files in this project works. Paste a prompt below.', memory: 'AGENTS.md' },
] as const;
export type AgentId = typeof agents[number]['id'];

/** A long command (for example a path into a local checkout) is stated once, then written as `designbench`. */
function cli(command: string) {
  if (command.length <= 32) return { run: command, intro: '' };
  return { run: 'designbench', intro: `In this project the DesignBench command is:\n\n    ${command}\n\nIt is written as \`designbench\` below. Run the full command each time.\n\n` };
}

/** Finds every component and builds a finished preview for each. Self-contained, so it works with older AGENT.md files. */
export function populatePrompt(fullCommand: string, needsInit = false) {
  const { run: command, intro } = cli(fullCommand);
  return `${intro}Populate this project's DesignBench workbench so every UI component has a working preview.

1. ${needsInit ? `Run \`${command} init\` to create .design-workbench/. Then read` : 'Read'} .design-workbench/AGENT.md, config.json, and the fixtures already in .design-workbench/previews/.
2. Run \`${command} scan --write\` and review the component candidates. Skip anything that is not a visual component (hooks, providers, helpers) and note why.
3. For each remaining component without a preview, run \`${command} add '<file>#<ExportName>'\` (or \`${command} add --all\`), then finish the generated fixture in .design-workbench/previews/:
   - realistic sample props and children, plus any providers and CSS the component needs
   - named states in \`variants\` with \`stateProps\` (for example default, empty, loading, error, disabled, long text; only the ones that apply)
   - \`propControls\` for the props worth editing live
   - a one-sentence description and a sensible \`group\`
   - remove \`draft: true\` once the preview is finished
4. Mock data, network, and authentication. Never call real services from a fixture.
5. Make sure \`${command} dev\` is running, open each new preview, and fix anything that fails to render.
6. Finish with a list of what you added, what you skipped and why, and anything that needs my input.

Do not change application source files.`;
}

/** Catches the workbench up after components were added, renamed, or left as drafts. */
export function refreshPrompt(fullCommand: string) {
  const { run: command, intro } = cli(fullCommand);
  return `${intro}Bring this project's DesignBench workbench up to date.

1. Read .design-workbench/AGENT.md, then run \`${command} scan --write\`.
2. Compare the candidates with the fixtures in .design-workbench/previews/. Add and finish a preview for each new visual component, to the same standard as the existing fixtures.
3. Finish any fixture still marked \`draft: true\`.
4. For fixtures whose source file moved or no longer exists, fix the import or tell me which ones to remove.
5. Open each preview you touched in the running workbench (\`${command} dev\`) and confirm it renders.

Do not change application source files.`;
}

/** One line for the agent's instruction file, so every session knows the workbench exists. */
export function memoryLine(command: string) {
  return `This project previews its UI components in DesignBench (\`${command} dev\`). Before adding or changing a component, read .design-workbench/AGENT.md, and add or update that component's preview in .design-workbench/previews/ as part of the change.`;
}

/** Asks for a range of directions to compare. With MCP connected, the agent can find the component the user has open. */
export function variantsPrompt(fullCommand: string, { component, direction, count = 3 }: { component?: string; direction?: string; count?: number } = {}) {
  const { run: command, intro } = cli(fullCommand);
  const subject = component ? `the ${component} component` : 'the component I have open in DesignBench (call get_current_view to find it; if that tool is not available, ask me which one)';
  return `${intro}Create ${count} visual variants of ${subject}${direction ? `, exploring this direction: ${direction}` : ''}.

1. Read .design-workbench/AGENT.md and the component's preview fixture. Inspect its source file to find the public export.
2. For each variant, run \`${command} variant create <component-id> <variant-id> --from '<source-file>#<ExportName>' --name '<Display name>'\`, then edit the copy under .design-workbench/ideas/<component-id>/<variant-id>/. Make the variants clearly different from each other, and keep public props, behaviour, and state presets working.
3. Open each variant in the workbench (open_view, if the DesignBench MCP server is connected) and check it in the same states as the source component.
4. Tell me in a sentence what each variant changes, then stop.

Do not change application source files, and do not promote a variant until I choose one.`;
}

/** Splits a command written for a shell into arguments. Understands the single quotes this CLI writes around paths. */
function commandArgs(command: string) {
  const args: string[] = [];
  let current = '', quoted = false, started = false;
  for (let index = 0; index < command.length; index++) {
    const char = command[index];
    if (quoted) { if (char === "'") quoted = false; else current += char; }
    else if (char === "'") { quoted = true; started = true; }
    else if (char === '\\' && index + 1 < command.length) { current += command[++index]; started = true; }
    else if (/\s/.test(char)) { if (started || current) args.push(current); current = ''; started = false; }
    else current += char;
  }
  if (started || current) args.push(current);
  return args;
}

/** How one agent is told about the DesignBench MCP server: a command to run, or an entry for its settings file. */
export interface McpSetup {
  kind: 'command' | 'config';
  /** What to copy. */
  text: string;
  /** Where it goes. */
  how: string;
  /** What to do afterwards. */
  then: string;
}
export function mcpSetup(agent: AgentId, command: string): McpSetup {
  const run = `${command} mcp`;
  if (agent === 'claude') return { kind: 'command', text: `claude mcp add designbench -- ${run}`, how: 'Run this once in your project folder.', then: 'Then start a new Claude Code session in this project.' };
  if (agent === 'chatgpt') return { kind: 'command', text: `codex mcp add designbench -- ${run}`, how: 'Run this once in your project folder. Codex saves it in its own settings.', then: 'Then start a new Codex session in this project.' };
  const args = commandArgs(run);
  // Cursor does not promise to start servers in the project folder, so its entry names the folder itself.
  const server = agent === 'cursor' && args[0] === 'npx'
    ? { command: 'node', args: ['${workspaceFolder}/node_modules/designbench/cli/index.mjs', '--cwd', '${workspaceFolder}', 'mcp'] }
    : { command: args[0], args: args.slice(1) };
  // Arguments stay on one line, so the entry is short enough to read at a glance.
  const text = `{
  "mcpServers": {
    "designbench": {
      "command": ${JSON.stringify(server.command)},
      "args": [${server.args.map(arg => JSON.stringify(arg)).join(', ')}]
    }
  }
}`;
  return agent === 'cursor'
    ? { kind: 'config', text, how: 'Save this as .cursor/mcp.json in your project. If the file exists, add the designbench entry to it.', then: 'Then switch designbench on in Cursor’s MCP settings.' }
    : { kind: 'config', text, how: 'Most agents accept this entry in their MCP settings. The server must start in your project folder, or be given it with --cwd.', then: 'Then start a new session in this project.' };
}
