import { useState } from 'react';
import { ContextPanel } from '../../src/contexts.tsx';
import { defaultControls } from '../../src/controls.tsx';
import type { Selection, WorkbenchEntry } from '../../src/model.ts';
import { Caption, Frame, Panel } from '../frame.tsx';
import { entry as buttonEntry } from './button.tsx';

export const entry: WorkbenchEntry = {
  id: 'contexts', name: 'Used in context', group: 'Workbench parts', source: 'src/contexts.tsx',
  description: 'Shows a component inside larger parts of the app that use it, and lists the components a composition contains.',
  width: 520, variants: ['Used in', 'Contains'],
};

// A small pretend app: a Button that appears inside a toolbar, which is this catalog's real Button preview.
const toolbar: WorkbenchEntry = { ...buttonEntry, name: 'Save toolbar', description: 'The editor’s save actions.' };
const child: WorkbenchEntry = {
  id: 'save-button', name: 'Save button', group: 'Controls', source: 'src/SaveButton.tsx', description: 'Saves the document.', width: 320, variants: ['Default'],
  contexts: [
    { id: 'toolbar', name: 'In the save toolbar', componentId: toolbar.id, state: 'All styles', description: 'Next to Cancel and Discard.', usage: { file: 'src/Toolbar.tsx', symbol: 'Toolbar', description: 'Rendered as the toolbar’s primary action.' } },
    { id: 'dialog', name: 'In a confirm dialog', componentId: toolbar.id, state: 'With icon', description: 'An illustrative composition.' },
  ],
};
const entries = [toolbar, child];

function Demo({ state }: { state: string }) {
  const [last, setLast] = useState('');
  return <div style={{ display: 'grid', gap: 12, justifyItems: 'start' }}>
    <Panel width={440}><div className="dw-panel-stack"><ContextPanel entry={state === 'Contains' ? toolbar : child} entries={entries} basePath="/" controls={defaultControls}
      navigate={selection => setLast(`Would open ${selection.component}`)} /></div></Panel>
    <Caption>{last || 'Choose a context to render it below the list.'}</Caption>
  </div>;
}

export function render(selection: Selection) {
  return <Frame><Demo key={selection.state} state={selection.state} /></Frame>;
}
