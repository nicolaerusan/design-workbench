import { useState } from 'react';
import { GridToggle, VariantGrid } from '../../src/variant-grid.tsx';
import { resolvePreviewProps, type PreviewProps, type Selection, type WorkbenchEntry } from '../../src/model.ts';
import { Caption, Frame } from '../frame.tsx';
import { sampleDesigns, sampleEntry, sourceDesign } from '../samples.ts';

export const entry: WorkbenchEntry = {
  id: 'variant-grid', name: 'Variant grid', group: 'Workbench parts', source: 'src/variant-grid.tsx',
  description: 'The grid view of a component page: every variant as a row and every state as a column, each cell a live preview, with a prompt for new variants underneath.',
  width: 960, variants: ['Variants and states', 'States only', 'Variants only', 'Many states'],
  propControls: {
    label: { type: 'text', label: 'Label', defaultValue: 'Save changes', description: 'Reaches every cell at once, as an edit in the Properties tab does.' },
  },
};

// Cells need something real to load: this catalog's own Button preview, styled to stand in for each sample variant.
const looks: Record<string, string> = { current: 'outline', ink: 'default', soft: 'secondary' };
const columns: Record<string, { state?: string; props?: PreviewProps }> = {
  Default: {}, 'With icon': { state: 'With icon' }, Disabled: { state: 'Disabled' },
  Small: { props: { size: 'sm' } }, Large: { props: { size: 'lg' } },
  'Long label': { props: { label: 'Save changes and tell the team' } }, 'All styles': { state: 'All styles' },
};
const few = ['Default', 'With icon', 'Disabled'];

function Demo({ state, label }: { state: string; label: string }) {
  const designs = state === 'States only' ? [sourceDesign] : sampleDesigns;
  const button = { ...sampleEntry, variants: state === 'Variants only' ? ['Default'] : state === 'Many states' ? Object.keys(columns) : few };
  const [grid, setGrid] = useState(true);
  const [selected, setSelected] = useState({ design: 'current', state: 'Default' });
  const [opened, setOpened] = useState('');
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <GridToggle pressed={grid} onPressedChange={setGrid} hint={designs.length < 2 ? 'Every state at once' : button.variants.length < 2 ? 'Every variant at once' : undefined} />
      <Caption>{!grid ? 'One preview at a time. Press Grid to see them all.' : opened ? `Opened ${opened} on its own.` : 'Choose a cell to open it on its own.'}</Caption>
    </div>
    {grid && <VariantGrid entry={button} designs={designs} active={designs.find(design => design.id === selected.design) ?? designs[0]} state={selected.state}
      command="npx designbench" cellHref={() => '/?component=button'}
      cellUrl={(design, name) => `/button?state=${encodeURIComponent(columns[name].state ?? 'Default')}&props=${encodeURIComponent(JSON.stringify({ variant: looks[design], label, ...columns[name].props }))}`}
      onOpen={(design, name) => { setSelected({ design, state: name }); setOpened(`${designs.find(item => item.id === design)!.name}, ${name}`); }} />}
  </div>;
}

export function render(selection: Selection) {
  return <Frame fill style={{ padding: 16 }}>
    <Demo key={selection.state} state={selection.state} label={String(resolvePreviewProps(entry, selection).label)} />
  </Frame>;
}
