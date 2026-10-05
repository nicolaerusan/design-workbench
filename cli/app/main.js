import React from 'react';
import { createRoot } from 'react-dom/client';
import { Workbench, SetupGuide, resolveSelection, validateCatalog } from '@design-workbench/react';
import '@design-workbench/react/styles.css';
import { entries, renderPreview, project, needsInit, setupCommand } from 'virtual:design-workbench';

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
  location.pathname === '/' ? React.createElement(React.Fragment, null, React.createElement(ConnectionNotice), needsInit ? React.createElement(SetupGuide, { needsInit: true, command: setupCommand }) : React.createElement(Workbench, { entries, project, projectId: project, basePath: '/', setupCommand })) : React.createElement(Preview)));
// Without an HMR acceptance boundary, Vite reloads the page on fixture edits.
