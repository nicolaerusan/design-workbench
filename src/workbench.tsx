'use client';
import { resolveWorkbenchPage, type WorkbenchPage } from './navigation.ts';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from './ui/breadcrumb.tsx';
import { Kbd, KbdGroup } from './ui/kbd.tsx';
import { DesignBenchMark } from './brand.tsx';
import { PanelLeft, ArrowUpRight, RotateCcw, Link2, ChevronRight, LayoutGrid, Search, Settings as SettingsIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip.tsx';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { defaultControls, type WorkbenchControls } from './controls.tsx';
import { NavigationPreview as DefaultNavigationPreview } from './navigation-preview.tsx';
import { InspectorViewToggle, PreviewInspector, useInspectorView } from './preview-inspector.tsx';
import { CodePanel, type SourceAccess } from './code-panel.tsx';
import { DesignPicker, VariantsPanel, type VariantActions } from './variant-guide.tsx';
import { GridToggle, VariantGrid } from './variant-grid.tsx';
import { PreviewThumbnail } from './thumbnail.tsx';
import { CopyButton, SetupGuide } from './setup-guide.tsx';
import { populatePrompt } from './agent-prompts.ts';
import type { AgentConnection, WorkbenchView } from './agent-view.ts';
import { DeprecationBanner, UpdateNotice } from './update-notice.tsx';
import { ContextPanel } from './contexts.tsx';
import { designsFor, isDraft, previewUrl, resolveSelection, safeReferenceUrl } from './model.ts';
import type {
  CoverageItem,
  DesignIdea,
  Selection,
  UpdateInfo,
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
  /** The standalone CLI has not created its project configuration yet. */
  needsInit?: boolean;
  /** Lets the Code tab show file contents and open files in an editor. The CLI supplies this. */
  sourceAccess?: SourceAccess;
  /** Lets the Variants tab switch the app to a saved variant with a button. The CLI supplies this. */
  variantActions?: VariantActions;
  /** Called when the page, component, variant, state, or properties on screen change. */
  onViewChange?: (view: WorkbenchView) => void;
  /**
   * Set when agents can connect to this workbench over MCP, which the CLI supports: the agent that last called in,
   * or null before any has. Leave undefined where there is no MCP server, and Settings offers prompts only.
   */
  agentConnection?: AgentConnection | null;
  /** The running DesignBench version, shown in the sidebar footer. */
  version?: string;
  /** A newer or deprecated release, when the host has checked for one. */
  update?: UpdateInfo;
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
  needsInit = false,
  sourceAccess,
  variantActions,
  onViewChange,
  agentConnection,
  version,
  update: release,
}: WorkbenchProps) {
  const { Button, Input } = controls;
  const NavigationPreview = controls.NavigationPreview ?? DefaultNavigationPreview;
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
  const groupsKey = `design-workbench:${projectId}:collapsed-groups`;
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(groupsKey) ?? '[]');
      if (Array.isArray(saved)) setClosedGroups(saved.filter((item): item is string => typeof item === 'string'));
    } catch {}
  }, [groupsKey]);
  const toggleGroup = (group: string) => setClosedGroups((current) => {
    const next = current.includes(group) ? current.filter((item) => item !== group) : [...current, group];
    try { localStorage.setItem(groupsKey, JSON.stringify(next)); } catch {}
    return next;
  });
  const [shortcutModifier, setShortcutModifier] = useState('⌘');
  useEffect(() => { setShortcutModifier(/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'); }, []);
  const [compare, setCompare] = useState(false);
  // The grid is a way of looking, so it survives the page reloads that source edits trigger (for this browser tab only).
  const gridKey = `design-workbench:${projectId}:grid`;
  const [grid, setGridState] = useState(false);
  useEffect(() => {
    // A link to one grid cell says so (`grid=off`): a tab opened from the grid can inherit the grid from the tab it came
    // from, and would otherwise show the whole grid again. The mark is used once, then dropped from the address.
    const query = new URLSearchParams(window.location.search);
    if (query.get('grid') === 'off') {
      query.delete('grid');
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${query.toString() ? `?${query}` : ''}${window.location.hash}`);
      try { sessionStorage.removeItem(gridKey); } catch {}
      setGridState(false);
      return;
    }
    try { setGridState(sessionStorage.getItem(gridKey) === 'on'); } catch {}
  }, [gridKey]);
  const setGrid = (next: boolean) => {
    setGridState(next);
    if (next) setCompare(false);
    try { if (next) sessionStorage.setItem(gridKey, 'on'); else sessionStorage.removeItem(gridKey); } catch {}
  };
  const [inspectorView, setInspectorView] = useInspectorView(projectId);
  const [reset, setReset] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const [showCoverage, setShowCoverage] = useState(false);
  const [page, setPage] = useState<WorkbenchPage>(() => resolveWorkbenchPage(entries, new URLSearchParams(initialSelection ? { ...initialSelection } : {}), needsInit));
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
      const query = new URLSearchParams(window.location.search);
      setSelection(resolveSelection(entries, query));
      setPage(resolveWorkbenchPage(entries, query, needsInit));
      setShowCoverage(false);
      setCopied(false);
    };
    restore();
    setReady(true);
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [entries, needsInit]);
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
  const showingSetup = page === 'setup' || !entry || needsInit;
  const showingOverview = page === 'overview' && !showingSetup;
  const showingComponent = !showingSetup && !showingOverview && !showCoverage;
  const viewPage = showingSetup ? 'settings' : showingOverview ? 'overview' : showCoverage ? 'coverage' : 'component';
  const reportView = useRef(onViewChange);
  reportView.current = onViewChange;
  const designs = entry ? designsFor(entry) : [];
  const design = designs.find((item) => item.id === selection.design) ?? designs[0];
  // The grid needs something to lay out: more than one state, or more than one variant.
  const canGrid = !!entry && (entry.variants.length > 1 || designs.length > 1);
  const showGrid = grid && canGrid;
  useEffect(() => { if (ready) reportView.current?.({ page: viewPage, selection, comparing: compare, grid: showGrid }); }, [ready, viewPage, selection, compare, showGrid]);
  // A configured project reaches setup commands from Settings; a new one is still setting up.
  const setupTitle = needsInit || !entries.length ? 'Setup' : 'Settings';
  const update = (patch: Partial<Selection>, replace = false) => {
    // A new component or state starts from its own properties, unless the caller carries edits over.
    if (patch.component !== undefined || patch.state !== undefined) patch = { props: '', ...patch };
    const next = resolveSelection(entries, new URLSearchParams({ ...selection, ...patch }));
    setSelection(next);
    setPage('components');
    setReset(0);
    setCopied(false);
    setCopyError('');
    window.history[replace ? 'replaceState' : 'pushState'](null, '', `${basePath}?${new URLSearchParams({ ...next })}`);
  };
  const navigateOverview = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setPage(entries.length && !needsInit ? 'overview' : 'setup');
    setQuery(''); setShowCoverage(false); setShowNav(false); setCopyError('');
    window.history.pushState(null, '', basePath);
  };
  // Choosing one variant shows it on its own, whichever view was open.
  const selectDesign = (id: string) => { setCompare(false); setGrid(false); update({ design: id }); };
  const groups = [...new Set(entries.map((item) => item.group))];
  const filtered = entries.filter((item) =>
    `${item.name} ${item.id} ${item.group} ${item.source}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  // Thumbnails follow the current state and properties, so variants compare with the same content.
  const thumbnailUrl = (id: string) => entry ? previewUrl(basePath, entry, selection, id) : '';
  const unpreviewed = coverage.filter((item) => item.status !== 'previewed');
  const frame = (idea: DesignIdea) => entry && (
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
    <TooltipProvider delayDuration={350}><div className={`dw-workbench ${collapsed ? 'dw-nav-collapsed' : ''} ${resizing ? 'dw-resizing' : ''}`} style={{ '--dw-sidebar-width': `${sidebarWidth}px` } as CSSProperties}>
      {showNav && <Button className="dw-scrim" aria-label="Close component list" onClick={() => setShowNav(false)} />}
      <aside ref={sidebarRef} className={`dw-sidebar ${showNav ? 'dw-sidebar-open' : ''}`}>
        <a className="dw-brand" href={basePath} title={project} onClick={navigateOverview}>
          <span className="dw-brand-mark"><DesignBenchMark /></span>
          <span className="dw-project-name">{project}</span>
        </a>
        <label className="dw-search">
          <span className="dw-sr-only">Search components</span>
          <Input
            ref={searchRef}
            aria-label="Search components"
            aria-keyshortcuts="Meta+K Control+K"
            placeholder="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {/* Centred like a native search field until focused or filled. */}
          <span className="dw-search-hint" aria-hidden="true"><Search size={14} /><span>Search</span></span>
          <KbdGroup className="dw-search-shortcut" aria-hidden="true"><Kbd>{shortcutModifier}</Kbd><Kbd>K</Kbd></KbdGroup>
        </label>
        <nav aria-label="Components" className="dw-nav">
          {!!entries.length && <a className="dw-all-components" href={basePath} onClick={navigateOverview} aria-current={showingOverview ? 'page' : undefined}><LayoutGrid size={15} aria-hidden="true" />All components</a>}
          {groups.map((group) => {
            const items = filtered.filter((item) => item.group === group);
            // Searching always reveals matches, whatever the saved state.
            const open = !!query || !closedGroups.includes(group);
            return items.length ? (
              <section key={group}>
                <h2>
                  <button type="button" className="dw-nav-group" aria-expanded={open} disabled={!!query} onClick={() => toggleGroup(group)}>
                    <span className="dw-nav-group-name">{group}</span>
                    <ChevronRight size={12} aria-hidden="true" />
                    <span className="dw-nav-group-count" aria-label={`${items.length} ${items.length === 1 ? 'component' : 'components'}`}>{items.length}</span>
                  </button>
                </h2>
                {open && items.map((item) => (
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
                    aria-current={showingComponent && item.id === entry?.id ? 'page' : undefined}
                    onClick={(event) => {
                      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                      event.preventDefault();
                      update({ component: item.id, design: '', state: '' });
                      setShowCoverage(false);
                      setShowNav(false);
                    }}
                  >
                    <span className="dw-nav-name">{item.name}</span>{isDraft(item) && <span className="dw-nav-draft" title="Generated preview that still needs sample content and states">Draft</span>}
                  </a>
                  </NavigationPreview>
                ))}
              </section>
            ) : null;
          })}
          {!filtered.length && <p className="dw-empty">{entries.length ? 'No matching components.' : 'No components yet.'}</p>}
        </nav>
        {!!unpreviewed.length && <Button variant="ghost" className="dw-coverage-button" onClick={() => { setPage('components'); setShowCoverage(value => !value); setShowNav(false); }}>
          Coverage & gaps <span>{unpreviewed.length}</span>
        </Button>}
        <a className="dw-setup-link" href={`${basePath}?${new URLSearchParams({ ...selection, view: 'setup' })}`} aria-current={showingSetup ? 'page' : undefined}
          onClick={event => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault(); setPage('setup'); setShowCoverage(false); setShowNav(false);
            window.history.pushState(null, '', `${basePath}?${new URLSearchParams({ ...selection, view: 'setup' })}`);
          }}><SettingsIcon size={16} aria-hidden="true" />Settings</a>
        {release && <UpdateNotice update={release} />}
        {version && <div className="dw-sidebar-footer">{`DesignBench ${version} · Local preview`}</div>}
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
        {release && <DeprecationBanner update={release} />}
        <header className="dw-topbar">
          <div className="dw-topbar-start">
            <Button
              ref={menuRef}
              variant="ghost"
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
            <Breadcrumb className="dw-breadcrumb" aria-label="Breadcrumb"><BreadcrumbList>
              <BreadcrumbItem>{showingOverview ? <BreadcrumbPage>Components</BreadcrumbPage> : <BreadcrumbLink href={basePath} onClick={navigateOverview}>Components</BreadcrumbLink>}</BreadcrumbItem>
              {!showingOverview && <><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>{showingSetup ? setupTitle : showCoverage ? 'Coverage & gaps' : entry?.name}</BreadcrumbPage></BreadcrumbItem></>}
            </BreadcrumbList></Breadcrumb>
          </div>
          {showingComponent && entry && <div className="dw-topbar-actions">
            <Tooltip><TooltipTrigger asChild><Button
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
              variant="ghost"
              aria-live="polite"
            >
              <WorkbenchIcon name="link" /><span className="dw-action-label">{copied ? 'Copied' : 'Share'}</span>
            </Button></TooltipTrigger><TooltipContent>Copy a link to this preview. Local links need the same project running.</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><a className="dw-open" href={previewUrl(basePath, entry, selection)} target="_blank" rel="noopener noreferrer"><span className="dw-action-label">Preview</span><WorkbenchIcon name="external" /></a></TooltipTrigger><TooltipContent>Open the preview on its own in a new tab</TooltipContent></Tooltip>
            <span className="dw-topbar-divider" aria-hidden="true" />
            <InspectorViewToggle view={inspectorView} onViewChange={setInspectorView} />
          </div>}
        </header>
        <div className="dw-header">
          <h1>{showingSetup ? setupTitle : showingOverview ? 'Components' : showCoverage ? 'Coverage & gaps' : entry?.name}</h1>
          {showingComponent && <p>{entry?.description}</p>}
          {showingOverview && <p>Browse your components and explore their designs.</p>}
        </div>
        {showingComponent && copyError && <p role="status" className="dw-copy-error">{copyError}</p>}
        {showingSetup ? <SetupGuide embedded needsInit={needsInit} empty={!entries.length} command={setupCommand} coverage={coverage} drafts={entries.filter(isDraft).length} connection={agentConnection}
          onShowCoverage={entry ? () => { setPage('components'); setShowCoverage(true); } : undefined} /> : showingOverview ? (
          <section className="dw-component-overview" aria-label="Component overview">
            {groups.map(group => {
              const items = filtered.filter(item => item.group === group);
              return items.length ? <section className="dw-overview-group" key={group}>
                <h2>{group}</h2>
                <div className="dw-component-grid">{items.map(item =>
                  <a key={item.id} className="dw-component-tile" href={`${basePath}?component=${item.id}`} onClick={event => {
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault(); update({ component: item.id, design: '', state: '' }); setShowNav(false);
                  }}>
                    <PreviewThumbnail title={item.name} width={item.width} fit="auto"
                      url={previewUrl(basePath, item, resolveSelection(entries, new URLSearchParams({ component: item.id })))} />
                    <div className="dw-component-tile-title"><strong>{item.name}</strong><ArrowUpRight size={16} aria-hidden="true" /></div>
                    <p>{item.description}</p><code>{item.source}</code>
                  </a>)}</div>
              </section> : null;
            })}
            {!filtered.length && <p className="dw-empty">No matching components. Try another search.</p>}
          </section>
        ) : entry && (showCoverage ? (
          <section className="dw-coverage">
            {coverage.some(item => item.status === 'missing') && <div className="dw-coverage-action">
              <p><strong>Hand the gaps to your agent.</strong> The prompt finds each component below and builds a finished preview for it.</p>
              <CopyButton text={populatePrompt(setupCommand ?? 'npx designbench')} label="Copy prompt" primary />
            </div>}
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
          <PreviewInspector projectId={projectId} entry={entry} selection={selection} controls={controls}
            view={inspectorView} onViewChange={setInspectorView}
            onViewportChange={viewport => update({ viewport })} onReset={() => setReset(value => value + 1)}
            onStateChange={state => update({ state })} onPropsChange={props => update({ props: JSON.stringify(props) }, true)}
            toolbar={<>
              {designs.length > 1 ? (
                <DesignPicker entry={entry} designs={designs} active={design} compare={compare} grid={showGrid} thumbnailUrl={thumbnailUrl}
                  onSelect={selectDesign} onCompare={() => { setGrid(false); setCompare(true); }} />
              ) : (
                <div className="dw-preview-caption" title={design.description}><span>{design.name}</span><Status idea={design} /></div>
              )}
              {canGrid && <GridToggle pressed={showGrid} onPressedChange={setGrid}
                hint={designs.length < 2 ? 'Every state at once' : entry.variants.length < 2 ? 'Every variant at once' : 'Every variant at every state'} />}
            </>}
            panels={[
              { id: 'code', label: 'Code', content: <div className="dw-panel-stack">
                <CodePanel key={entry.id} entry={entry} designs={designs} active={design} compare={compare || showGrid}
                  access={sourceAccess} onSelect={selectDesign} />
                {!!design.references?.length && <References design={design} />}
                <ContextPanel key={`contexts:${entry.id}`} entry={entry} entries={entries} basePath={basePath} controls={controls} navigate={update} />
              </div> },
              { id: 'variants', label: 'Variants', content: <VariantsPanel key={entry.id} entry={entry} designs={designs} active={design} compare={compare || showGrid}
                command={setupCommand} actions={variantActions} thumbnailUrl={thumbnailUrl} onSelect={selectDesign} /> },
            ]}>
            {showGrid && ready ? (
              // Property edits are part of every cell's URL, so they show in all of them. A chosen cell opens on its own
              // exactly as the grid showed it, edits included.
              <VariantGrid key={entry.id} entry={entry} designs={designs} active={design} state={selection.state}
                command={setupCommand} viewport={selection.viewport} restart={reset}
                cellUrl={(id, state) => previewUrl(basePath, entry, { ...selection, state }, id)}
                cellHref={(id, state) => `${basePath}?${new URLSearchParams({ ...selection, design: id, state, grid: 'off' })}`}
                onOpen={(id, state) => { setGrid(false); update({ design: id, state, props: selection.props ?? '' }); }} />
            ) : (
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
            )}
          </PreviewInspector>
        ))}
      </main>
    </div></TooltipProvider>
  );
}
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
/** References supplied by the catalog (for example from PatternGarden). Browser notes are not collected. */
function References({ design }: { design: DesignIdea }) {
  return <section className="dw-references" aria-label="References">
    <h2>References</h2>
    <ul>{design.references!.map((reference, index) => <li key={index}>
      {reference.url && safeReferenceUrl(reference.url)
        ? <a href={safeReferenceUrl(reference.url)} target="_blank" rel="noreferrer">{reference.title} ↗</a>
        : <strong>{reference.title}</strong>}
      {reference.notes && <p>{reference.notes}</p>}
    </li>)}</ul>
  </section>;
}

function WorkbenchIcon({ name }: { name: 'panels' | 'external' | 'reset' | 'link' }) {
  const Icon = { panels: PanelLeft, external: ArrowUpRight, reset: RotateCcw, link: Link2 }[name];
  return <Icon size={16} strokeWidth={1.65} aria-hidden="true" />;
}
