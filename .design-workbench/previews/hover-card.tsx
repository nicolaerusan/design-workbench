import type { ComponentProps, ReactNode } from 'react';
import { Portal } from '@radix-ui/react-hover-card';
import { Button } from '../../src/ui/button.tsx';
import { Checkbox } from '../../src/ui/checkbox.tsx';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../../src/ui/hover-card.tsx';
import { Input } from '../../src/ui/input.tsx';
import { resolvePreviewProps, type PreviewProps, type Selection, type WorkbenchEntry } from '../../src/model.ts';
import { Frame } from '../frame.tsx';

type Side = NonNullable<ComponentProps<typeof HoverCardContent>['side']>;

/** Sidebar links and what their card shows. `width` is the preview's natural width, as in a catalog entry. */
const items: { name: string; description: string; width: number; sample: ReactNode }[] = [
  { name: 'Button', description: 'The action button used across the workbench, in six styles and three text sizes.', width: 520, sample: <Button>Use Ink in my app</Button> },
  { name: 'Checkbox', description: 'A checkbox, used for on/off properties in the inspector.', width: 300, sample: <label className="dw-toggle"><Checkbox checked aria-label="With handle" /><span>On</span></label> },
  { name: 'Input', description: 'A single-line text field, used for the sidebar search and for text and number properties in the inspector.', width: 320, sample: <Input aria-label="Label" placeholder="Button label" readOnly style={{ maxWidth: 280 }} /> },
];

export const entry: WorkbenchEntry = {
  id: 'hover-card', name: 'Hover card', group: 'Menus & overlays', source: 'src/ui/hover-card.tsx',
  description: 'A card that appears beside a link while you hover it, used for the quick previews in the component sidebar.',
  width: 620, variants: ['Closed', 'Open'],
  propControls: {
    side: { type: 'select', label: 'Side', defaultValue: 'right', options: ['right', 'bottom', 'left', 'top'], description: 'Where the card sits beside its link. It flips to the opposite side when there is no room.' },
    openDelay: { type: 'number', label: 'Open delay', defaultValue: 200, min: 0, max: 2000, description: 'Milliseconds of hovering before the card opens.' },
  },
};

/** A still copy of what the sidebar card loads in a frame: the preview's top-left corner, scaled to the card. */
function Miniature({ width, children }: { width: number; children: ReactNode }) {
  const naturalWidth = Math.max(400, Math.min(width + 64, 1200));
  const scale = 342 / naturalWidth;
  return <div className="dw-hover-canvas" aria-hidden="true" inert>
    {/* The card is portaled out of the workbench, so the sample needs its own style scope. */}
    <div className="dw-workbench" style={{ position: 'absolute', left: 0, top: 0, display: 'block', width: naturalWidth, height: 210 / scale, minHeight: 0, padding: 32, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
  </div>;
}

/** `pinned` keeps the first link's card open so it can be inspected without hovering. */
function Sample({ props, pinned }: { props: PreviewProps; pinned: boolean }) {
  return <div style={{ width: 236, padding: 8, border: '1px solid #e8e8e6', borderRadius: 10, background: '#fafaf9' }}>
    <nav className="dw-nav" aria-label="Components" style={{ margin: 0, padding: 0, overflow: 'visible' }}>
      {items.map((item, index) => <HoverCard key={item.name} open={pinned && index === 0 ? true : undefined} openDelay={Number(props.openDelay)} closeDelay={140}>
        <HoverCardTrigger asChild>
          <a href={`#${item.name.toLowerCase()}`} aria-current={index === 0 ? 'page' : undefined} onClick={event => event.preventDefault()}>{item.name}</a>
        </HoverCardTrigger>
        <Portal><HoverCardContent className="dw-hover-preview" side={props.side as Side} align="start" sideOffset={12} collisionPadding={12} role="tooltip">
          <header><strong>{item.name}</strong><p>{item.description}</p></header>
          <Miniature width={item.width}>{item.sample}</Miniature>
          <footer>Default state · select the component to explore</footer>
        </HoverCardContent></Portal>
      </HoverCard>)}
    </nav>
  </div>;
}

export function render(selection: Selection) {
  // The wrapper keeps room for the open card beside and below the links.
  return <Frame>
    <div style={{ minHeight: 380 }}>
      <Sample key={selection.state} props={resolvePreviewProps(entry, selection)} pinned={selection.state === 'Open'} />
    </div>
  </Frame>;
}
