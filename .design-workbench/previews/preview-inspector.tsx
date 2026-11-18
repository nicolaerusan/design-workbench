import { useState } from 'react';
import { PreviewInspector, type InspectorView } from '../../src/preview-inspector.tsx';
import { DesignPicker } from '../../src/variant-guide.tsx';
import { Button } from '../../src/ui/button.tsx';
import { defaultControls } from '../../src/controls.tsx';
import { resolvePreviewProps, type Selection, type WorkbenchEntry } from '../../src/model.ts';
import { Frame } from '../frame.tsx';
import { sampleDesigns, sampleEntry } from '../samples.ts';

export const entry: WorkbenchEntry = {
  id: 'preview-inspector', name: 'Preview and inspector', group: 'Workbench parts', source: 'src/preview-inspector.tsx',
  description: 'The component page’s working area: the preview stage with its toolbar, and a resizable inspector beside or below it.',
  width: 1000, variants: ['Inspector right', 'Inspector below', 'Inspector hidden'],
};

const views: Record<string, InspectorView> = { 'Inspector right': 'right', 'Inspector below': 'below', 'Inspector hidden': 'hidden' };

function Demo({ state }: { state: string }) {
  const [view, setView] = useState<InspectorView>(views[state] ?? 'right');
  const [selection, setSelection] = useState<Selection>({ component: sampleEntry.id, design: 'current', state: 'Default', viewport: 'fit' });
  const [design, setDesign] = useState('current');
  const [reset, setReset] = useState(0);
  const props = resolvePreviewProps(sampleEntry, selection);
  return <div className="dw-main">
    <PreviewInspector projectId="designbench-self-inspector" entry={sampleEntry} selection={selection} controls={defaultControls} view={view} onViewChange={setView}
      onStateChange={next => setSelection(current => ({ ...current, state: next, props: undefined }))}
      onPropsChange={next => setSelection(current => ({ ...current, props: JSON.stringify(next) }))}
      onViewportChange={viewport => setSelection(current => ({ ...current, viewport }))} onReset={() => setReset(value => value + 1)}
      toolbar={<DesignPicker entry={sampleEntry} designs={sampleDesigns} active={sampleDesigns.find(item => item.id === design)!} compare={false} onSelect={setDesign} onCompare={() => {}} />}
      panels={[{ id: 'notes', label: 'Notes', content: <p>Extra tabs, such as Code and Variants, appear after Properties.</p> }]}>
      <div className="dw-previews"><section className="dw-preview-card"><div className="dw-canvas" style={{ background: 'white' }}>
        <div key={reset} style={{ padding: 32, width: selection.viewport === 'fit' ? '100%' : Number(selection.viewport) }}>
          <Button size={props.size === 'Small' ? 'sm' : props.size === 'Large' ? 'lg' : 'default'} variant={design === 'soft' ? 'secondary' : design === 'ink' ? 'default' : 'outline'}
            disabled={props.disabled === true} style={{ borderRadius: Number(props.radius) }}>{props.label}</Button>
        </div>
      </div></section></div>
    </PreviewInspector>
  </div>;
}

export function render(selection: Selection) {
  return <Frame fill><Demo key={selection.state} state={selection.state} /></Frame>;
}
