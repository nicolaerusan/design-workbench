import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '../../src/ui/input.tsx';
import { Kbd, KbdGroup } from '../../src/ui/kbd.tsx';
import { resolvePreviewProps, type PreviewProps, type Selection, type WorkbenchEntry } from '../../src/model.ts';
import { Frame } from '../frame.tsx';

export const entry: WorkbenchEntry = {
  id: 'input', name: 'Input', group: 'Controls', source: 'src/ui/input.tsx',
  description: 'A single-line text field, used for the sidebar search and for text and number properties in the inspector.',
  width: 320, variants: ['Default', 'Filled', 'Disabled', 'Search field'],
  propControls: {
    value: { type: 'text', label: 'Value', defaultValue: '', description: 'The text the field starts with.' },
    placeholder: { type: 'text', label: 'Placeholder', defaultValue: 'Button label', description: 'Shown while the field is empty.' },
    disabled: { type: 'boolean', label: 'Disabled', defaultValue: false },
  },
  stateProps: {
    Filled: { value: 'Use Ink in my app' },
    Disabled: { value: 'Use Ink in my app', disabled: true },
    'Search field': { placeholder: 'Search' },
  },
};

/** A text property, as the inspector shows it. */
function Field({ props }: { props: PreviewProps }) {
  const [value, setValue] = useState(String(props.value));
  return <div className="dw-property" style={{ maxWidth: 280 }}>
    <span className="dw-property-label">Label <code>label</code></span>
    <Input aria-label="Label" value={value} placeholder={String(props.placeholder)} disabled={props.disabled === true} onChange={event => setValue(event.target.value)} />
  </div>;
}

/** The sidebar search: the same input inside the app's dw-search wrapper, which centres the hint and reveals the shortcut. */
function SearchField({ props }: { props: PreviewProps }) {
  const [query, setQuery] = useState(String(props.value));
  const [modifier, setModifier] = useState('⌘');
  useEffect(() => { setModifier(/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'); }, []);
  const hint = String(props.placeholder);
  return <label className="dw-search" style={{ width: 220 }}>
    <span className="dw-sr-only">{hint}</span>
    <Input aria-label={hint} placeholder={hint} value={query} disabled={props.disabled === true} onChange={event => setQuery(event.target.value)} />
    <span className="dw-search-hint" aria-hidden="true"><Search size={14} /><span>{hint}</span></span>
    <KbdGroup className="dw-search-shortcut" aria-hidden="true"><Kbd>{modifier}</Kbd><Kbd>K</Kbd></KbdGroup>
  </label>;
}

export function render(selection: Selection) {
  const props = resolvePreviewProps(entry, selection);
  return <Frame>
    {selection.state === 'Search field' ? <SearchField key={selection.state} props={props} /> : <Field key={selection.state} props={props} />}
  </Frame>;
}
