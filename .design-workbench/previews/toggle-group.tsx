import { useState } from 'react';
import { PanelBottom, PanelRight } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '../../src/ui/toggle-group.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../src/ui/tooltip.tsx';
import { resolvePreviewProps, type PreviewProps, type Selection, type WorkbenchEntry } from '../../src/model.ts';
import { Caption, Frame } from '../frame.tsx';

const layouts = [
  { value: 'below', label: 'Inspector below the preview', Icon: PanelBottom },
  { value: 'right', label: 'Inspector on the right', Icon: PanelRight },
] as const;

export const entry: WorkbenchEntry = {
  id: 'toggle-group', name: 'Toggle group', group: 'Controls', source: 'src/ui/toggle-group.tsx',
  description: 'A segmented set of toggle buttons, used in the top bar to place the inspector below or beside the preview.',
  width: 300, variants: ['Default', 'None selected', 'Disabled'],
  propControls: {
    value: { type: 'select', label: 'Selected', defaultValue: 'right', options: ['below', 'right', 'none'], description: 'The option that starts selected.' },
    disabled: { type: 'boolean', label: 'Disabled', defaultValue: false },
  },
  stateProps: { 'None selected': { value: 'none' }, Disabled: { disabled: true } },
};

/** The inspector layout toggle: choosing the selected option again clears it. */
function Sample({ props }: { props: PreviewProps }) {
  const [view, setView] = useState(props.value === 'none' ? '' : String(props.value));
  return <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <ToggleGroup type="single" className="dw-view-toggle" aria-label="Inspector layout" value={view} onValueChange={setView} disabled={props.disabled === true}>
      {layouts.map(({ value, label, Icon }) => <Tooltip key={value}>
        <TooltipTrigger asChild><ToggleGroupItem value={value} aria-label={label}><Icon size={16} strokeWidth={1.65} aria-hidden="true" /></ToggleGroupItem></TooltipTrigger>
        <TooltipContent>{view === value ? 'Hide the inspector' : label}</TooltipContent>
      </Tooltip>)}
    </ToggleGroup>
    <Caption>{layouts.find(item => item.value === view)?.label ?? 'Inspector hidden'}</Caption>
  </div>;
}

export function render(selection: Selection) {
  return <Frame><Sample key={selection.state} props={resolvePreviewProps(entry, selection)} /></Frame>;
}
