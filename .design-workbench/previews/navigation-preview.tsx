import { NavigationPreview } from '../../src/navigation-preview.tsx';
import { resolvePreviewProps, type Selection, type WorkbenchEntry } from '../../src/model.ts';
import { Caption, Frame } from '../frame.tsx';

export const entry: WorkbenchEntry = {
  id: 'navigation-preview', name: 'Sidebar hover preview', group: 'Workbench parts', source: 'src/navigation-preview.tsx',
  description: 'Hovering a component in the sidebar shows its default preview without selecting it.',
  width: 640, variants: ['Hover to open', 'Disabled'],
  propControls: {
    title: { type: 'text', label: 'Title', defaultValue: 'Button' },
    description: { type: 'text', label: 'Description', defaultValue: 'The action button used across the workbench.' },
    disabled: { type: 'boolean', label: 'Disabled', defaultValue: false, description: 'Off on phones and while the sidebar is collapsed.' },
  },
  stateProps: { Disabled: { disabled: true } },
};

export function render(selection: Selection) {
  const props = resolvePreviewProps(entry, selection);
  return <Frame>
    <div style={{ display: 'grid', gap: 12, minHeight: 340, alignContent: 'start', justifyItems: 'start' }}>
      <nav className="dw-nav" aria-label="Sample sidebar" style={{ width: 220, margin: 0, flex: 'none' }}>
        <NavigationPreview title={String(props.title)} description={String(props.description)} width={480} disabled={props.disabled === true} url="/button?state=Default">
          <a href="#button" onClick={event => event.preventDefault()}>{String(props.title)}</a>
        </NavigationPreview>
      </nav>
      <Caption>{props.disabled ? 'Hovering does nothing while disabled.' : 'Hover the link and wait a moment.'}</Caption>
    </div>
  </Frame>;
}
