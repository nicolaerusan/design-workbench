import { SetupGuide } from '../../src/setup-guide.tsx';
import type { CoverageItem, Selection, WorkbenchEntry } from '../../src/model.ts';
import { Frame } from '../frame.tsx';

export const entry: WorkbenchEntry = {
  id: 'settings', name: 'Settings', group: 'Pages', source: 'src/setup-guide.tsx',
  description: 'How to use DesignBench with a coding agent: pick the agent, then copy a prompt or connect it over MCP, and see what still lacks a preview.',
  width: 760, variants: ['Configured', 'With gaps', 'MCP: not connected', 'MCP: connected', 'Empty catalog', 'Needs setup'],
};

const files = ['src/Button.tsx', 'src/Card.tsx', 'src/Dialog.tsx', 'src/EmptyState.tsx', 'src/Field.tsx', 'src/Menu.tsx', 'src/Toast.tsx', 'src/Toolbar.tsx'];
const gaps: CoverageItem[] = files.map((source, index) => ({ source, status: index < 3 ? 'previewed' : 'missing' }));

// A fixed moment, so the preview reads the same every time.
const connectedAt = new Date(2026, 0, 12, 15, 42).getTime();

export function render(selection: Selection) {
  const state = selection.state;
  const mcp = state.startsWith('MCP');
  return <Frame fill style={{ display: 'flex', flexDirection: 'column' }}>
    <SetupGuide key={state} embedded command="npx designbench" needsInit={state === 'Needs setup'} empty={state === 'Empty catalog' || state === 'Needs setup'}
      coverage={state === 'With gaps' || mcp ? gaps : state === 'Configured' ? gaps.map(item => ({ ...item, status: 'previewed' as const })) : []}
      drafts={state === 'With gaps' ? 2 : 0} onShowCoverage={() => {}}
      // The CLI's workbench offers MCP; a workbench embedded in an app (the last two states) offers prompts only.
      connection={state === 'MCP: connected' ? { client: 'Claude Code', at: connectedAt } : state.startsWith('Empty') || state.startsWith('Needs') ? undefined : null}
      defaultConnect={mcp ? 'mcp' : 'prompts'} />
  </Frame>;
}
