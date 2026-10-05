'use client';
import { useEffect, useRef, useState } from 'react';
import { Portal } from '@radix-ui/react-hover-card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from './ui/hover-card.tsx';
import type { NavigationPreviewProps } from './controls.tsx';

/** Mount just the hovered entry's default preview, without changing selection. */
export function NavigationPreview({ children, title, description, url, width, disabled }: NavigationPreviewProps) {
  const suppress = useRef(false);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!open) return;
    setLoaded(false); setSlow(false);
    const close = () => setOpen(false);
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close);
      window.removeEventListener('blur', close); window.removeEventListener('keydown', escape);
    };
  }, [open]);
  useEffect(() => {
    if (!open || loaded) return;
    const timer = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(timer);
  }, [open, loaded]);
  const naturalWidth = Number.isFinite(width) ? Math.max(400, Math.min(width + 64, 1200)) : 640;
  const scale = 342 / naturalWidth;
  return <HoverCard open={open && !disabled} onOpenChange={value => setOpen(value && !suppress.current)} openDelay={200} closeDelay={140}>
    <HoverCardTrigger asChild onPointerLeave={() => { suppress.current = false; }} onBlur={() => { suppress.current = false; }} onClick={() => { suppress.current = true; setOpen(false); }} onPointerDown={() => { suppress.current = true; setOpen(false); }}>{children}</HoverCardTrigger>
    <Portal><HoverCardContent className="dw-hover-preview" side="right" align="start" sideOffset={12} collisionPadding={12} role="tooltip">
      <header><strong>{title}</strong><p>{description}</p></header>
      <div className="dw-hover-canvas" aria-hidden="true" inert>
        {!loaded && <div className="dw-hover-loading">{slow ? 'Still loading. Select the component to inspect it.' : 'Loading preview…'}</div>}
        {open && !disabled && <iframe title={`${title} quick preview`} src={url} tabIndex={-1} allow="camera 'none'; microphone 'none'" onLoad={() => setLoaded(true)} style={{ width: naturalWidth, height: 210 / scale, transform: `scale(${scale})`, opacity: loaded ? 1 : 0 }} />}
      </div>
      <footer>Default state · select the component to explore</footer>
    </HoverCardContent></Portal>
  </HoverCard>;
}
