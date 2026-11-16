import React from 'react';
import { createRoot } from 'react-dom/client';
import { Workbench, resolveSelection, validateCatalog, describeView, describeCatalog } from 'designbench';
import 'designbench/styles.css';
import { entries, renderPreview, project, needsInit, setupCommand, projectRoot, discovered } from 'virtual:design-workbench';

// Coverage compares the last scan with the previews that exist now, so it updates as fixtures are added.
const previewedSources = new Set(entries.flatMap(entry => [entry.source, ...(entry.designs ?? []).map(design => design.source)]));
const coverage = discovered.map(source => ({ source, status: previewedSources.has(source) ? 'previewed' : 'missing' }));
const scopeNote = 'Found by the last scan of your source folders. Run scan --write (or the Populate prompt in Settings) to refresh this list.';

// The Code tab reads project files through Vite (which applies its serving allow and deny lists)
// and opens them with Vite's editor launcher.
const fileUrl = file => '/' + file.split('/').map(encodeURIComponent).join('/');
const sourceAccess = {
  read: async file => (await import(/* @vite-ignore */ `${fileUrl(file)}?raw&t=${Date.now()}`)).default,
  open: file => { fetch('/__open-in-editor?file=' + encodeURIComponent(projectRoot + '/' + file)).catch(() => {}); },
};
// "Use … in my app" in the Variants tab runs the same guarded promotion as `variant promote --apply`.
const variantActions = {
  promote: async (component, variant) => {
    const response = await fetch('/__designbench/promote', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-DesignBench': '1' }, body: JSON.stringify({ component, variant }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'The variant could not be applied.');
    return result;
  },
};

// Tells the dev server what this tab is showing, so an agent connected with `designbench mcp` can ask
// "what am I looking at?" and open a view here. Only names, ids and file paths are sent, and only to this server.
const tab = Math.random().toString(36).slice(2) + Date.now().toString(36);
let view = null, sentCatalog = false, timer = 0, confirming, agentListener = () => {};
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
    agentListener(result.agent ?? null);
  } catch { if (withCatalog) sentCatalog = false; }
};
// Reports settle for a moment first, so typing in a property field sends one update rather than one per key.
const schedule = (delay = 150) => { clearTimeout(timer); timer = setTimeout(report, delay); };
const viewChanged = next => { view = next; schedule(); };
function Shell() {
  const [agent, setAgent] = React.useState(null);
  React.useEffect(() => {
    agentListener = setAgent;
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
      window.removeEventListener('focus', returned); document.removeEventListener('visibilitychange', returned);
      window.removeEventListener('pageshow', returned); window.removeEventListener('pagehide', left);
      import.meta.hot?.off('designbench:open', open); import.meta.hot?.off('designbench:agent', setAgent);
    };
  }, []);
  return React.createElement(Workbench, { entries, project, projectId: project, basePath: '/', setupCommand, needsInit, sourceAccess, variantActions, coverage, scopeNote, onViewChange: viewChanged, agentConnection: agent });
}

class PreviewBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return React.createElement('main', { style: { padding: 24, fontFamily: 'system-ui' } },
      React.createElement('h2', null, 'This fixture needs attention'),
      React.createElement('pre', { style: { whiteSpace: 'pre-wrap' } }, this.state.error.message),
      React.createElement('p', null, 'Check props, providers, and styles in .design-workbench/previews/. Save changes and reset the preview.'));
    return this.props.children;
  }
}
function Preview() {
  const query = new URLSearchParams(location.search);
  const component = decodeURIComponent(location.pathname.slice(1));
  if (!entries.some(entry => entry.id === component)) throw new Error(`Unknown component: ${component}`);
  query.set('component', component);
  return renderPreview(resolveSelection(entries, query));
}
function ConnectionNotice() {
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
  return React.createElement('aside', { role: 'status', style: { padding: '16px 24px', fontFamily: 'system-ui', fontSize: 13, background: '#fff8e8', borderBottom: '1px solid #e7d9bc' } },
    React.createElement('strong', null, 'Preview server disconnected'),
    React.createElement('p', null, 'If it has stopped, run this in your project terminal, then reload:'),
    React.createElement('code', { style: { overflowWrap: 'anywhere' } }, setupCommand + ' dev'));
}
const errors = validateCatalog(entries);
const root = createRoot(document.getElementById('root'));
if (errors.length) root.render(React.createElement('pre', null, `Fix the catalog:\n${errors.join('\n')}`));
else root.render(React.createElement(PreviewBoundary, null,
  location.pathname === '/' ? React.createElement(React.Fragment, null, React.createElement(ConnectionNotice), React.createElement(Shell)) : React.createElement(Preview)));
// Without an HMR acceptance boundary, Vite reloads the page on fixture edits.
