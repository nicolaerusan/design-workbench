'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { defaultControls, type WorkbenchControls } from './controls.tsx';
import type { NavigationPreviewProps } from './controls.tsx';
import { Properties } from './properties.tsx';
import { SetupGuide } from './setup-guide.tsx';
import { ContextPanel } from './contexts.tsx';
import { designsFor, previewUrl, resolveSelection, safeReferenceUrl } from './model.ts';
import type {
  CoverageItem,
  DesignIdea,
  DesignReference,
  Selection,
  WorkbenchEntry,
} from './model.ts';

export interface WorkbenchProps {
  project: string;
  controls?: WorkbenchControls;
  /** Optional server-resolved URL selection, preventing a default-entry flash on load. */
  initialSelection?: Selection;
  /** Stable project namespace for local design references. */
  projectId: string;
  entries: WorkbenchEntry[];
  coverage?: CoverageItem[];
  basePath: string;
  scopeNote?: string;
  /** CLI can supply commands appropriate to its installation. */
  setupCommand?: string;
}
export function Workbench({
  project,
  controls = defaultControls,
  initialSelection,
  projectId,
  entries,
  coverage = [],
  basePath,
  scopeNote,
  setupCommand,
}: WorkbenchProps) {
  const { Button, Input, Select } = controls;
  const NavigationPreview = controls.NavigationPreview ?? PlainNavigationItem;
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(244);
  const [resizing, setResizing] = useState(false);
  const widthKey = `design-workbench:${projectId}:sidebar-width`;
  const resizeSidebar = (width: number) => {
    const next = Math.round(Math.max(200, Math.min(480, window.innerWidth - 360, width)));
    setSidebarWidth(next);
    try { localStorage.setItem(widthKey, String(next)); } catch {}
  };
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(widthKey));
      if (saved >= 200 && saved <= 480) setSidebarWidth(saved);
    } catch {}
  }, [widthKey]);
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [selection, setSelection] = useState(() =>
    resolveSelection(entries, new URLSearchParams(initialSelection ? { ...initialSelection } : {})),
  );
  const [query, setQuery] = useState('');
  const [compare, setCompare] = useState(false);
  const [reset, setReset] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const [showCoverage, setShowCoverage] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)');
    const sync = () => { setMobile(media.matches); setShowNav(false); };
    sync(); media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    if (!mobile || !showNav) return;
    const menu = menuRef.current;
    searchRef.current?.focus();
    const onTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onTab);
    return () => { document.removeEventListener('keydown', onTab); menu?.focus(); };
  }, [mobile, showNav]);
  useEffect(() => {
    const restore = () => {
      setSelection(resolveSelection(entries, new URLSearchParams(window.location.search)));
      setCopied(false);
    };
    restore();
    setReady(true);
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [entries]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setCollapsed(false); setShowNav(true);
        requestAnimationFrame(() => searchRef.current?.focus());
      }
      if (event.key === 'Escape') setShowNav(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const entry = entries.find((item) => item.id === selection.component);
  if (!entry)
    return <SetupGuide command={setupCommand} />;
  const designs = designsFor(entry);
  const design = designs.find((item) => item.id === selection.design) ?? designs[0];
  const update = (patch: Partial<Selection>, replace = false) => {
    if (patch.component !== undefined || patch.state !== undefined) patch = { ...patch, props: '' };
    const next = resolveSelection(entries, new URLSearchParams({ ...selection, ...patch }));
    setSelection(next);
    setReset(0);
    setCopied(false);
    setCopyError('');
    window.history[replace ? 'replaceState' : 'pushState'](null, '', `${basePath}?${new URLSearchParams({ ...next })}`);
  };
  const groups = [...new Set(entries.map((item) => item.group))];
  const filtered = entries.filter((item) =>
    `${item.name} ${item.id} ${item.group} ${item.source}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const unpreviewed = coverage.filter((item) => item.status !== 'previewed');
  const frame = (idea: DesignIdea) => (
    <section className="dw-preview-card" key={idea.id}>
      {compare && (
        <div className="dw-frame-title">
          {idea.name}
          <Status idea={idea} />
        </div>
      )}
      <div className="dw-canvas">
        <iframe
          key={`${entry.id}-${idea.id}-${selection.state}-${reset}`}
          title={`${entry.name} — ${idea.name}`}
          src={previewUrl(basePath, entry, selection, idea.id)}
          style={{ width: selection.viewport === 'fit' ? '100%' : Number(selection.viewport) }}
          allow="clipboard-write; camera 'none'; microphone 'none'"
        />
      </div>
    </section>
  );
  return (
    <div className={`dw-workbench ${collapsed ? 'dw-nav-collapsed' : ''} ${resizing ? 'dw-resizing' : ''}`} style={{ '--dw-sidebar-width': `${sidebarWidth}px` } as CSSProperties}>
      {showNav && <Button className="dw-scrim" aria-label="Close component list" onClick={() => setShowNav(false)} />}
      <aside ref={sidebarRef} className={`dw-sidebar ${showNav ? 'dw-sidebar-open' : ''}`}>
        <a className="dw-brand" href={basePath}>
          <span className="dw-brand-mark"><WorkbenchIcon name="panels" /></span>
          <span>
            Design workbench<small>{project}</small>
          </span>
        </a>
        <label className="dw-search">
          <span className="dw-sr-only">Search components</span>
          <Input
            ref={searchRef}
            aria-label="Search components"
            placeholder="Find a component…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd>⌘ K</kbd>
        </label>
        <div className="dw-nav-summary">{entries.length} named components</div>
        <nav aria-label="Components" className="dw-nav">
          {groups.map((group) => {
            const items = filtered.filter((item) => item.group === group);
            return items.length ? (
              <section key={group}>
                <h2>
                  {group}
                  <span>{items.length}</span>
                </h2>
                {items.map((item) => (
                  <NavigationPreview
                    key={item.id}
                    title={item.name}
                    description={item.description}
                    width={item.width}
                    disabled={mobile || collapsed}
                    url={previewUrl(basePath, item, resolveSelection(entries, new URLSearchParams({ component: item.id })))}
                  >
                  <a
                    href={`${basePath}?component=${item.id}`}
                    aria-current={item.id === entry.id ? 'page' : undefined}
                    onClick={(event) => {
                      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                      event.preventDefault();
                      update({ component: item.id, design: '', state: '' });
                      setShowCoverage(false);
                      setShowNav(false);
                    }}
                  >
                    {item.name}
                    <span aria-hidden="true">•</span>
                  </a>
                  </NavigationPreview>
                ))}
              </section>
            ) : null;
          })}
          {!filtered.length && <p className="dw-empty">No matching components.</p>}
        </nav>
        <Button variant="ghost" className="dw-coverage-button" onClick={() => setShowCoverage((value) => !value)}>
          Coverage & gaps <span>{unpreviewed.length}</span>
        </Button>
        <div className="dw-sidebar-footer">Local preview · source edits refresh live</div>
        {!mobile && <div
          className="dw-sidebar-resizer" role="separator" tabIndex={0}
          aria-label="Resize component sidebar" aria-orientation="vertical"
          aria-valuemin={200} aria-valuemax={480} aria-valuenow={sidebarWidth}
          title="Drag to resize · double-click to reset"
          onDoubleClick={() => resizeSidebar(244)}
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            resizeSidebar(event.key === 'Home' ? 200 : event.key === 'End' ? 480 : sidebarWidth + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 40 : 10));
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault(); event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId); setResizing(true);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) resizeSidebar(event.clientX - (sidebarRef.current?.getBoundingClientRect().left ?? 0));
          }}
          onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); setResizing(false); }}
          onLostPointerCapture={() => setResizing(false)}
        />}
      </aside>
      <main className="dw-main" inert={mobile && showNav ? true : undefined}>
        <header className="dw-header">
          <div>
            <Button
              ref={menuRef}
              className="dw-menu"
              aria-label="Toggle component list"
              aria-expanded={mobile ? showNav : !collapsed}
              onClick={() => {
                if (window.matchMedia('(max-width: 700px)').matches) setShowNav(value => !value);
                else setCollapsed(value => !value);
              }}
            >
              <WorkbenchIcon name="panels" />
            </Button>
            <span className="dw-eyebrow">{project} <span aria-hidden="true">/</span> {entry.group}</span>
            <h1>{entry.name}</h1>
            <p>{entry.description}</p>
          </div>
          <a
            className="dw-open"
            href={previewUrl(basePath, entry, selection)}
            target="_blank"
            rel="noreferrer"
          >
            Open preview <WorkbenchIcon name="external" />
          </a>
        </header>
        {showCoverage ? (
          <section className="dw-coverage">
            <h2>Coverage & gaps</h2>
            <p>
              {coverage.filter((item) => item.status === 'previewed').length} of {coverage.length}{' '}
              inventoried source files have a preview. This counts files, not every exported
              subcomponent or state.
            </p>
            <p>{scopeNote}</p>
            <ul>
              {coverage.map((item) => (
                <li key={item.source}>
                  <span className={`dw-status dw-${item.status}`}>{item.status}</span>
                  <code>{item.source}</code>
                  {item.reason && <p>{item.reason}</p>}
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <>
            {designs.length > 1 && <section className="dw-designs" aria-label="Design ideas">
              <div className="dw-section-label">
                Designs{' '}
                <span>
                  {designs.length} {designs.length === 1 ? 'design' : 'ideas'}
                </span>
              </div>
              <div className="dw-design-list">
                {designs.map((idea) => (
                  <Button
                    key={idea.id}
                    variant="ghost"
                    className="dw-design-choice"
                    title={idea.description}
                    aria-pressed={idea.id === design.id}
                    onClick={() => update({ design: idea.id })}
                  >
                    <strong>{idea.name}</strong>
                    <Status idea={idea} />

                  </Button>
                ))}
              </div>
            </section>}
            <div className="dw-toolbar">
              <div className="dw-toolbar-field"><span>State</span><Select aria-label="State" value={selection.state} onValueChange={(state) => update({ state })} options={entry.variants.map(value => ({ value, label: value }))} /></div>
              <div className="dw-toolbar-field"><span>Viewport</span><Select aria-label="Viewport" value={selection.viewport} onValueChange={(viewport) => update({ viewport })} options={[{value:'fit',label:'Fit panel'},{value:'375',label:'375 · Mobile'},{value:'768',label:'768 · Tablet'},{value:'1280',label:'1280 · Desktop'}]} /></div>
              <span className="dw-toolbar-spacer" />
              {!!entry.contexts?.length && <a className="dw-open" href="#dw-contexts">Contexts · {entry.contexts.length}</a>}
              <Button variant="ghost" title="Restart the preview with the current properties" onClick={() => setReset((value) => value + 1)}><WorkbenchIcon name="reset" /> Reset</Button>
              {designs.length > 1 && (
                <Button variant="ghost" aria-pressed={compare} onClick={() => setCompare((value) => !value)}>
                  Compare ideas
                </Button>
              )}
              <Button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                    setCopied(true);
                    setCopyError('');
                  } catch {
                    setCopied(false);
                    setCopyError('Could not copy. The preview URL is in your address bar.');
                  }
                }}
                variant="outline"
                title="Copy a link to this preview. Local links require the same project running on your machine."
                aria-live="polite"
              >
                <WorkbenchIcon name="link" /> {copied ? 'Copied' : 'Share'}
              </Button>
            </div>
            {copyError && <p role="status" className="dw-copy-error">{copyError}</p>}
            <details className="dw-preview-help"><summary>How to use this preview</summary><dl>
              <div><dt>Designs</dt><dd>Alternative visual directions for the same component. Compare them side by side.</dd></div>
              <div><dt>States</dt><dd>Named examples, such as Loading or Disabled. Selecting a state resets property overrides to that preset.</dd></div>
              <div><dt>Properties</dt><dd>Individual values such as label, size, and disabled. Changes affect previews and shared links, not application source.</dd></div>
              <div><dt>Status</dt><dd>Exploration is an idea. Source preview has no verified usage. Used in app means the manifest includes reviewed source evidence.</dd></div>
              <div><dt>Viewport</dt><dd>The preview’s width in pixels. Use it to check responsive layouts.</dd></div>
              <div><dt>Share</dt><dd>Copy the current selection and properties. A localhost link works only where this project’s server is running.</dd></div>
            </dl></details>
            <Properties entry={entry} selection={selection} controls={controls} onChange={props => update({ props: JSON.stringify(props) }, true)} />
            <div className="dw-preview-caption"><span>{design.name}</span>{designs.length === 1 && <Status idea={design} />}<span>{design.description}</span></div>
            <div className={`dw-previews ${compare ? 'dw-compare' : ''}`}>
              {ready ? (
                compare ? (
                  designs.map(frame)
                ) : (
                  frame(design)
                )
              ) : (
                <p className="dw-empty">Loading preview…</p>
              )}
            </div>
            <ContextPanel key={`contexts:${entry.id}`} entry={entry} entries={entries} basePath={basePath} controls={controls} navigate={(next) => { update(next); window.scrollTo({ top: 0 }); }} />
            <details className="dw-inspector" key={`inspector:${entry.id}`}>
              <summary>Source, references &amp; feedback <span>Inspect this design</span></summary>
            <section className="dw-details">
              <div>
                <div className="dw-section-label">Design source</div>
                <code>{design.source}</code>
                {design.productionUsage?.length ? (
                  <>
                    <h3>Used in the app</h3>
                    <ul>
                      {design.productionUsage.map((usage) => (
                        <li key={`${usage.file}-${usage.symbol}`}>
                          <code>{usage.file}</code> → <code>{usage.symbol}</code>
                          <p>{usage.description}</p>
                        </li>
                      ))}
                    </ul>
                    <p className="dw-note">
                      Source evidence is maintained in project configuration. Preview selection does
                      not change imports or ship a design.
                    </p>
                  </>
                ) : (
                  <p className="dw-note">No production usage is claimed for this design.</p>
                )}
              </div>
              <ReferencePanel
                key={`${entry.id}/${design.id}`}
                controls={controls}
                storageKey={`design-workbench:${projectId}:${entry.id}:${design.id}`}
                references={design.references ?? []}
              />
            </section>
            </details>
          </>
        )}
      </main>
    </div>
  );
}
function PlainNavigationItem({ children }: NavigationPreviewProps) { return children; }
function Status({ idea }: { idea: DesignIdea }) {
  return (
    <span
      className={`dw-status ${idea.productionUsage?.length ? 'dw-production' : 'dw-exploration'}`}
    >
      {idea.productionUsage?.length
        ? 'Used in app'
        : idea.kind === 'exploration'
          ? 'Exploration'
          : 'Source preview'}
    </span>
  );
}
function ReferencePanel({
  controls,
  storageKey,
  references,
}: {
  controls: WorkbenchControls;
  storageKey: string;
  references: DesignReference[];
}) {
  const { Button, Input, Textarea } = controls;
  const [saved, setSaved] = useState<DesignReference[]>([]);
  const [error, setError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      if (Array.isArray(parsed))
        setSaved(
          parsed.filter(
            (item): item is DesignReference =>
              item &&
              typeof item.title === 'string' &&
              (!item.url || typeof item.url === 'string') &&
              (!item.notes || typeof item.notes === 'string'),
          ),
        );
    } catch {
      /* Storage can be unavailable in embedded previews. */
    }
  }, [storageKey]);
  const persist = (next: DesignReference[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSaved(next);
      setError('');
    } catch {
      setError('Browser storage is unavailable. Copy your reference into the project manifest.');
    }
  };
  return (
    <div className="dw-references">
      <div className="dw-section-label">References & feedback</div>
      <p className="dw-note">
        Attach a reference link or describe a direction for this idea. Browser notes stay on this
        machine; export them to share with your agent.
      </p>
      <ul>
        {[...references, ...saved].map((reference, i) => (
          <li key={i}>
            {reference.url && safeReferenceUrl(reference.url) ? (
              <a href={safeReferenceUrl(reference.url)} target="_blank" rel="noreferrer">
                {reference.title} ↗
              </a>
            ) : (
              <strong>{reference.title}</strong>
            )}
            {reference.notes && <p>{reference.notes}</p>}
            {i >= references.length && (
              <Button
                aria-label={`Remove ${reference.title}`}
                onClick={() => persist(saved.filter((_, index) => index !== i - references.length))}
              >
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const url = String(data.get('url') ?? '').trim();
          if (url && !safeReferenceUrl(url)) {
            setError('Use an http or https reference URL.');
            return;
          }
          persist([
            ...saved,
            {
              title: String(data.get('title')).trim(),
              url: url || undefined,
              notes: String(data.get('notes') ?? '').trim() || undefined,
            },
          ]);
          formRef.current?.reset();
        }}
      >
        <label>
          Reference name
          <Input name="title" required maxLength={120} placeholder="e.g. A quieter meal receipt" />
        </label>
        <label>
          Reference URL (optional)
          <Input name="url" placeholder="https://…" />
        </label>
        <label>
          Design feedback
          <Textarea
            name="notes"
            rows={2}
            maxLength={5000}
            placeholder="What should we borrow or change?"
          />
        </label>
        <div>
          <Button type="submit" variant="default">Save reference</Button>
          <Button
            type="button"
            onClick={() => {
              const blob = new Blob(
                [
                  JSON.stringify(
                    { design: storageKey, references: [...references, ...saved] },
                    null,
                    2,
                  ),
                ],
                { type: 'application/json' },
              );
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'design-references.json';
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Export references
          </Button>
        </div>
        {error && <p role="alert">{error}</p>}
      </form>
    </div>
  );
}

function WorkbenchIcon({ name }: { name: 'panels' | 'external' | 'reset' | 'link' }) {
  const paths = {
    panels: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/></>,
    external: <><path d="M14 3h7v7M21 3l-9 9M10 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-4"/></>,
    reset: <><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/></>,
    link: <><path d="m10 13 4-4M8 15l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 9l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(0 1) scale(.9)"/></>,
  };
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
