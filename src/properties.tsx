import type { WorkbenchControls } from './controls.tsx';
import { resolvePreviewProps, type Selection, type WorkbenchEntry, type PreviewProps } from './model.ts';

export function Properties({ entry, selection, controls, onChange }: {
  entry: WorkbenchEntry; selection: Selection; controls: WorkbenchControls;
  onChange: (props: PreviewProps) => void;
}) {
  const { Input, Select, Button } = controls;
  const values = resolvePreviewProps(entry, selection);
  const definitions = Object.entries(entry.propControls ?? {});
  if (!definitions.length) return <p className="dw-props-empty">This preview has no editable properties yet. Its states are defined in the fixture.</p>;
  return <section className="dw-properties" aria-label="Properties">
    <div className="dw-properties-heading"><div><h2>Properties</h2><p>Adjust this preview. A state supplies preset values; your changes are included in Share.</p></div>
      <Button variant="ghost" disabled={!selection.props} onClick={() => onChange({})}>Reset properties</Button>
    </div>
    <div className="dw-property-grid">{definitions.map(([name, control]) => {
      const label = control.label ?? name;
      const change = (value: string | number | boolean) => {
        const overrides = selection.props ? JSON.parse(selection.props) : {};
        onChange({ ...overrides, [name]: value });
      };
      return <div className="dw-property" key={name}>
        <span className="dw-property-label">{label} <code>{name}</code></span>
        {control.type === 'boolean' ? <label className="dw-toggle"><input type="checkbox" aria-label={label} checked={values[name] === true} onChange={event => change(event.target.checked)} /><span>{values[name] ? 'On' : 'Off'}</span></label>
          : control.type === 'select' ? <Select aria-label={label} value={String(values[name])} onValueChange={change} options={control.options.map(value => ({ value, label: value }))} />
          : <Input aria-label={label} type={control.type === 'number' ? 'number' : 'text'} value={String(values[name] ?? '')} min={control.type === 'number' ? control.min : undefined} max={control.type === 'number' ? control.max : undefined} step={control.type === 'number' ? 'any' : undefined} maxLength={control.type === 'text' ? 2000 : undefined} onChange={event => {
            if (control.type === 'number') { if (event.target.value !== '' && event.target.validity.valid) change(event.target.valueAsNumber); }
            else change(event.target.value);
          }} />}
        {control.description && <p>{control.description}</p>}
      </div>;
    })}</div>
  </section>;
}
