export interface DesignReference {
  title: string;
  url?: string;
  notes?: string;
}
export interface ProductionUsage {
  file: string;
  symbol: string;
  description: string;
}
export interface DesignIdea {
  kind?: 'exploration' | 'source';
  id: string;
  name: string;
  description?: string;
  source: string;
  /** Maintainer-reviewed source evidence; selecting a design never changes production. */
  productionUsage?: ProductionUsage[];
  references?: DesignReference[];
}
export interface WorkbenchEntry {
  id: string;
  name: string;
  group: string;
  source: string;
  description: string;
  variants: string[];
  width: number;
  designs?: DesignIdea[];
  contexts?: ComponentContext[];
}
/** App-owned relationships to real, registered composition previews. */
export interface ComponentContext {
  id: string;
  name: string;
  componentId: string;
  description: string;
  design?: string;
  state?: string;
  viewport?: 'fit' | '375' | '768' | '1280';
  /** Omit for illustrative compositions; present only after reviewing source. */
  usage?: ProductionUsage;
}
export interface CoverageItem {
  source: string;
  status: 'previewed' | 'excluded' | 'missing';
  reason?: string;
}
export interface Selection {
  component: string;
  design: string;
  state: string;
  viewport: string;
}
export function designsFor(entry: WorkbenchEntry): DesignIdea[] {
  return entry.designs?.length
    ? entry.designs
    : [{ id: 'current', name: 'Source component', source: entry.source }];
}
export function resolveSelection(entries: WorkbenchEntry[], query: URLSearchParams): Selection {
  const entry = entries.find((item) => item.id === query.get('component')) ?? entries[0];
  if (!entry) return { component: '', design: '', state: '', viewport: 'fit' };
  const designs = designsFor(entry);
  return {
    component: entry.id,
    design: designs.find((item) => item.id === query.get('design'))?.id ?? designs[0].id,
    state: entry.variants.find((state) => state === query.get('state')) ?? entry.variants[0],
    viewport: ['fit', '375', '768', '1280'].includes(query.get('viewport') ?? '')
      ? query.get('viewport')!
      : 'fit',
  };
}
export function previewUrl(
  basePath: string,
  entry: WorkbenchEntry,
  selection: Selection,
  design = selection.design,
): string {
  return `${basePath.replace(/\/$/, '')}/${encodeURIComponent(entry.id)}?${new URLSearchParams({ design, state: selection.state })}`;
}
export function validateCatalog(entries: WorkbenchEntry[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id))
      errors.push(`Invalid stable component ID: ${entry.id}`);
    if (ids.has(entry.id)) errors.push(`Duplicate component ID: ${entry.id}`);
    ids.add(entry.id);
    if (!entry.variants.length) errors.push(`No states: ${entry.id}`);
    const contextIds = new Set<string>();
    for (const context of entry.contexts ?? []) {
      const prefix = `Context ${entry.id}/${context.id}`;
      if (!context.id || contextIds.has(context.id)) errors.push(`${prefix}: missing or duplicate ID`);
      contextIds.add(context.id);
      const parent = entries.find(item => item.id === context.componentId);
      if (!parent) { errors.push(`${prefix}: unknown component ${context.componentId}`); continue; }
      if (parent.id === entry.id) errors.push(`${prefix}: must refer to a containing composition`);
      if (context.design && !designsFor(parent).some(idea => idea.id === context.design)) errors.push(`${prefix}: unknown design ${context.design}`);
      if (context.state && !parent.variants.includes(context.state)) errors.push(`${prefix}: unknown state ${context.state}`);
      if (context.viewport && !['fit', '375', '768', '1280'].includes(context.viewport)) errors.push(`${prefix}: invalid viewport`);
      if (context.usage && (!context.usage.file || !context.usage.symbol)) errors.push(`${prefix}: incomplete usage evidence`);
    }
    const designIds = new Set<string>();
    for (const design of designsFor(entry)) {
      if (designIds.has(design.id)) errors.push(`Duplicate design ID: ${entry.id}/${design.id}`);
      designIds.add(design.id);
      for (const usage of design.productionUsage ?? [])
        if (!usage.file || !usage.symbol)
          errors.push(`Incomplete production evidence: ${entry.id}/${design.id}`);
    }
  }
  return errors;
}
/** Reference URLs are links, never injected HTML or automatically loaded remote media. */
export function safeReferenceUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
