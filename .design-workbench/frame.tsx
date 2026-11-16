import type { CSSProperties, ReactNode } from 'react';
import { TooltipProvider } from '../src/ui/tooltip.tsx';

/**
 * DesignBench's styles are scoped to .dw-workbench, so every preview renders inside one.
 * `fill` gives full-height parts (panels, pages) the whole frame instead of a padded stage.
 */
export function Frame({ children, fill = false, style }: { children: ReactNode; fill?: boolean; style?: CSSProperties }) {
  return <TooltipProvider delayDuration={200}>
    <div className="dw-workbench" style={{ display: 'block', minHeight: 0, ...(fill ? { height: '100vh' } : { padding: 32 }), ...style }}>{children}</div>
  </TooltipProvider>;
}
/** A muted caption under or beside a sample. */
export function Caption({ children }: { children: ReactNode }) {
  return <span style={{ color: '#73736e', fontSize: 12 }}>{children}</span>;
}
/** The inspector's panel chrome, for parts that live in its tabs. */
export function Panel({ children, width = 360 }: { children: ReactNode; width?: number }) {
  return <aside className="dw-controls-panel dw-dock-right" style={{ width, maxWidth: '100%', border: '1px solid #e8e8e6', borderRadius: 12 }}>
    <div className="dw-controls-body">{children}</div>
  </aside>;
}
