import { useState } from 'react';
import { Properties } from '../../src/properties.tsx';
import { defaultControls } from '../../src/controls.tsx';
import { resolvePreviewProps, type PreviewProps, type Selection, type WorkbenchEntry } from '../../src/model.ts';
import { Caption, Frame, Panel } from '../frame.tsx';
import { sampleEntry } from '../samples.ts';

export const entry: WorkbenchEntry = {
  id: 'properties', name: 'Properties editor', group: 'Workbench parts', source: 'src/properties.tsx',
  description: 'Edits a preview’s properties live: text, numbers, choices, and on/off values declared by the fixture.',
  width: 440, variants: ['Defaults', 'Edited', 'No properties'],
};

function Demo({ state }: { state: string }) {
  const target = state === 'No properties' ? { ...sampleEntry, propControls: undefined, stateProps: undefined } : sampleEntry;
  const [overrides, setOverrides] = useState<PreviewProps>(state === 'Edited' ? { label: 'Publish', size: 'Large' } : {});
  const selection: Selection = { component: target.id, design: 'current', state: 'Default', viewport: 'fit', ...(Object.keys(overrides).length ? { props: JSON.stringify(overrides) } : {}) };
  return <div style={{ display: 'grid', gap: 12, justifyItems: 'start' }}>
    <Panel><Properties entry={target} selection={selection} controls={defaultControls} onChange={setOverrides} /></Panel>
    <Caption>Resolved properties: <code>{JSON.stringify(resolvePreviewProps(target, selection))}</code></Caption>
  </div>;
}

export function render(selection: Selection) {
  return <Frame><Demo key={selection.state} state={selection.state} /></Frame>;
}
