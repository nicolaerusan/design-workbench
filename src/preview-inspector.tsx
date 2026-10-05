'use client';
import { useEffect, useId, useState, type ReactNode } from 'react';
import type { WorkbenchControls } from './controls.tsx';
import type { PreviewProps, Selection, WorkbenchEntry } from './model.ts';
import { Properties } from './properties.tsx';

export function PreviewInspector({ children, projectId, entry, selection, controls, onStateChange, onPropsChange }: {
  children: ReactNode; projectId: string; entry: WorkbenchEntry; selection: Selection; controls: WorkbenchControls;
  onStateChange: (state: string) => void; onPropsChange: (props: PreviewProps) => void;
}) {
  const { Button, Select } = controls;
  const bodyId = useId();
  const storageKey = `design-workbench:${projectId}:inspector`;
  const [dock, setDock] = useState<'below' | 'right'>('below');
  const [open, setOpen] = useState(true);
  useEffect(() => {
    setDock('below'); setOpen(true);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      if (saved?.dock === 'below' || saved?.dock === 'right') setDock(saved.dock);
      if (typeof saved?.open === 'boolean') setOpen(saved.open);
    } catch {}
  }, [storageKey]);
  const change = (nextDock: typeof dock, nextOpen: boolean) => {
    setDock(nextDock); setOpen(nextOpen);
    try { localStorage.setItem(storageKey, JSON.stringify({ dock: nextDock, open: nextOpen })); } catch {}
  };
  return <div className="dw-workspace-container">
    <div className={`dw-preview-workspace dw-dock-${dock} ${open ? '' : 'dw-controls-collapsed'}`}>
      <div className="dw-preview-stage">{children}</div>
      <aside className="dw-controls-panel" aria-label="Preview inspector">
        <header className="dw-controls-header">
          <Button variant="ghost" className="dw-controls-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => change(dock, !open)}>
            <span aria-hidden="true">{open ? '▾' : '▸'}</span><strong>Properties &amp; states</strong>
            <span className="dw-controls-summary">{selection.state}{selection.props ? ' · Modified' : ''}</span>
          </Button>
          <div className="dw-dock-choices" role="group" aria-label="Inspector position">
            <Button variant="ghost" aria-label="Dock inspector below" title="Stack below the preview" aria-pressed={dock === 'below'} onClick={() => change('below', open)}><DockIcon side="below" /></Button>
            <Button variant="ghost" aria-label="Dock inspector right" title="Dock on the right; stacks below in narrow panels" aria-pressed={dock === 'right'} onClick={() => change('right', open)}><DockIcon side="right" /></Button>
          </div>
        </header>
        <div id={bodyId} className="dw-controls-body" hidden={!open}>
          <div className="dw-state-preset">
            <label><span>State preset</span><Select aria-label="State preset" value={selection.state} onValueChange={onStateChange} options={entry.variants.map(value => ({ value, label: value }))} /></label>
            <p>A named scenario, such as Loading or Disabled. Choosing one resets your property edits.</p>
          </div>
          <Properties entry={entry} selection={selection} controls={controls} onChange={onPropsChange} />
        </div>
      </aside>
    </div>
  </div>;
}
function DockIcon({ side }: { side: 'below' | 'right' }) {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="2" width="16" height="16" rx="3" />{side === 'below' ? <path d="M2 12h16M5 15h10" /> : <path d="M12 2v16M15 5v10" />}</svg>;
}
