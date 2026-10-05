'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, PanelBottom, PanelRight, RotateCcw } from 'lucide-react';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import type { WorkbenchControls } from './controls.tsx';
import type { PreviewProps, Selection, WorkbenchEntry } from './model.ts';
import { Properties } from './properties.tsx';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './ui/resizable.tsx';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './ui/collapsible.tsx';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.tsx';

export function PreviewInspector({ children, projectId, entry, selection, controls, onStateChange, onPropsChange, onViewportChange, onReset }: {
  children: ReactNode; projectId: string; entry: WorkbenchEntry; selection: Selection; controls: WorkbenchControls;
  onStateChange: (state: string) => void; onPropsChange: (props: PreviewProps) => void;
  onViewportChange: (viewport: string) => void; onReset: () => void;
}) {
  const { Button, Select } = controls;
  const storageKey = `design-workbench:${projectId}:inspector`;
  const [dock, setDock] = useState<'below' | 'right'>('below');
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);
  const workspace = useRef<HTMLDivElement>(null);
  const panel = useRef<ImperativePanelHandle>(null);
  const sizes = useRef({ width: 300, height: 280 });
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const right = dock === 'right' && bounds.width >= 580 && open;
  const extent = right ? bounds.width : bounds.height;
  const minimum = extent ? Math.min(35, (right ? 240 : 140) / extent * 100) : 20;
  const maximum = extent ? Math.max(minimum, Math.min(80, (extent - 180) / extent * 100)) : 70;
  const persist = (nextDock = dock, nextOpen = open) => {
    try { localStorage.setItem(storageKey, JSON.stringify({ dock: nextDock, open: nextOpen, ...sizes.current })); } catch {}
  };
  useEffect(() => {
    if (!workspace.current) return;
    const observer = new ResizeObserver(([entry]) => setBounds({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(workspace.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setDock('below'); setOpen(true); sizes.current = { width: 300, height: 280 };
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      if (saved?.dock === 'below' || saved?.dock === 'right') setDock(saved.dock);
      if (typeof saved?.open === 'boolean') setOpen(saved.open);
      if (Number.isFinite(saved?.width) && Number.isFinite(saved?.height)) sizes.current = { width: Math.max(240, Math.min(900, saved.width)), height: Math.max(140, Math.min(900, saved.height)) };
    } catch {}
    setReady(true);
  }, [storageKey]);
  useEffect(() => {
    if (!ready || !extent) return;
    panel.current?.resize(open ? Math.max(minimum, Math.min(maximum, (right ? sizes.current.width : sizes.current.height) / extent * 100)) : 48 / extent * 100);
  }, [ready, extent, right, open, minimum, maximum]);
  const change = (nextDock: typeof dock, nextOpen: boolean) => {
    persist(nextDock, nextOpen); setDock(nextDock); setOpen(nextOpen);
  };
  return <div ref={workspace} className="dw-workspace-container">
    <ResizablePanelGroup direction={right ? 'horizontal' : 'vertical'} className={`dw-preview-workspace ${right ? 'dw-dock-right' : 'dw-dock-below'} ${open ? '' : 'dw-controls-collapsed'}`}>
      <ResizablePanel id="canvas" order={1} minSize={20}>
        <div className="dw-preview-stage">{children}</div>
      </ResizablePanel>
      <ResizableHandle withHandle disabled={!open} className={open ? '' : 'dw-hidden-handle'} aria-label="Resize properties panel"
        onDragging={dragging => {
          if (dragging || !ready || !extent) return;
          const value = (panel.current?.getSize() ?? 0) / 100 * extent;
          if (open) { sizes.current[right ? 'width' : 'height'] = value; persist(); }
        }}
        onKeyUp={() => { if (open && extent) { sizes.current[right ? 'width' : 'height'] = (panel.current?.getSize() ?? 0) / 100 * extent; persist(); } }}
        onDoubleClick={() => { sizes.current[right ? 'width' : 'height'] = right ? 300 : 280; panel.current?.resize(Math.min(maximum, (right ? 300 : 280) / extent * 100)); persist(); }} />
      <ResizablePanel ref={panel} id="inspector" order={2} defaultSize={35} minSize={open ? minimum : 0} maxSize={open ? maximum : 100}>
        <Collapsible asChild open={open} onOpenChange={value => change(dock, value)}>
          <aside className="dw-controls-panel" aria-label="Preview inspector">
            <header className="dw-controls-header">
              <CollapsibleTrigger asChild><Button variant="ghost" className="dw-controls-toggle">
                {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}<strong>Properties &amp; states</strong>
                <span className="dw-controls-summary">{selection.state}{selection.props ? ' · Modified' : ''}</span>
              </Button></CollapsibleTrigger>
              <div className="dw-dock-choices" role="group" aria-label="Inspector position">
                <Tooltip><TooltipTrigger asChild><Button variant="ghost" aria-label="Dock inspector below" aria-pressed={dock === 'below'} onClick={() => change('below', open)}><PanelBottom size={16} aria-hidden="true" /></Button></TooltipTrigger><TooltipContent>Stack below the preview</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button variant="ghost" aria-label="Dock inspector right" aria-pressed={dock === 'right'} onClick={() => change('right', open)}><PanelRight size={16} aria-hidden="true" /></Button></TooltipTrigger><TooltipContent>Dock on the right. Stacks below in narrow panels.</TooltipContent></Tooltip>
              </div>
            </header>
            <CollapsibleContent className="dw-controls-body">
              <div className="dw-inspector-tools">
                <label><span>Viewport</span><Select aria-label="Viewport" value={selection.viewport} onValueChange={onViewportChange} options={[{value:'fit',label:'Fit panel'},{value:'375',label:'375 · Mobile'},{value:'768',label:'768 · Tablet'},{value:'1280',label:'1280 · Desktop'}]} /></label>
                <Tooltip><TooltipTrigger asChild><Button variant="ghost" onClick={onReset}><RotateCcw size={16} aria-hidden="true" /> Reset</Button></TooltipTrigger><TooltipContent>Restart the preview with the current properties</TooltipContent></Tooltip>
              </div>
              <div className="dw-state-preset">
                <label><span>State preset</span><Select aria-label="State preset" value={selection.state} onValueChange={onStateChange} options={entry.variants.map(value => ({ value, label: value }))} /></label>
                <p>A named scenario, such as Loading or Disabled. Choosing one resets your property edits.</p>
              </div>
              <Properties entry={entry} selection={selection} controls={controls} onChange={onPropsChange} />
            </CollapsibleContent>
          </aside>
        </Collapsible>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>;
}
