'use client';
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { Grid2x2, Maximize2, Plus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.tsx';
import { PreviewThumbnail } from './thumbnail.tsx';
import { CopyButton } from './setup-guide.tsx';
import { splitDesigns } from './variant-guide.tsx';
import { variantsPrompt } from './agent-prompts.ts';
import type { DesignIdea, WorkbenchEntry } from './model.ts';

/** Switches the canvas between one preview and the grid. Sits beside the design picker. */
export function GridToggle({ pressed, onPressedChange, hint = 'Every variant at every state' }: {
  pressed: boolean; onPressedChange: (pressed: boolean) => void;
  /** What the grid will show, for the tooltip. */
  hint?: string;
}) {
  return <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" className="dw-design-choice dw-grid-toggle" aria-pressed={pressed} onClick={() => onPressedChange(!pressed)}>
        <Grid2x2 size={14} aria-hidden="true" />Grid
      </button>
    </TooltipTrigger>
    <TooltipContent side="bottom">{pressed ? 'Back to one preview' : hint}</TooltipContent>
  </Tooltip>;
}

/** Follows a value once it stops changing, so typing in a property field reloads the cells once, not per key. */
function useSettled<T>(value: T, delay: number) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

/**
 * Which cells may load their preview. A cell is released when it nears the visible part of the canvas,
 * and a few at a time, so a large matrix never starts every frame at once.
 */
function useReleasedCells(cells: string) {
  const scroller = useRef<HTMLDivElement>(null);
  const [released, setReleased] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const nodes = [...root.querySelectorAll<HTMLElement>('[data-cell]')];
    if (typeof IntersectionObserver === 'undefined') { setReleased(new Set(nodes.map(node => node.dataset.cell!))); return; }
    const waiting: string[] = [];
    let timer = 0;
    const release = () => {
      const batch = waiting.splice(0, 3);
      if (batch.length) setReleased(current => new Set([...current, ...batch]));
      timer = waiting.length ? window.setTimeout(release, 90) : 0;
    };
    const observer = new IntersectionObserver(items => {
      for (const item of items) {
        if (!item.isIntersecting) continue;
        observer.unobserve(item.target);
        waiting.push((item.target as HTMLElement).dataset.cell!);
      }
      if (!timer && waiting.length) release();
    }, { root, rootMargin: '160px' });
    nodes.forEach(node => observer.observe(node));
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }, [cells]);
  return [scroller, released] as const;
}

/**
 * The grid view of a component: its variants as rows (the app's own component first) and its states as columns.
 * Every cell is a live preview, so one edit in the Properties tab shows in all of them.
 * The last row asks an agent for more variants; the workbench never makes them itself.
 */
