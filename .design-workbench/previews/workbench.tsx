import { Workbench } from '../../src/workbench.tsx';
import type { CoverageItem, Selection, WorkbenchEntry } from '../../src/model.ts';
import { entry as button } from './button.tsx';
import { entry as brand } from './brand.tsx';
import { entry as fileIcon } from './file-icon.tsx';

export const entry: WorkbenchEntry = {
  id: 'workbench', name: 'Workbench', group: 'Pages', source: 'src/workbench.tsx',
  description: 'The whole workbench, browsing a few of its own parts. Open a tile to reach the component page, or Settings from the sidebar.',
  width: 1280, variants: ['Overview', 'With gaps and a draft', 'Empty', 'Needs setup'],
};

// The inner catalog holds only small parts, never this entry, so the nesting stops after one level.
const inner: WorkbenchEntry[] = [button, fileIcon, brand].map(({ contexts: _contexts, ...item }) => item);
const withDraft: WorkbenchEntry[] = [...inner, { id: 'thumbnail', name: 'Preview thumbnail', group: 'Workbench parts', source: 'src/thumbnail.tsx', description: 'Draft fixture: review props, providers, and states.', width: 640, variants: ['Default'], draft: true }];
const gaps: CoverageItem[] = [...withDraft.map(item => ({ source: item.source, status: 'previewed' as const })), { source: 'src/code-panel.tsx', status: 'missing' }, { source: 'src/properties.tsx', status: 'missing' }];

export function render(selection: Selection) {
  const state = selection.state;
  const entries = state === 'Empty' || state === 'Needs setup' ? [] : state === 'With gaps and a draft' ? withDraft : inner;
  return <Workbench key={state} project="DesignBench (inner)" projectId="designbench-self-inner" basePath="/" setupCommand="npx designbench"
    entries={entries} needsInit={state === 'Needs setup'} coverage={state === 'With gaps and a draft' ? gaps : []}
    scopeNote="Sample coverage for this preview." />;
}
