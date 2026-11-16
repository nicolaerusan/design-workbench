import type { ComponentProps } from 'react';
import { Component, Link2 } from 'lucide-react';
import { Button } from '../../src/ui/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../src/ui/tooltip.tsx';
import { resolvePreviewProps, type PreviewProps, type Selection, type WorkbenchEntry } from '../../src/model.ts';
import { Frame } from '../frame.tsx';

type Side = NonNullable<ComponentProps<typeof TooltipContent>['side']>;

export const entry: WorkbenchEntry = {
  id: 'tooltip', name: 'Tooltip', group: 'Menus & overlays', source: 'src/ui/tooltip.tsx',
  description: 'A short hint shown on hover or keyboard focus, used on the top bar actions, the inspector layout toggle, and the source component button.',
  width: 420, variants: ['Closed', 'Open', 'Rich content'],
  propControls: {
    text: { type: 'text', label: 'Text', defaultValue: 'Copy a link to this preview. Local links need the same project running.', description: 'What the tooltip says. In Rich content, this is its first line.' },
    side: { type: 'select', label: 'Side', defaultValue: 'top', options: ['top', 'right', 'bottom', 'left'], description: 'Where the tooltip sits beside its trigger. It flips to the opposite side when there is no room.' },
  },
  stateProps: { 'Rich content': { text: 'The Button your app uses today', side: 'bottom' } },
};

/** `pinned` keeps the tooltip open so it can be inspected without hovering. */
function Sample({ props, pinned, rich }: { props: PreviewProps; pinned: boolean; rich: boolean }) {
  const text = String(props.text);
  const side = props.side as Side;
  // The trigger sits in the middle so the tooltip has room on every side.
  return <div style={{ display: 'grid', placeItems: 'center', minHeight: 220 }}>
    {rich ? <Tooltip open={pinned ? true : undefined}>
      <TooltipTrigger asChild>
        <button type="button" className="dw-design-choice dw-design-source" aria-pressed="true"><Component size={14} aria-hidden="true" />Source component</button>
      </TooltipTrigger>
      <TooltipContent side={side} align="start" className="dw-design-source-tip">
        <strong>{text}</strong>
        <span>Rendered from <code>src/ui/button.tsx</code>. Variants are copies you can try against it; your app only changes when you choose one.</span>
      </TooltipContent>
    </Tooltip> : <div className="dw-topbar-actions">
      <Tooltip open={pinned ? true : undefined}>
        <TooltipTrigger asChild>
          <Button variant="ghost"><Link2 size={16} strokeWidth={1.65} aria-hidden="true" /><span className="dw-action-label">Share</span></Button>
        </TooltipTrigger>
        <TooltipContent side={side}>{text}</TooltipContent>
      </Tooltip>
    </div>}
  </div>;
}

export function render(selection: Selection) {
  return <Frame>
    <Sample key={selection.state} props={resolvePreviewProps(entry, selection)} pinned={selection.state !== 'Closed'} rich={selection.state === 'Rich content'} />
  </Frame>;
}
