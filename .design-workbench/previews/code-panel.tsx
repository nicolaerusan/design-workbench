import { useState } from 'react';
import { CodePanel, type SourceAccess } from '../../src/code-panel.tsx';
import type { Selection, WorkbenchEntry } from '../../src/model.ts';
import { Frame, Panel } from '../frame.tsx';
import { sampleCode, sampleDesigns, sampleEntry, sourceDesign } from '../samples.ts';

export const entry: WorkbenchEntry = {
  id: 'code-panel', name: 'Code panel', group: 'Workbench parts', source: 'src/code-panel.tsx',
  description: 'The Code tab: the files behind the source component and each variant, with a built-in file viewer.',
  width: 460, variants: ['Source and variants', 'Source only', 'Paths only'],
};

// Sample file contents; a real workbench reads them through the dev server.
const access: SourceAccess = {
  read: async path => path.endsWith('.json') ? JSON.stringify({ schemaVersion: 1, component: 'button', id: 'ink', name: 'Ink', source: 'src/Button.tsx', exportName: 'Button' }, null, 2) : sampleCode,
  open: () => {},
};

function Demo({ state }: { state: string }) {
  const designs = state === 'Source only' ? [sourceDesign] : sampleDesigns;
  const [design, setDesign] = useState('current');
  return <Panel width={400}>
    <CodePanel entry={sampleEntry} designs={designs} active={designs.find(item => item.id === design)!} compare={false}
      access={state === 'Paths only' ? undefined : access} onSelect={setDesign} />
  </Panel>;
}

export function render(selection: Selection) {
  return <Frame><Demo key={selection.state} state={selection.state} /></Frame>;
}
