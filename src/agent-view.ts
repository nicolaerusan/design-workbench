import { designFiles, designsFor, isDraft, previewUrl, resolvePreviewProps } from './model.ts';
import type { CoverageItem, DesignIdea, PreviewProps, Selection, WorkbenchEntry } from './model.ts';

/** What the workbench is showing, as the Workbench component reports it. */
export interface WorkbenchView {
  page: 'overview' | 'component' | 'settings' | 'coverage';
  selection: Selection;
  /** Every variant is shown side by side. */
  comparing: boolean;
  /** Every variant is shown at every state, in a grid. */
  grid: boolean;
}
/** An agent that has called in over MCP. */
export interface AgentConnection {
  /** The agent's name, as it introduced itself. */
  client: string;
  /** When it last called, in milliseconds since the epoch. */
  at: number;
}

// Agents hear the same words the workbench shows: a component has states and variants.
const kind = (design: DesignIdea, source: DesignIdea) => design === source ? 'source' as const : 'variant' as const;
const sourceOf = (designs: DesignIdea[]) => designs.find(design => design.kind !== 'exploration') ?? designs[0];

/** The current view in terms an agent can act on: names, ids, and the files behind what is on screen. */
export function describeView(entries: WorkbenchEntry[], view: WorkbenchView, basePath = '/') {
  const entry = entries.find(item => item.id === view.selection.component);
  if (view.page !== 'component' || !entry) return { page: view.page };
  const designs = designsFor(entry);
  const design = designs.find(item => item.id === view.selection.design) ?? designs[0];
  const edited: PreviewProps = view.selection.props ? JSON.parse(view.selection.props) : {};
  return {
    page: view.page,
    component: { id: entry.id, name: entry.name, source: entry.source, ...(entry.fixture ? { fixture: entry.fixture } : {}), ...(isDraft(entry) ? { draft: true } : {}) },
    variant: { id: design.id, name: design.name, kind: kind(design, sourceOf(designs)), files: designFiles(entry, design).map(file => ({ path: file.path, role: file.label })) },
    state: view.selection.state,
    viewport: view.selection.viewport,
    ...(view.comparing ? { comparing: true } : {}),
    ...(view.grid ? { grid: true } : {}),
    properties: resolvePreviewProps(entry, view.selection),
    ...(Object.keys(edited).length ? { editedProperties: edited } : {}),
    previewPath: previewUrl(basePath, entry, view.selection, design.id),
  };
}

/** Every component with its states and variants, plus which component files still lack a preview. */
export function describeCatalog(project: string, entries: WorkbenchEntry[], coverage: CoverageItem[] = []) {
  return {
    project,
    components: entries.map(entry => {
      const designs = designsFor(entry);
      const source = sourceOf(designs);
      return {
        id: entry.id, name: entry.name, group: entry.group, source: entry.source, description: entry.description,
        ...(entry.fixture ? { fixture: entry.fixture } : {}), ...(isDraft(entry) ? { draft: true } : {}),
        states: entry.variants,
        variants: designs.map(design => ({ id: design.id, name: design.name, kind: kind(design, source), source: design.source })),
      };
    }),
    coverage: coverage.map(item => ({ source: item.source, status: item.status })),
  };
}
