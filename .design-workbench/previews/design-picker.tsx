import { useState } from 'react';
import { DesignPicker } from '../../src/variant-guide.tsx';
import type { Selection, WorkbenchEntry } from '../../src/model.ts';
import { Caption, Frame } from '../frame.tsx';
import { sampleDesigns, sampleEntry, sampleThumbnail } from '../samples.ts';

export const entry: WorkbenchEntry = {
  id: 'design-picker', name: 'Design picker', group: 'Workbench parts', source: 'src/variant-guide.tsx',
  description: 'The two controls above every preview: the source component, and a menu of variants with live thumbnails.',
  width: 560, variants: ['Source showing', 'Variant showing', 'Comparing all'],
};

function Demo({ state }: { state: string }) {
  const [design, setDesign] = useState(state === 'Variant showing' ? 'ink' : 'current');
  const [compare, setCompare] = useState(state === 'Comparing all');
  const active = sampleDesigns.find(item => item.id === design)!;
  return <div style={{ display: 'grid', gap: 14, minHeight: 260, alignContent: 'start' }}>
    <DesignPicker entry={sampleEntry} designs={sampleDesigns} active={active} compare={compare} thumbnailUrl={sampleThumbnail}
      onSelect={id => { setCompare(false); setDesign(id); }} onCompare={() => setCompare(true)} />
    <Caption>{compare ? 'Showing every design side by side' : `Showing ${active.name}. Hover the source component, or open the menu.`}</Caption>
  </div>;
}

export function render(selection: Selection) {
  return <Frame><Demo key={selection.state} state={selection.state} /></Frame>;
}
