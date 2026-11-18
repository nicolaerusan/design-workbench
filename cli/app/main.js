import React from 'react';
import { createRoot } from 'react-dom/client';
import { Workbench, resolveSelection, validateCatalog, describeView, describeCatalog } from 'designbench';
import 'designbench/styles.css';

const h = React.createElement;
const started = Date.now();
const panel = { padding: 24, fontFamily: 'system-ui', fontSize: 14, lineHeight: 1.5, color: '#18181b' };
const block = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '12px 0', padding: 12, borderRadius: 8, background: '#f4f4f5', fontSize: 12 };
const upgrade = `import { loadPreviews } from 'designbench';
export const { entries, renderPreview } = await loadPreviews(import.meta.glob('./previews/*.tsx'));`;

// The browser only learns that a module failed to load; the dev server knows why.
function useServerStatus() {
  const [status, setStatus] = React.useState(null);
  React.useEffect(() => {
    let current = true;
    fetch(`/__designbench/status?since=${started}`)
      .then(response => response.ok ? response.json() : null)
      .then(found => { if (current) setStatus(found); }, () => {});
    return () => { current = false; };
  }, []);
  return status;
}
function BuildErrors({ errors }) {
  return errors.map((error, index) => h('pre', { key: index, style: block },
    [error.file, error.message, error.frame].filter(Boolean).join('\n\n')));
}
/** One fixture failed to import. Everything else in the catalog is unaffected. */
function LoadFailure({ file, reason }) {
  const status = useServerStatus();
  const errors = (status?.errors ?? []).filter(error => error.fixtures.includes(file));
  return h('main', { style: panel },
    h('h2', { style: { margin: 0, fontSize: 18 } }, 'This fixture could not be loaded'),
    h('p', null, h('code', null, file)),
    // A browser reports a failed build only as a module that could not be fetched.
    !(errors.length && /module/i.test(reason)) && h('pre', { style: block }, reason),
    h(BuildErrors, { errors }),
    h('p', null, (errors.length ? 'Fix the file named in the error and save.'
      : /module/i.test(reason) ? 'One of its imports failed to build. The terminal running designbench dev shows the error.'
      : 'The error was thrown while this fixture, or a file it imports, was loading.') + ' The other fixtures are not affected.'));
}
/** The catalog itself failed to import, so there is nothing to list. */
function StartupFailure({ error }) {
  const status = useServerStatus();
  return h('main', { style: panel },
    h('h2', { style: { margin: 0, fontSize: 18 } }, 'The workbench could not start'),
    h('p', null, h('code', null, '.design-workbench/catalog.ts'), ', or something it imports, failed to load.'),
    !(status?.errors.length && /module/i.test(String(error?.message))) && h('pre', { style: block }, error instanceof Error ? error.message : String(error)),
    h(BuildErrors, { errors: status?.errors ?? [] }),
    status?.eagerCatalog && h(React.Fragment, null,
      h('p', null, 'This catalog imports every fixture in one step, so one fixture that fails stops all of them. To list a broken fixture with its error and keep the others working, replace the ', h('code', null, 'import.meta.glob'), ' block in ', h('code', null, '.design-workbench/catalog.ts'), ' with:'),
      h('pre', { style: block }, upgrade)));
}

