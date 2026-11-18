'use client';
import { useEffect, useRef, useState } from 'react';

type Bounds = { x: number; y: number; width: number; height: number };
const replaced = /^(img|svg|canvas|video|picture|input|button|select|textarea|progress|meter)$/i;
const paints = (style: CSSStyleDeclaration) =>
  !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(style.backgroundColor) || style.backgroundImage !== 'none' || style.boxShadow !== 'none'
  || ['Top', 'Right', 'Bottom', 'Left'].some(side => parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0 && style.getPropertyValue(`border-${side.toLowerCase()}-style`) !== 'none');

/** The area a preview actually paints (text, media, and boxes with a fill or border), ignoring empty layout wrappers. */
function contentBounds(doc: Document): Bounds | null {
  const view = doc.defaultView;
  if (!view || !doc.body) return null;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  const add = (rect: DOMRect) => {
    // A box filling the whole frame is a page background, not content.
    if (!rect.width || !rect.height || (rect.width >= view.innerWidth - 1 && rect.height >= view.innerHeight - 1)) return;
    left = Math.min(left, rect.left); top = Math.min(top, rect.top); right = Math.max(right, rect.right); bottom = Math.max(bottom, rect.bottom);
  };
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  const range = doc.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.textContent?.trim()) continue;
      range.selectNodeContents(node); add(range.getBoundingClientRect());
      continue;
    }
    const element = node as Element;
    const style = view.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || element.tagName === 'SCRIPT' || element.tagName === 'STYLE') continue;
    if (replaced.test(element.tagName) || paints(style)) add(element.getBoundingClientRect());
  }
  return Number.isFinite(left) ? { x: left, y: top, width: right - left, height: bottom - top } : null;
}

/**
 * A live, non-interactive miniature of a preview.
 * `width` fills the box with the frame's top-left; `content` zooms to what the preview paints, so small
 * components such as buttons stay legible; `auto` zooms to content only when it stays near full size, and
 * otherwise fills the width (best for tiles that hold both buttons and whole pages).
 * Content fitting needs a same-origin preview and falls back to `width`.
 */
export function PreviewThumbnail({ title, url, width, renderWidth, fit = 'width', className = 'dw-tile-thumbnail' }: {
  title: string; url: string; width?: number; renderWidth?: number; fit?: 'width' | 'content' | 'auto'; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [loaded, setLoaded] = useState(false);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([item]) => setBox({ width: item.contentRect.width, height: item.contentRect.height }));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setLoaded(false); setBounds(null); }, [url]);
  const naturalWidth = renderWidth ?? (Number.isFinite(width) ? Math.max(400, Math.min(width! + 64, 1200)) : 640);
  const measure = () => {
    if (fit === 'width') return;
    try { const doc = frame.current?.contentDocument; setBounds(doc ? contentBounds(doc) : null); } catch { setBounds(null); }
  };
  // Re-measure as the preview changes, for example after a source edit reloads it.
  useEffect(() => {
    if (fit === 'width' || !loaded) return;
    let doc: Document | null | undefined;
    try { doc = frame.current?.contentDocument; } catch { return; }
    if (!doc?.body) return;
    let timer = 0;
    const observer = new MutationObserver(() => { window.clearTimeout(timer); timer = window.setTimeout(measure, 120); });
    observer.observe(doc.body, { subtree: true, childList: true, attributes: true, characterData: true });
    const late = window.setTimeout(measure, 300); // after web fonts settle
    return () => { observer.disconnect(); window.clearTimeout(timer); window.clearTimeout(late); };
  }, [fit, loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  let transform: string, height: number, fitted = false;
  const pad = 10;
  const contentScale = bounds && box.width ? Math.min(1, box.width / (bounds.width + pad * 2), box.height / (bounds.height + pad * 2)) : 0;
  if (bounds && (fit === 'content' && contentScale > 0 || fit === 'auto' && contentScale >= 0.6)) {
    const scale = contentScale;
    fitted = true;
    const x = box.width / 2 - (bounds.x + bounds.width / 2) * scale, y = box.height / 2 - (bounds.y + bounds.height / 2) * scale;
    transform = `translate(${x}px, ${y}px) scale(${scale})`;
    height = Math.max(480, bounds.y + bounds.height + pad);
  } else {
    const scale = box.width / naturalWidth;
    transform = `scale(${scale})`;
    height = Math.max(fit === 'width' ? 0 : 480, box.height / scale);
  }
  return <div ref={ref} className={className} data-fitted={fitted || undefined} aria-hidden="true" inert>
    {box.width > 0 && <iframe ref={frame} title={`${title} thumbnail`} src={url} tabIndex={-1} scrolling="no" loading="lazy" allow="camera 'none'; microphone 'none'"
      onLoad={() => { setLoaded(true); measure(); }}
      style={{ width: naturalWidth, height, transform, opacity: loaded ? 1 : 0 }} />}
  </div>;
}
