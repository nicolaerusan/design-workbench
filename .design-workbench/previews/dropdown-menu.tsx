import { useState } from 'react';
import { ChevronDown, Layers, MonitorSmartphone, RotateCcw } from 'lucide-react';
import { Button } from '../../src/ui/button.tsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../../src/ui/dropdown-menu.tsx';
import { resolvePreviewProps, type Selection, type WorkbenchEntry } from '../../src/model.ts';
import { Caption, Frame } from '../frame.tsx';

const viewports = [
  { value: 'fit', label: 'Fit panel', short: 'Fit' },
  { value: '375', label: '375 · Mobile', short: '375' },
  { value: '768', label: '768 · Tablet', short: '768' },
  { value: '1280', label: '1280 · Desktop', short: '1280' },
];
const variants = [
  { id: 'ink', name: 'Ink', description: 'Solid dark fill' },
  { id: 'soft', name: 'Soft', description: 'Quiet grey fill' },
];

export const entry: WorkbenchEntry = {
  id: 'dropdown-menu', name: 'Dropdown menu', group: 'Menus & overlays', source: 'src/ui/dropdown-menu.tsx',
  description: 'A menu that opens from a button, used for the View options above the preview and for the variant picker.',
  width: 420, variants: ['Closed', 'Open', 'Variants menu'],
  propControls: {
    menu: { type: 'select', label: 'Menu', defaultValue: 'view', options: ['view', 'variants'], description: 'Which of the workbench’s two menus to show.' },
  },
  stateProps: { 'Variants menu': { menu: 'variants' } },
};

/** The View menu: a labelled group of single-choice items, a separator, and an action with a second line. */
function ViewMenu({ open }: { open: boolean }) {
  const [viewport, setViewport] = useState('fit');
  const [resets, setResets] = useState(0);
  const current = viewports.find(item => item.value === viewport) ?? viewports[0];
  return <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 360 }}>
    <Caption>Viewport: {current.label}.{resets ? ` Preview reset ${resets} ${resets === 1 ? 'time' : 'times'}.` : ''}</Caption>
    <div className="dw-stage-toolbar-end">
      <DropdownMenu defaultOpen={open}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="dw-view-menu-trigger" aria-label={`View options. Viewport: ${current.label}`}>
            <MonitorSmartphone size={15} aria-hidden="true" />View<span className="dw-view-menu-value">{current.short}</span><ChevronDown size={14} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="dw-view-menu">
          <DropdownMenuLabel>Viewport</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={viewport} onValueChange={setViewport}>
            {viewports.map(item => <DropdownMenuRadioItem key={item.value} value={item.value}>{item.label}</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setResets(value => value + 1)}><RotateCcw size={15} aria-hidden="true" /><span>Reset preview<small>Restart with the current properties</small></span></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>;
}

/** The variant picker's menu: items with a name and a description (shown here without thumbnails). */
function VariantMenu({ open }: { open: boolean }) {
  const [choice, setChoice] = useState('');
  const active = variants.find(item => item.id === choice);
  const compare = choice === 'compare';
  return <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <DropdownMenu defaultOpen={open}>
      <DropdownMenuTrigger asChild>
        <button type="button" className="dw-design-choice dw-design-variants" data-active={compare || !!active}
          aria-label={compare ? 'Variant: comparing all' : active ? `Variant: ${active.name}` : `Variants, ${variants.length} available`}>
          <Layers size={14} aria-hidden="true" />
          {compare || active
            ? <><span className="dw-design-variant-label">Variant</span><span className="dw-design-variant-value">{active ? active.name : 'Compare all'}</span></>
            : <><span>Variants</span><span className="dw-design-count">{variants.length}</span></>}
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="dw-design-menu">
        <DropdownMenuLabel>Variants of Button</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={choice} onValueChange={setChoice}>
          {variants.map(item => <DropdownMenuRadioItem key={item.id} value={item.id} className="dw-design-menu-item">
            <span className="dw-design-menu-text"><span>{item.name}</span><small>{item.description}</small></span>
          </DropdownMenuRadioItem>)}
          <DropdownMenuSeparator />
          <DropdownMenuRadioItem value="compare">Compare all side by side</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
    <Caption>{compare ? 'Comparing every design' : active ? `Previewing ${active.name}` : 'Showing the source component'}</Caption>
  </div>;
}

export function render(selection: Selection) {
  const props = resolvePreviewProps(entry, selection);
  const open = selection.state !== 'Closed';
  // The wrapper keeps room below the trigger for the open menu.
  return <Frame>
    <div style={{ minHeight: 280 }}>
      {props.menu === 'variants' ? <VariantMenu key={selection.state} open={open} /> : <ViewMenu key={selection.state} open={open} />}
    </div>
  </Frame>;
}
