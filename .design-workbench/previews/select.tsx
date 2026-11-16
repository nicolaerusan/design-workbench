import { useState } from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '../../src/ui/select.tsx';
import { resolvePreviewProps, type PreviewProps, type Selection, type WorkbenchEntry } from '../../src/model.ts';
import { Frame } from '../frame.tsx';

const presets = ['Default', 'With icon', 'Disabled', 'All styles'];
const fixedWidths = ['375 · Mobile', '768 · Tablet', '1280 · Desktop'];

export const entry: WorkbenchEntry = {
  id: 'select', name: 'Select', group: 'Controls', source: 'src/ui/select.tsx',
  description: 'A dropdown for choosing one option, used for the state preset and for choice properties in the inspector.',
  width: 360, variants: ['Default', 'Open', 'With groups', 'Disabled'],
  // No text controls here: an open list takes keyboard focus each time the preview reloads, which would interrupt typing.
  propControls: {
    disabled: { type: 'boolean', label: 'Disabled', defaultValue: false },
  },
  stateProps: { Disabled: { disabled: true } },
};

/** The inspector's "State preset" row. `pinned` keeps the list open so it can be inspected; choosing an option still updates the value. */
function Sample({ props, pinned, grouped }: { props: PreviewProps; pinned: boolean; grouped: boolean }) {
  const [value, setValue] = useState(grouped ? 'Fit panel' : presets[0]);
  const label = grouped ? 'Viewport' : 'State preset';
  return <div className="dw-state-preset" style={{ margin: 0, padding: 0, border: 0 }}>
    <label>
      <span>{label}</span>
      <Select value={value} onValueChange={setValue} disabled={props.disabled === true} open={pinned ? true : undefined}>
        <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
        <SelectContent>
          {grouped ? <>
            <SelectItem value="Fit panel">Fit panel</SelectItem>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Fixed widths</SelectLabel>
              {fixedWidths.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
            </SelectGroup>
          </> : presets.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
        </SelectContent>
      </Select>
    </label>
  </div>;
}

export function render(selection: Selection) {
  const grouped = selection.state === 'With groups';
  // The wrapper keeps room below the trigger for the open list.
  return <Frame>
    <div style={{ minHeight: 240 }}>
      <Sample key={selection.state} props={resolvePreviewProps(entry, selection)} pinned={grouped || selection.state === 'Open'} grouped={grouped} />
    </div>
  </Frame>;
}
