'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PanelBottom, PanelRight, RotateCcw } from 'lucide-react';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import type { WorkbenchControls } from './controls.tsx';
import type { PreviewProps, Selection, WorkbenchEntry } from './model.ts';
import { Properties } from './properties.tsx';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './ui/resizable.tsx';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs.tsx';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group.tsx';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.tsx';

/** Where the inspector sits around the preview. */
export type InspectorView = 'below' | 'right' | 'hidden';
/** An extra inspector tab, shown after Properties. */
export interface InspectorPanel { id: string; label: string; content: ReactNode }

const views: InspectorView[] = ['below', 'right', 'hidden'];

/** The inspector position is a per-project view preference. */
export function useInspectorView(projectId: string): [InspectorView, (view: InspectorView) => void] {
  const key = `design-workbench:${projectId}:inspector-view`;
  const [view, setView] = useState<InspectorView>('right');
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      setView(views.includes(saved as InspectorView) ? saved as InspectorView : 'right');
    } catch {}
  }, [key]);
  return [view, (next: InspectorView) => {
    setView(next);
    try { localStorage.setItem(key, next); } catch {}
  }];
}

/** Choosing the active position again hides the inspector. */
export function InspectorViewToggle({ view, onViewChange }: { view: InspectorView; onViewChange: (view: InspectorView) => void }) {
  const items = [
    { value: 'below', label: 'Inspector below the preview', Icon: PanelBottom },
    { value: 'right', label: 'Inspector on the right', Icon: PanelRight },
  ] as const;
  return <ToggleGroup type="single" className="dw-view-toggle" aria-label="Inspector layout"
    value={view === 'hidden' ? '' : view} onValueChange={value => onViewChange((value || 'hidden') as InspectorView)}>
    {items.map(({ value, label, Icon }) => <Tooltip key={value}>
      <TooltipTrigger asChild><ToggleGroupItem value={value} aria-label={label}><Icon size={16} strokeWidth={1.65} aria-hidden="true" /></ToggleGroupItem></TooltipTrigger>
      <TooltipContent>{view === value ? 'Hide the inspector' : label}</TooltipContent>
    </Tooltip>)}
  </ToggleGroup>;
}

