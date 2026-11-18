import { useState } from 'react';
import { InspectorViewToggle, type InspectorView } from '../../src/preview-inspector.tsx';
import type { Selection, WorkbenchEntry } from '../../src/model.ts';
import { Caption, Frame } from '../frame.tsx';

export const entry: WorkbenchEntry = {
  id: 'inspector-view-toggle', name: 'Inspector layout toggle', group: 'Workbench parts', source: 'src/preview-inspector.tsx',
  description: 'Places the inspector below or beside the preview; choosing the active position again hides it.',
  width: 360, variants: ['Right', 'Below', 'Hidden'],
};

function Demo({ state }: { state: string }) {
  const [view, setView] = useState<InspectorView>(state.toLowerCase() as InspectorView);
  return <div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 90 }}>
    <InspectorViewToggle view={view} onViewChange={setView} />
    <Caption>Inspector: {view}</Caption>
  </div>;
}

export function render(selection: Selection) {
  return <Frame><Demo key={selection.state} state={selection.state} /></Frame>;
}
