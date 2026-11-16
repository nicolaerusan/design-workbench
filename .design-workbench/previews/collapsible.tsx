import { useState } from 'react';
import { ChevronRight, Copy } from 'lucide-react';
import { Button } from '../../src/ui/button.tsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../src/ui/collapsible.tsx';
import { resolvePreviewProps, type PreviewProps, type Selection, type WorkbenchEntry } from '../../src/model.ts';
import { Frame } from '../frame.tsx';

export const entry: WorkbenchEntry = {
  id: 'collapsible', name: 'Collapsible', group: 'Navigation & layout', source: 'src/ui/collapsible.tsx',
  description: 'A section that opens and closes under its heading, used for “Create a variant” in the Variants tab and for prompts and commands in Settings.',
  width: 420, variants: ['Closed', 'Open'],
  propControls: {
    label: { type: 'text', label: 'Label', defaultValue: 'Create a variant', description: 'The heading that opens and closes the section.' },
    disabled: { type: 'boolean', label: 'Disabled', defaultValue: false, description: 'Stops the section from being opened or closed.' },
  },
};

/** “Create a variant” from the Variants tab, inside a slice of the inspector panel. */
function Sample({ props, startOpen }: { props: PreviewProps; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return <div className="dw-controls-panel" style={{ maxWidth: 360, padding: '4px 16px', border: '1px solid #e8e8e6', borderRadius: 8 }}>
    {/* In the tab a rule separates this section from the list above it; alone, the panel edge does that. */}
    <Collapsible className="dw-create-variant" style={{ borderTop: 0 }} open={open} onOpenChange={setOpen} disabled={props.disabled === true}>
      <CollapsibleTrigger className="dw-create-variant-trigger"><ChevronRight size={14} aria-hidden="true" />{String(props.label)}</CollapsibleTrigger>
      <CollapsibleContent className="dw-create-variant-body">
        <p>Your coding agent makes variants. Copy the instructions and paste them into your agent: it copies this component into a new folder and edits the copy, leaving your app unchanged.</p>
        <Button variant="outline"><Copy size={14} aria-hidden="true" />Copy agent instructions</Button>
      </CollapsibleContent>
    </Collapsible>
  </div>;
}

export function render(selection: Selection) {
  return <Frame><Sample key={selection.state} props={resolvePreviewProps(entry, selection)} startOpen={selection.state === 'Open'} /></Frame>;
}