const scopeNote = 'Found by the last scan of your source folders. Run scan --write (or the Populate prompt in Settings) to refresh this list.';
const fileUrl = file => '/' + file.split('/').map(encodeURIComponent).join('/');
// "Use … in my app" in the Variants tab runs the same guarded promotion as `variant promote --apply`.
const variantActions = {
  promote: async (component, variant) => {
    const response = await fetch('/__designbench/promote', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-DesignBench': '1' }, body: JSON.stringify({ component, variant }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'The variant could not be applied.');
    return result;
  },
};

/**
 * Tells the dev server what this tab is showing, so an agent connected with `designbench mcp` can ask
 * "what am I looking at?" and open a view here. Only names, ids and file paths are sent, and only to this server.
 */
function createReporter({ entries, project, coverage }) {
  const tab = Math.random().toString(36).slice(2) + Date.now().toString(36);
  let view = null, sentCatalog = false, timer = 0, confirming, onAgent = () => {};
  const report = async extra => {
    const withCatalog = !sentCatalog;
    sentCatalog = true;
    // An agent's open request is confirmed by the next report, whichever change triggers it.
    const ack = confirming;
    confirming = undefined;
    try {
      const response = await fetch('/__designbench/view', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', 'X-DesignBench': '1' },
        body: JSON.stringify({ tab, ...(view ? { view: { ...describeView(entries, view, '/'), url: location.href } } : {}), ...(withCatalog ? { catalog: describeCatalog(project, entries, coverage) } : {}), ...(ack ? { ack } : {}), ...extra }) });
      const result = await response.json();
      // A restarted server has forgotten the catalog; the next report carries it again.
      if (result.needsCatalog) sentCatalog = false;
      onAgent(result.agent ?? null);
    } catch { if (withCatalog) sentCatalog = false; }
  };
  // Reports settle for a moment first, so typing in a property field sends one update rather than one per key.
  const schedule = (delay = 150) => { clearTimeout(timer); timer = setTimeout(report, delay); };
  return {
    viewChanged(next) { view = next; schedule(); },
    /** Follows this tab's focus and the dev server's requests. Returns the cleanup. */
    listen(setAgent) {
      onAgent = setAgent;
      // The tab the user returns to is the one an agent should act on.
      const returned = () => { if (document.visibilityState === 'visible' && view) schedule(); };
      const left = () => report({ closed: true });
      window.addEventListener('focus', returned); document.addEventListener('visibilitychange', returned);
      window.addEventListener('pageshow', returned); window.addEventListener('pagehide', left);
      const open = ({ id, tab: target, search }) => {
        if (target !== tab) return;
        history.pushState(null, '', '/' + search);
        window.dispatchEvent(new PopStateEvent('popstate'));
        // Confirm once the page has rendered the new view.
        confirming = id;
        schedule(60);
      };
      import.meta.hot?.on('designbench:open', open);
      import.meta.hot?.on('designbench:agent', setAgent);
      return () => {
        onAgent = () => {};
        window.removeEventListener('focus', returned); document.removeEventListener('visibilitychange', returned);
        window.removeEventListener('pageshow', returned); window.removeEventListener('pagehide', left);
        import.meta.hot?.off('designbench:open', open); import.meta.hot?.off('designbench:agent', setAgent);
      };
    },
  };
}
/** The workbench with what the dev server adds: coverage, file access, switching variants, and the view report for agents. */
function Shell({ entries, project, needsInit, setupCommand, projectRoot, discovered, version, update }) {
  const [agent, setAgent] = React.useState(null);
  // The catalog loads once per page, so these are worked out once.
  const [host] = React.useState(() => {
    // Coverage compares the last scan with the previews that exist now, so it updates as fixtures are added.
    const previewedSources = new Set(entries.flatMap(entry => [entry.source, ...(entry.designs ?? []).map(design => design.source)]));
    const coverage = discovered.map(source => ({ source, status: previewedSources.has(source) ? 'previewed' : 'missing' }));
    // The Code tab reads project files through Vite (which applies its serving allow and deny lists)
    // and opens them with Vite's editor launcher.
    const sourceAccess = {
      read: async file => (await import(/* @vite-ignore */ `${fileUrl(file)}?raw&t=${Date.now()}`)).default,
      open: file => { fetch('/__open-in-editor?file=' + encodeURIComponent(projectRoot + '/' + file)).catch(() => {}); },
    };
    return { coverage, sourceAccess, reporter: createReporter({ entries, project, coverage }) };
  });
  React.useEffect(() => host.reporter.listen(setAgent), [host]);
  return h(Workbench, { entries, project, projectId: project, basePath: '/', setupCommand, needsInit, version, update: update ?? undefined,
    sourceAccess: host.sourceAccess, variantActions, coverage: host.coverage, scopeNote, onViewChange: host.reporter.viewChanged, agentConnection: agent });
}

class PreviewBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (error.name === 'PreviewLoadError' && typeof error.file === 'string') return h(LoadFailure, { file: error.file, reason: error.reason ?? error.message });
    return h('main', { style: { padding: 24, fontFamily: 'system-ui' } },
      h('h2', null, 'This fixture needs attention'),
      h('pre', { style: { whiteSpace: 'pre-wrap' } }, error.message),
      h('p', null, 'Check props, providers, and styles in .design-workbench/previews/. Save changes and reset the preview.'));
  }
}
function Preview({ entries, renderPreview }) {
  const query = new URLSearchParams(location.search);
  const component = decodeURIComponent(location.pathname.slice(1));
  if (!entries.some(entry => entry.id === component)) throw new Error(`Unknown component: ${component}`);
  query.set('component', component);
  return renderPreview(resolveSelection(entries, query));
}
function ConnectionNotice({ setupCommand }) {
  const [disconnected, setDisconnected] = React.useState(false);
  React.useEffect(() => {
    if (!import.meta.hot) return;
    const stopped = () => setDisconnected(true);
    const started = () => setDisconnected(false);
    import.meta.hot.on('vite:ws:disconnect', stopped);
    import.meta.hot.on('vite:ws:connect', started);
    return () => { import.meta.hot.off('vite:ws:disconnect', stopped); import.meta.hot.off('vite:ws:connect', started); };
  }, []);
  if (!disconnected) return null;
  return h('aside', { role: 'status', style: { padding: '16px 24px', fontFamily: 'system-ui', fontSize: 13, background: '#fff8e8', borderBottom: '1px solid #e7d9bc' } },
    h('strong', null, 'Preview server disconnected'),
    h('p', null, 'If it has stopped, run this in your project terminal, then reload:'),
    h('code', { style: { overflowWrap: 'anywhere' } }, setupCommand + ' dev'));
}

const root = createRoot(document.getElementById('root'));
// Imported here rather than at the top, so a catalog that fails to load is explained on the page.
import('virtual:design-workbench').then(({ entries, renderPreview, project, needsInit, setupCommand, projectRoot, discovered, version, update }) => {
  const errors = validateCatalog(entries);
  if (errors.length) root.render(h('pre', null, `Fix the catalog:\n${errors.join('\n')}`));
  else root.render(h(PreviewBoundary, null,
    location.pathname === '/' ? h(React.Fragment, null, h(ConnectionNotice, { setupCommand }), h(Shell, { entries, project, needsInit, setupCommand, projectRoot, discovered, version, update })) : h(Preview, { entries, renderPreview })));
}, error => root.render(h(StartupFailure, { error })));
// Without an HMR acceptance boundary, Vite reloads the page on fixture edits.
