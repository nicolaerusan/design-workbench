import React from 'react';
import { resolvePreviewProps, type WorkbenchEntry, type Selection } from '@design-workbench/react';
export const entry: WorkbenchEntry = {
  id: 'welcome', name: 'Welcome button', group: 'Getting started',
  source: '.design-workbench/previews/welcome.tsx',
  description: 'A working fixture. Add your own components with design-workbench add.',
  width: 400, variants: ['Default', 'Disabled'],
  propControls: {
    label: { type: 'text', label: 'Label', defaultValue: 'Your next design', description: 'Text shown on the button.' },
    disabled: { type: 'boolean', label: 'Disabled', defaultValue: false, description: 'Prevent clicks.' },
    size: { type: 'select', label: 'Size', defaultValue: 'Medium', options: ['Small', 'Medium', 'Large'] },
    radius: { type: 'number', label: 'Corner radius', defaultValue: 10, min: 0, max: 32 },
  },
  stateProps: { Disabled: { disabled: true } },
  designs: [
    { id: 'solid', name: 'Solid', kind: 'exploration', source: '.design-workbench/previews/welcome.tsx' },
    { id: 'outline', name: 'Outline', kind: 'exploration', source: '.design-workbench/previews/welcome.tsx' },
  ],
};
export function render(selection: Selection) {
  const props = resolvePreviewProps(entry, selection);
  const solid = selection.design === 'solid';
  return <div style={{ padding: 32, fontFamily: 'system-ui' }}>
    <button disabled={props.disabled === true} style={{
      padding: props.size === 'Small' ? '8px 12px' : props.size === 'Large' ? '16px 28px' : '12px 20px', borderRadius: Number(props.radius), border: '1px solid #18181b',
      background: solid ? '#18181b' : 'white', color: solid ? 'white' : '#18181b',
      opacity: props.disabled ? 0.4 : 1,
    }}>{props.label}</button>
  </div>;
}
