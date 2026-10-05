'use client';
import { cloneElement, useEffect, useId, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import type { NavigationPreviewProps } from './controls.tsx';

/** A lightweight, noninteractive preview of the entry's default design and state. */
export function NavigationPreview({ children, title, description, url, width, disabled }: NavigationPreviewProps) {
  const id = useId();
  const anchor = useRef<HTMLDivElement>(null);
  const opening = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const clearTimers = () => { clearTimeout(opening.current); clearTimeout(closing.current); };
  const dismiss = () => { clearTimers(); setPosition(null); setActive(false); };
  const open = () => {
    if (disabled) return;
    clearTimers();
    setActive(true);
    if (position) return;
    opening.current = setTimeout(() => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) return dismiss();
      const cardWidth = Math.min(344, window.innerWidth - 24);
      const cardHeight = Math.min(320, window.innerHeight - 24);
      const left = rect.right + 12 + cardWidth <= window.innerWidth - 12 ? rect.right + 12 : Math.max(12, rect.left - cardWidth - 12);
      window.dispatchEvent(new CustomEvent('design-workbench:preview-open', { detail: id }));
      setLoaded(false);
      setSlow(false);
      setPosition({ left, top: Math.max(12, Math.min(rect.top, window.innerHeight - cardHeight - 12)), width: cardWidth, height: cardHeight });
    }, 200);
  };
  const leave = () => {
    clearTimeout(opening.current);
    clearTimeout(closing.current);
    closing.current = setTimeout(dismiss, 140);
  };
  useEffect(() => () => clearTimers(), []);
  useEffect(() => { if (disabled) dismiss(); }, [disabled]);
  useEffect(() => {
    if (!active) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss(); };
    const otherPreview = (event: Event) => { if ((event as CustomEvent).detail !== id) dismiss(); };
    window.addEventListener('keydown', escape);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('blur', dismiss);
    window.addEventListener('design-workbench:preview-open', otherPreview);
    return () => {
      window.removeEventListener('keydown', escape);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('blur', dismiss);
      window.removeEventListener('design-workbench:preview-open', otherPreview);
    };
  }, [active, id]);
  useEffect(() => {
    if (!position || loaded) return;
    const timer = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(timer);
  }, [position, loaded]);

  const naturalWidth = Number.isFinite(width) ? Math.max(400, Math.min(width + 64, 1200)) : 640;
  const scale = position ? (position.width - 2) / naturalWidth : 1;
  const link = children as ReactElement<{ 'aria-describedby'?: string }>;
  return <div ref={anchor} className="dw-nav-preview-anchor"
    onPointerEnter={event => { if (event.pointerType !== 'touch') open(); }}
    onPointerLeave={leave} onFocus={open} onBlur={dismiss}
    onPointerDown={dismiss} onClick={dismiss} onContextMenu={dismiss}>
    {cloneElement(link, { 'aria-describedby': position && !disabled ? [link.props['aria-describedby'], id].filter(Boolean).join(' ') : link.props['aria-describedby'] })}
    {position && !disabled && createPortal(
      <aside id={id} role="tooltip" className="dw-hover-preview" style={{ left: position.left, top: position.top, width: position.width, maxHeight: position.height }}
        onPointerEnter={clearTimers} onPointerLeave={leave}>
        <header><strong>{title}</strong><p>{description}</p></header>
        <div className="dw-hover-canvas" aria-hidden="true" inert>
          {!loaded && <div className="dw-hover-loading">{slow ? 'Still loading. Select the component to inspect it.' : 'Loading preview…'}</div>}
          <iframe title={`${title} quick preview`} src={url} tabIndex={-1}
            allow="camera 'none'; microphone 'none'" onLoad={() => setLoaded(true)}
            style={{ width: naturalWidth, height: 210 / scale, transform: `scale(${scale})`, opacity: loaded ? 1 : 0 }} />
        </div>
        <footer>Default state · select the component to explore</footer>
      </aside>, document.body)}
  </div>;
}
