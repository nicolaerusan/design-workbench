import React from 'react';
import { createRoot } from 'react-dom/client';
import { Workbench, resolveSelection, validateCatalog } from '@design-workbench/react';
import '@design-workbench/react/styles.css';
import { entries, renderPreview, project } from 'virtual:design-workbench';

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
const errors = validateCatalog(entries);
const root = createRoot(document.getElementById('root'));
if (errors.length) root.render(React.createElement('pre', null, `Fix the catalog:\n${errors.join('\n')}`));
else root.render(React.createElement(PreviewBoundary, null,
  location.pathname === '/' ? React.createElement(Workbench, { entries, project, projectId: project, basePath: '/' }) : React.createElement(Preview)));
// Catalog and fixture edits invalidate this module, refreshing the preview.
if (import.meta.hot) import.meta.hot.accept(() => location.reload());
