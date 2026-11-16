import { useState, type ComponentProps } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../src/ui/button.tsx';
import { resolvePreviewProps, type PreviewProps, type Selection, type WorkbenchEntry } from '../../src/model.ts';
import { Caption, Frame } from '../frame.tsx';

type ButtonProps = ComponentProps<typeof Button>;
const styles = ['default', 'outline', 'secondary', 'ghost', 'link', 'destructive'];

export const entry: WorkbenchEntry = {
  id: 'button', name: 'Button', group: 'Controls', source: 'src/ui/button.tsx',
  description: 'The action button used across the workbench, in six styles and three text sizes.',
  width: 520, variants: ['Default', 'With icon', 'Disabled', 'All styles'],
  propControls: {
    label: { type: 'text', label: 'Label', defaultValue: 'Use Ink in my app', description: 'The button’s visible text.' },
    variant: { type: 'select', label: 'Style', defaultValue: 'default', options: styles },
    size: { type: 'select', label: 'Size', defaultValue: 'default', options: ['sm', 'default', 'lg'] },
    disabled: { type: 'boolean', label: 'Disabled', defaultValue: false },
  },
  stateProps: { Disabled: { disabled: true } },
};

function Sample({ props, icon }: { props: PreviewProps; icon: boolean }) {
  const [clicks, setClicks] = useState(0);
  return <div style={{ display: 'grid', justifyItems: 'start', gap: 12 }}>
    <Button variant={props.variant as ButtonProps['variant']} size={props.size as ButtonProps['size']} disabled={props.disabled === true} onClick={() => setClicks(value => value + 1)}>
      {icon && <Plus aria-hidden="true" />}{props.label}
    </Button>
    <Caption>{clicks ? `Clicked ${clicks} ${clicks === 1 ? 'time' : 'times'}` : 'Click to try it'}</Caption>
  </div>;
}

export function render(selection: Selection) {
  const props = resolvePreviewProps(entry, selection);
  if (selection.state === 'All styles') return <Frame>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
      {styles.map(variant => <Button key={variant} variant={variant as ButtonProps['variant']} size={props.size as ButtonProps['size']} disabled={props.disabled === true}>{variant}</Button>)}
    </div>
  </Frame>;
  return <Frame><Sample key={selection.state} props={props} icon={selection.state === 'With icon'} /></Frame>;
}
