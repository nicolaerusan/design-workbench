import React from 'react';
import type { WorkbenchEntry, Selection } from '@design-workbench/react';
export const entry: WorkbenchEntry = {
  id: 'welcome', name: 'Welcome button', group: 'Getting started',
  source: '.design-workbench/previews/welcome.tsx',
  description: 'A working fixture. Add your own components with design-workbench add.',
  width: 400, variants: ['Default', 'Disabled'],
  designs: [
    { id: 'solid', name: 'Solid', kind: 'exploration', source: '.design-workbench/previews/welcome.tsx' },
    { id: 'outline', name: 'Outline', kind: 'exploration', source: '.design-workbench/previews/welcome.tsx' },
  ],
};
export function render(selection: Selection) {
  const solid = selection.design === 'solid';
  return <div style={{ padding: 32, fontFamily: 'system-ui' }}>
    <button disabled={selection.state === 'Disabled'} style={{
      padding: '12px 20px', borderRadius: 10, border: '1px solid #18181b',
      background: solid ? '#18181b' : 'white', color: solid ? 'white' : '#18181b',
      opacity: selection.state === 'Disabled' ? 0.4 : 1,
    }}>Your next design</button>
  </div>;
}
