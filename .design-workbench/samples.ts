import type { DesignIdea, WorkbenchEntry } from '../src/model.ts';

/** A stand-in project component, for parts that need an entry and its designs to show anything. */
export const sampleEntry: WorkbenchEntry = {
  id: 'button', name: 'Button', group: 'Controls', source: 'src/Button.tsx',
  description: 'The primary action button.', width: 480, variants: ['Default', 'Disabled'],
  fixture: '.design-workbench/previews/button.tsx',
  propControls: {
    label: { type: 'text', label: 'Label', defaultValue: 'Save changes', description: 'The button’s visible text.' },
    size: { type: 'select', label: 'Size', defaultValue: 'Medium', options: ['Small', 'Medium', 'Large'] },
    radius: { type: 'number', label: 'Corner radius', defaultValue: 8, min: 0, max: 32 },
    disabled: { type: 'boolean', label: 'Disabled', defaultValue: false, description: 'Prevents clicks.' },
  },
  stateProps: { Disabled: { disabled: true } },
};
export const sourceDesign: DesignIdea = { id: 'current', name: 'Source component', source: 'src/Button.tsx' };
export const ink: DesignIdea = { id: 'ink', name: 'Ink', kind: 'exploration', description: 'Solid dark fill', source: '.design-workbench/ideas/button/ink/component.tsx' };
export const soft: DesignIdea = { id: 'soft', name: 'Soft', kind: 'exploration', description: 'Quiet grey fill', source: '.design-workbench/ideas/button/soft/component.tsx' };
export const sampleDesigns = [sourceDesign, ink, soft];

/** Thumbnails need something real to load: this catalog's own Button preview, styled to match each sample design. */
export function sampleThumbnail(design: string) {
  const variant = design === 'ink' ? 'default' : design === 'soft' ? 'secondary' : 'outline';
  return `/button?state=Default&props=${encodeURIComponent(JSON.stringify({ variant, label: 'Save changes' }))}`;
}
export const sampleCode = `import React, { useState } from 'react';

export function Button({ label = 'Save changes' }: { label?: string }) {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>
    {label} · {count}
  </button>;
}
`;
