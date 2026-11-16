import { useState } from 'react';
import { Checkbox } from '../../src/ui/checkbox.tsx';
import { resolvePreviewProps, type PreviewProps, type Selection, type WorkbenchEntry } from '../../src/model.ts';
import { Frame } from '../frame.tsx';

export const entry: WorkbenchEntry = {
  id: 'checkbox', name: 'Checkbox', group: 'Controls', source: 'src/ui/checkbox.tsx',
  description: 'A checkbox, used for on/off properties in the inspector.',
  width: 300, variants: ['Unchecked', 'Checked', 'Disabled'],
  propControls: {
    label: { type: 'text', label: 'Label', defaultValue: 'With handle', description: 'The name of the property the checkbox switches.' },
    checked: { type: 'boolean', label: 'Checked', defaultValue: false, description: 'Whether the checkbox starts on.' },
    disabled: { type: 'boolean', label: 'Disabled', defaultValue: false },
  },
  stateProps: { Checked: { checked: true }, Disabled: { checked: true, disabled: true } },
};

/** An on/off property, as the inspector shows it. */
function Sample({ props }: { props: PreviewProps }) {
  const [checked, setChecked] = useState(props.checked === true);
  const label = String(props.label);
  return <div className="dw-property" style={{ alignItems: 'flex-start' }}>
    <span className="dw-property-label">{label}</span>
    <label className="dw-toggle">
      <Checkbox aria-label={label} checked={checked} disabled={props.disabled === true} onCheckedChange={value => setChecked(value === true)} />
      <span>{checked ? 'On' : 'Off'}</span>
    </label>
  </div>;
}

export function render(selection: Selection) {
  return <Frame><Sample key={selection.state} props={resolvePreviewProps(entry, selection)} /></Frame>;
}
