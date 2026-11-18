import { DesignBenchMark } from '../../src/brand.tsx';
import { resolvePreviewProps, type Selection, type WorkbenchEntry } from '../../src/model.ts';
import { Frame } from '../frame.tsx';

export const entry: WorkbenchEntry = {
  id: 'brand', name: 'Trestle mark', group: 'Identity', source: 'src/brand.tsx',
  description: 'DesignBench’s mark, a workbench trestle. It takes the colour of the text around it.',
  width: 420, variants: ['Mark', 'With name', 'On dark'],
  propControls: { size: { type: 'number', label: 'Size', defaultValue: 96, min: 16, max: 240 } },
  stateProps: { 'With name': { size: 20 } },
};

export function render(selection: Selection) {
  const size = Number(resolvePreviewProps(entry, selection).size);
  const dark = selection.state === 'On dark';
  return <Frame style={dark ? { background: '#20201e', color: 'white' } : undefined}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 96 }}>
      <DesignBenchMark width={size} height={size} />
      {selection.state === 'With name' && <strong style={{ fontSize: 14, fontWeight: 600 }}>DesignBench</strong>}
    </div>
  </Frame>;
}
