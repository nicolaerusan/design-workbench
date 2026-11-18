import { useRef, useState } from 'react';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../src/ui/resizable.tsx';
import { resolvePreviewProps, type PreviewProps, type Selection, type WorkbenchEntry } from '../../src/model.ts';
import { Caption, Frame } from '../frame.tsx';

export const entry: WorkbenchEntry = {
  id: 'resizable', name: 'Resizable panels', group: 'Navigation & layout', source: 'src/ui/resizable.tsx',
  description: 'Two panels with a draggable divider between them, used to size the inspector beside or below the preview.',
  width: 640, variants: ['Side by side', 'Stacked', 'With handle'],
  propControls: {
    direction: { type: 'select', label: 'Direction', defaultValue: 'horizontal', options: ['horizontal', 'vertical'], description: 'Horizontal puts the inspector on the right; vertical puts it below.' },
    inspectorSize: { type: 'number', label: 'Inspector size', defaultValue: 35, min: 20, max: 70, description: 'The inspector’s starting share of the space, in percent.' },
    withHandle: { type: 'boolean', label: 'With handle', defaultValue: false, description: 'Shows a grip on the divider. The workbench leaves it off.' },
  },
  stateProps: { Stacked: { direction: 'vertical' }, 'With handle': { withHandle: true } },
};

/** The preview and inspector split, with the app's hairline divider. Double-clicking the divider restores the starting size. */
function Sample({ props }: { props: PreviewProps }) {
  const horizontal = props.direction !== 'vertical';
  const size = Number(props.inspectorSize);
  const inspector = useRef<ImperativePanelHandle>(null);
  const [layout, setLayout] = useState([100 - size, size]);
  const share = (value: number) => `${Math.round(value)}% of the space`;
  return <div style={{ height: 360, maxWidth: 640, border: '1px solid #e8e8e6', borderRadius: 8, overflow: 'hidden' }}>
    <ResizablePanelGroup direction={horizontal ? 'horizontal' : 'vertical'} className={`dw-preview-workspace ${horizontal ? 'dw-dock-right' : 'dw-dock-below'}`} style={{ borderTop: 0 }} onLayout={setLayout}>
      <ResizablePanel id="canvas" order={1} minSize={20}>
        <div className="dw-preview-stage"><strong style={{ fontWeight: 600 }}>Preview</strong><Caption>{share(layout[0])}</Caption></div>
      </ResizablePanel>
      <ResizableHandle withHandle={props.withHandle === true} aria-label="Resize inspector panel" onDoubleClick={() => inspector.current?.resize(size)} />
      <ResizablePanel ref={inspector} id="inspector" order={2} defaultSize={size} minSize={20} maxSize={70}>
        <aside className="dw-controls-panel" aria-label="Preview inspector">
          <div className="dw-controls-body">
            <h2>Inspector</h2>
            <p>{share(layout[1])}. Drag the divider, or focus it and press the arrow keys. Double-click it to reset.</p>
          </div>
        </aside>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>;
}

export function render(selection: Selection) {
  return <Frame><Sample key={selection.state} props={resolvePreviewProps(entry, selection)} /></Frame>;
}
