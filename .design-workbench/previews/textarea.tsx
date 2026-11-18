import { useState } from 'react';
import { Textarea } from '../../src/ui/textarea.tsx';
import { resolvePreviewProps, type PreviewProps, type Selection, type WorkbenchEntry } from '../../src/model.ts';
import { Frame } from '../frame.tsx';

const brief = 'Make a softer Button: tinted fill, rounder corners, same three sizes. Keep the label and the disabled state as they are.';

export const entry: WorkbenchEntry = {
  id: 'textarea', name: 'Textarea', group: 'Controls', source: 'src/ui/textarea.tsx',
  description: 'A multi-line text field, included as the default Textarea control; no workbench screen uses it yet.',
  width: 400, variants: ['Default', 'Filled', 'Disabled'],
  propControls: {
    value: { type: 'text', label: 'Value', defaultValue: '', description: 'The text the field starts with.' },
    placeholder: { type: 'text', label: 'Placeholder', defaultValue: 'Describe the variant you want to try', description: 'Shown while the field is empty.' },
    rows: { type: 'number', label: 'Rows', defaultValue: 4, min: 2, max: 12, description: 'Lines visible before the field scrolls.' },
    disabled: { type: 'boolean', label: 'Disabled', defaultValue: false },
  },
  stateProps: { Filled: { value: brief }, Disabled: { value: brief, disabled: true } },
};

function Sample({ props }: { props: PreviewProps }) {
  const [value, setValue] = useState(String(props.value));
  return <div className="dw-property" style={{ maxWidth: 360 }}>
    <span className="dw-property-label">Variant brief</span>
    <Textarea aria-label="Variant brief" rows={Number(props.rows)} value={value} placeholder={String(props.placeholder)} disabled={props.disabled === true} onChange={event => setValue(event.target.value)} />
  </div>;
}

export function render(selection: Selection) {
  return <Frame><Sample key={selection.state} props={resolvePreviewProps(entry, selection)} /></Frame>;
}
