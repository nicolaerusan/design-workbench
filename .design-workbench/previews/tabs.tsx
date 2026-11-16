import { useState, type ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../src/ui/tabs.tsx';
import { resolvePreviewProps, type PreviewProps, type Selection, type WorkbenchEntry } from '../../src/model.ts';
import { Frame } from '../frame.tsx';

/** The inspector's sections, each with a short stand-in for its real content. */
const sections: { id: string; label: string; content: ReactNode }[] = [
  { id: 'properties', label: 'Properties', content: <p className="dw-props-empty">This preview has no editable properties yet. Its states are defined in the fixture.</p> },
  { id: 'code', label: 'Code', content: <div className="dw-code"><h2>Files</h2><p>The code behind this preview. Your app stays unchanged; DesignBench only reads it.</p></div> },
  { id: 'variants', label: 'Variants', content: <div className="dw-variants"><h2>Variants</h2><p>Variants are other versions of this component, registered in your catalog. Selecting one only changes the preview.</p><p className="dw-variants-empty">No variants yet.</p></div> },
];

export const entry: WorkbenchEntry = {
  id: 'tabs', name: 'Tabs', group: 'Navigation & layout', source: 'src/ui/tabs.tsx',
  description: 'Tabs that switch between the sections of a panel, used for Properties, Code, and Variants in the inspector.',
  width: 400, variants: ['Three tabs', 'One tab'],
  propControls: {
    tab: { type: 'select', label: 'Open tab', defaultValue: 'properties', options: ['properties', 'code', 'variants'], description: 'The tab that starts open.' },
    width: { type: 'number', label: 'Panel width', defaultValue: 340, min: 160, max: 640, description: 'In pixels. The tab row scrolls sideways when the tabs do not fit.' },
  },
};

function Sample({ props, single }: { props: PreviewProps; single: boolean }) {
  const shown = single ? sections.slice(0, 1) : sections;
  const [tab, setTab] = useState(String(props.tab));
  // As in the inspector, a tab that is not on offer falls back to Properties.
  const active = shown.some(item => item.id === tab) ? tab : 'properties';
  return <aside className="dw-controls-panel" aria-label="Preview inspector" style={{ width: Number(props.width), maxWidth: '100%', height: 260, border: '1px solid #e8e8e6', borderRadius: 8 }}>
    <Tabs value={active} onValueChange={setTab} className="dw-inspector-tabs">
      <TabsList className="dw-inspector-tablist" aria-label="Inspector sections">
        {shown.map(item => <TabsTrigger key={item.id} value={item.id}>{item.label}</TabsTrigger>)}
      </TabsList>
      {/* Mounted while hidden, as in the inspector. */}
      {shown.map(item => <TabsContent key={item.id} value={item.id} forceMount className="dw-controls-body">{item.content}</TabsContent>)}
    </Tabs>
  </aside>;
}

export function render(selection: Selection) {
  return <Frame><Sample key={selection.state} props={resolvePreviewProps(entry, selection)} single={selection.state === 'One tab'} /></Frame>;
}
