'use client';
import { useEffect, useRef, useState } from 'react';

/** `frame` is the height of the preview's own viewport when it was measured. */
type Bounds = { x: number; y: number; width: number; height: number; frame: number };
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
  return Number.isFinite(left) ? { x: left, y: top, width: right - left, height: bottom - top, frame: view.innerHeight } : null;
}

/**
 * A live, non-interactive miniature of a preview.
 * `width` fills the box with the frame's top-left; `content` zooms to what the preview paints, so small
 * components such as buttons stay legible; `auto` zooms to content only when it stays near full size, and
 * otherwise fills the width (best for tiles that hold both buttons and whole pages).
 * Content fitting needs a same-origin preview and falls back to `width`.
 */
export function PreviewThumbnail({ title, url, width, renderWidth, frameHeight, fit = 'width', className = 'dw-tile-thumbnail', onContent }: {
  title: string; url: string; width?: number; renderWidth?: number; fit?: 'width' | 'content' | 'auto'; className?: string;
  /**
   * The height of the preview's own frame, which grows only to hold taller content. A preview that fills its frame,
   * such as a whole page, is then this tall whatever the size of the box. Otherwise the frame follows the box.
   */
  frameHeight?: number;
  /** Told the size of what the preview paints, each time it is measured. Lets a layout make room for it. */
  onContent?: (size: { width: number; height: number }) => void;
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
  // A new frame size reflows the preview without loading or mutating it, so nothing above notices. The frame goes
  // back to its own height for one render, and what the preview paints at the new size is measured again.
  const [settling, setSettling] = useState(false);
  const late = useRef(0);
  useEffect(() => { if (fit !== 'width' && loaded) setSettling(true); }, [naturalWidth, frameHeight]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!settling) return;
    measure();
    setSettling(false);
    // Once more, for previews that take a moment to respond to their new size.
    window.clearTimeout(late.current);
    late.current = window.setTimeout(measure, 300);
  }, [settling]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => window.clearTimeout(late.current), []);
  const report = useRef(onContent);
  report.current = onContent;
  useEffect(() => { if (bounds) report.current?.({ width: bounds.width, height: bounds.height }); }, [bounds?.width, bounds?.height]); // eslint-disable-line react-hooks/exhaustive-deps
  let transform: string, height: number, fitted = false;
  const pad = 10;
  // The frame's height before anything in it is measured.
  const resting = frameHeight ?? Math.max(fit === 'width' ? 0 : 480, box.height / (box.width / naturalWidth));
  const contentScale = bounds && box.width ? Math.min(1, box.width / (bounds.width + pad * 2), box.height / (bounds.height + pad * 2)) : 0;
  if (bounds && (fit === 'content' && contentScale > 0 || fit === 'auto' && contentScale >= 0.6)) {
    const scale = contentScale;
    fitted = true;
    const x = box.width / 2 - (bounds.x + bounds.width / 2) * scale, y = box.height / 2 - (bounds.y + bounds.height / 2) * scale;
    transform = `translate(${x}px, ${y}px) scale(${scale})`;
    // The frame grows to hold taller content. Content that already fits is left alone: a page that fills its frame
    // would otherwise grow with it, and the two would chase each other. The cap stops any other runaway.
    const bottom = bounds.y + bounds.height, shortest = frameHeight ?? 480;
    height = settling ? resting : Math.min(Math.max(shortest, bottom > bounds.frame ? bottom + pad : bounds.frame), Math.max(shortest, 4000));
  } else {
    transform = `scale(${box.width / naturalWidth})`;
    height = resting;
  }
  return <div ref={ref} className={className} data-fitted={fitted || undefined} aria-hidden="true" inert>
    {box.width > 0 && <iframe ref={frame} title={`${title} thumbnail`} src={url} tabIndex={-1} scrolling="no" loading="lazy" allow="camera 'none'; microphone 'none'"
      onLoad={() => { setLoaded(true); measure(); }}
      style={{ width: naturalWidth, height, transform, opacity: loaded ? 1 : 0 }} />}
  </div>;
}
