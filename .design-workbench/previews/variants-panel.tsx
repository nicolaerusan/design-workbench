import { useState } from 'react';
import { VariantsPanel, type VariantActions } from '../../src/variant-guide.tsx';
import type { Selection, WorkbenchEntry } from '../../src/model.ts';
import { Frame, Panel } from '../frame.tsx';
import { sampleDesigns, sampleEntry, sampleThumbnail, sourceDesign } from '../samples.ts';

export const entry: WorkbenchEntry = {
  id: 'variants-panel', name: 'Variants panel', group: 'Workbench parts', source: 'src/variant-guide.tsx',
  description: 'The Variants tab: saved variants with thumbnails, the button that switches the app to one, and instructions for creating more.',
  width: 440, variants: ['Variant selected', 'Source selected', 'Switch refused', 'Terminal command', 'No variants'],
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
// Stand-ins for the dev server: nothing is written from a preview.
const succeed: VariantActions = { promote: async () => { await wait(700); return { status: 'applied', target: 'src/Button.tsx', backup: '.design-workbench/ideas/button/ink/before-promotion.tsx' }; } };
const refuse: VariantActions = { promote: async () => { await wait(700); throw new Error('src/Button.tsx has changed since this variant was made, so it was not replaced. Ask your agent to bring the variant up to date with the current source, then try again.'); } };

function Demo({ state }: { state: string }) {
  const designs = state === 'No variants' ? [sourceDesign] : sampleDesigns;
  const [design, setDesign] = useState(state === 'Source selected' || state === 'No variants' ? 'current' : 'ink');
  return <Panel>
    <VariantsPanel entry={sampleEntry} designs={designs} active={designs.find(item => item.id === design)!} compare={false} command="npx designbench"
      actions={state === 'Terminal command' ? undefined : state === 'Switch refused' ? refuse : succeed} thumbnailUrl={sampleThumbnail} onSelect={setDesign} />
  </Panel>;
}

export function render(selection: Selection) {
  return <Frame><Demo key={selection.state} state={selection.state} /></Frame>;
}