export function VariantGrid({ entry, designs, active, state, cellUrl, cellHref, onOpen, command = 'npx designbench', viewport = 'fit', restart = 0 }: {
  entry: WorkbenchEntry; designs: DesignIdea[];
  /** The selected variant and state. Their cell is marked: it is the one the Properties tab describes. */
  active: DesignIdea; state: string;
  /** The preview for one cell. Carry the edited properties in it, so they reach every cell. */
  cellUrl: (design: string, state: string) => string;
  /** The workbench page for one cell, so it also opens in a new tab. */
  cellHref: (design: string, state: string) => string;
  /** A cell was chosen: show that variant at that state on its own. */
  onOpen: (design: string, state: string) => void;
  command?: string;
  /** The width previews render at: `fit` uses the component's own width. */
  viewport?: string;
  /** Change it to restart every preview. */
  restart?: number;
}) {
  const { source, variants } = splitDesigns(designs);
  const rows = [source, ...variants];
  const states = entry.variants;
  const id = (design: DesignIdea, name: string) => `${design.id}/${name}`;
  const [scroller, released] = useReleasedCells(rows.flatMap(design => states.map(name => id(design, name))).join('\n'));
  // Cells make room for what the previews draw, so a panel or a page is not squeezed into the space a button needs:
  // wider content gets wider columns, and rows are as tall as the tallest preview needs, within what the canvas can show.
  const [layout, setLayout] = useState({ cell: 0, canvas: 0 });
  const [content, setContent] = useState<Record<string, { width: number; height: number }>>({});
  useEffect(() => {
    const root = scroller.current, first = root?.querySelector<HTMLElement>('.dw-grid-cell');
    if (!root || !first || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const cell = first.clientWidth, canvas = root.clientHeight;
      setLayout(current => current.cell === cell && current.canvas === canvas ? current : { cell, canvas });
    });
    observer.observe(root);
    observer.observe(first);
    return () => observer.disconnect();
  }, [scroller]);
  const measured = (cell: string, size: { width: number; height: number }) => setContent(current => {
    const next = { width: Math.round(size.width), height: Math.round(size.height) };
    return current[cell]?.width === next.width && current[cell]?.height === next.height ? current : { ...current, [cell]: next };
  });
  const sizes = Object.values(content);
  // A thumbnail keeps a 10px margin around what it shows, and shrinks it to the cell's width when it is wider.
  const widest = Math.max(0, ...sizes.map(size => size.width + 20));
  const tallest = Math.max(0, ...sizes.map(size => (size.height + 20) * Math.min(1, layout.cell / (size.width + 20))));
  const shortest = Math.max(116, Math.round(layout.cell * .42));
  const fitted = sizes.length ? {
    '--dw-grid-min': `${Math.round(Math.max(184, Math.min(widest * .36, 320)))}px`,
    '--dw-grid-max': `${Math.round(Math.max(340, Math.min(widest, 560)))}px`,
    ...(layout.cell ? { '--dw-grid-height': `${Math.round(Math.max(shortest, Math.min(tallest + 28, 440, layout.canvas - 64)))}px` } : {}),
  } : {};
  // Previews render at the chosen viewport width, or the component's own. One that fills its frame gets a screen's proportions.
  const renderWidth = viewport === 'fit' ? Math.max(400, Math.min((Number.isFinite(entry.width) ? entry.width : 576) + 64, 1200)) : Number(viewport);
  const urls = Object.fromEntries(rows.flatMap(design => states.map(name => [id(design, name), cellUrl(design.id, name)])));
  const settled: Record<string, string> = JSON.parse(useSettled(JSON.stringify(urls), 200));
  const open = (event: MouseEvent<HTMLAnchorElement>, design: DesignIdea, name: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onOpen(design.id, name);
  };
  return <div ref={scroller} className="dw-grid-canvas" role="region" aria-label={`${entry.name} grid`} tabIndex={0}
    style={{ '--dw-grid-states': states.length, ...fitted } as CSSProperties}>
    <table className="dw-grid">
      <caption className="dw-sr-only">{entry.name}: every variant at every state. Choose a cell to open it on its own.</caption>
      <thead>
        <tr>
          <td className="dw-grid-corner" />
          {states.map(name => <th key={name} scope="col" className="dw-grid-state">{name}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map(design => <tr key={design.id}>
          <th scope="row" className="dw-grid-variant">
            <span className="dw-grid-name">{design.name}</span>
            <span className="dw-grid-tag">{design === source ? 'Source' : 'Variant'}</span>
          </th>
          {states.map(name => <td key={name}>
            <a className="dw-grid-cell" data-cell={id(design, name)} href={cellHref(design.id, name)} aria-label={`Open ${design.name}, ${name}`}
              aria-current={design.id === active.id && name === state ? 'true' : undefined} onClick={event => open(event, design, name)}>
              {released.has(id(design, name)) && <PreviewThumbnail key={restart} className="dw-grid-thumbnail" fit="content" title={`${design.name}, ${name}`}
                url={settled[id(design, name)] ?? urls[id(design, name)]} renderWidth={renderWidth} frameHeight={Math.max(480, Math.round(renderWidth * .625))}
                onContent={size => measured(id(design, name), size)} />}
              <span className="dw-grid-open" aria-hidden="true"><Maximize2 size={12} /></span>
            </a>
          </td>)}
        </tr>)}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" className="dw-grid-variant dw-grid-new"><span className="dw-grid-name"><Plus size={13} aria-hidden="true" />New variants</span></th>
          <td colSpan={states.length}>
            <div className="dw-grid-ask">
              <p>Your coding agent makes variants. Paste this prompt into it, and each variant it saves appears here as a new row.</p>
              <CopyButton text={variantsPrompt(command, { component: entry.name })} label="Copy prompt" />
            </div>
          </td>
        </tr>
      </tfoot>
    </table>
  </div>;
}