export function PreviewInspector({ children, toolbar, panels = [], view: controlledView, onViewChange, projectId, entry, selection, controls, onStateChange, onPropsChange, onViewportChange, onReset }: {
  children: ReactNode; projectId: string; entry: WorkbenchEntry; selection: Selection; controls: WorkbenchControls;
  onStateChange: (state: string) => void; onPropsChange: (props: PreviewProps) => void;
  onViewportChange: (viewport: string) => void; onReset: () => void;
  /** Leading content for the canvas toolbar, such as a variant picker. */
  toolbar?: ReactNode;
  /** Extra inspector tabs. */
  panels?: InspectorPanel[];
  /** Control the position from elsewhere, such as a page header. Uncontrolled inspectors show their own toggle. */
  view?: InspectorView; onViewChange?: (view: InspectorView) => void;
}) {
  const { Button, Select } = controls;
  const [ownView, setOwnView] = useInspectorView(projectId);
  const controlled = controlledView !== undefined;
  const view = controlledView ?? ownView;
  const setView = onViewChange ?? setOwnView;
  const [tab, setTab] = useState('properties');
  const activeTab = tab === 'properties' || panels.some(item => item.id === tab) ? tab : 'properties';
  const storageKey = `design-workbench:${projectId}:inspector`;
  const [ready, setReady] = useState(false);
  const workspace = useRef<HTMLDivElement>(null);
  const panel = useRef<ImperativePanelHandle>(null);
  const sizes = useRef({ width: 340, height: 300 });
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const open = view !== 'hidden';
  // Narrow workspaces stack the inspector below whatever was chosen.
  const right = view === 'right' && bounds.width >= 640;
  const extent = right ? bounds.width : bounds.height;
  const minimum = extent ? Math.min(45, (right ? 280 : 160) / extent * 100) : 20;
  const maximum = extent ? Math.max(minimum, Math.min(75, (extent - 240) / extent * 100)) : 70;
  const persist = () => { try { localStorage.setItem(storageKey, JSON.stringify(sizes.current)); } catch {} };
  const remember = () => {
    if (!extent) return;
    sizes.current[right ? 'width' : 'height'] = (panel.current?.getSize() ?? 0) / 100 * extent;
    persist();
  };
  useEffect(() => {
    if (!workspace.current) return;
    const observer = new ResizeObserver(([item]) => setBounds({ width: item.contentRect.width, height: item.contentRect.height }));
    observer.observe(workspace.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    sizes.current = { width: 340, height: 300 };
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      if (Number.isFinite(saved?.width) && Number.isFinite(saved?.height)) sizes.current = { width: Math.max(280, Math.min(900, saved.width)), height: Math.max(160, Math.min(900, saved.height)) };
    } catch {}
    setReady(true);
  }, [storageKey]);
  useEffect(() => {
    if (!ready || !extent || !open) return;
    panel.current?.resize(Math.max(minimum, Math.min(maximum, (right ? sizes.current.width : sizes.current.height) / extent * 100)));
  }, [ready, extent, right, open, minimum, maximum]);
  return <div ref={workspace} className="dw-workspace-container">
    <ResizablePanelGroup direction={right ? 'horizontal' : 'vertical'} className={`dw-preview-workspace ${right ? 'dw-dock-right' : 'dw-dock-below'}`}>
      <ResizablePanel id="canvas" order={1} minSize={20}>
        <div className="dw-preview-stage">
          <div className="dw-stage-toolbar">
            <div className="dw-stage-toolbar-start">{toolbar}</div>
            <div className="dw-stage-toolbar-end">
              <label className="dw-viewport"><span>Viewport</span><Select aria-label="Viewport" value={selection.viewport} onValueChange={onViewportChange} options={[{ value: 'fit', label: 'Fit panel' }, { value: '375', label: '375 · Mobile' }, { value: '768', label: '768 · Tablet' }, { value: '1280', label: '1280 · Desktop' }]} /></label>
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" className="dw-stage-reset" onClick={onReset}><RotateCcw size={15} aria-hidden="true" /> Reset</Button></TooltipTrigger><TooltipContent>Restart the preview with the current properties</TooltipContent></Tooltip>
              {!controlled && <InspectorViewToggle view={view} onViewChange={setView} />}
            </div>
          </div>
          {children}
        </div>
      </ResizablePanel>
      {open && <>
        <ResizableHandle aria-label="Resize inspector panel" onDragging={dragging => { if (!dragging) remember(); }} onKeyUp={remember}
          onDoubleClick={() => { sizes.current[right ? 'width' : 'height'] = right ? 340 : 300; panel.current?.resize(Math.max(minimum, Math.min(maximum, (right ? 340 : 300) / extent * 100))); persist(); }} />
        <ResizablePanel ref={panel} id="inspector" order={2} defaultSize={35} minSize={minimum} maxSize={maximum}>
          <aside className="dw-controls-panel" aria-label="Preview inspector">
            <Tabs value={activeTab} onValueChange={setTab} className="dw-inspector-tabs">
              <TabsList className="dw-inspector-tablist" aria-label="Inspector sections">
                <TabsTrigger value="properties">Properties</TabsTrigger>
                {panels.map(item => <TabsTrigger key={item.id} value={item.id}>{item.label}</TabsTrigger>)}
              </TabsList>
              {/* Mounted while hidden, so drafts survive switching tabs. */}
              <TabsContent value="properties" forceMount className="dw-controls-body">
                <div className="dw-state-preset">
                  <label><span>State preset</span><Select aria-label="State preset" value={selection.state} onValueChange={onStateChange} options={entry.variants.map(value => ({ value, label: value }))} /></label>
                  <p>A named scenario, such as Loading or Disabled. Choosing one resets your property edits.</p>
                </div>
                <Properties entry={entry} selection={selection} controls={controls} onChange={onPropsChange} />
              </TabsContent>
              {panels.map(item => <TabsContent key={item.id} value={item.id} forceMount className="dw-controls-body">{item.content}</TabsContent>)}
            </Tabs>
          </aside>
        </ResizablePanel>
      </>}
    </ResizablePanelGroup>
  </div>;
}
