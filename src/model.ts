export type PreviewProps = Record<string, string | number | boolean>;
export type PropControl = { label?: string; description?: string } & (
  | { type: 'text'; defaultValue: string }
  | { type: 'boolean'; defaultValue: boolean }
  | { type: 'number'; defaultValue: number; min?: number; max?: number }
  | { type: 'select'; defaultValue: string; options: string[] }
);

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
  propControls?: Record<string, PropControl>;
  stateProps?: Record<string, PreviewProps>;
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
  /** Validated JSON property overrides, shared with preview URLs. */
  props?: string;
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
  const overrides = propertyOverrides(entry, query.get('props') ?? undefined);
  return {
    ...(Object.keys(overrides).length ? { props: JSON.stringify(overrides) } : {}),
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
  const query = new URLSearchParams({ design, state: selection.state });
  const props = propertyOverrides(entry, selection.props);
  if (Object.keys(props).length) query.set('props', JSON.stringify(props));
  return `${basePath.replace(/\/$/, '')}/${encodeURIComponent(entry.id)}?${query}`;
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
    for (const [name, control] of Object.entries(entry.propControls ?? {})) {
      if (['__proto__', 'constructor', 'prototype'].includes(name) || !validProp(control, control.defaultValue)) errors.push(`Invalid property control: ${entry.id}/${name}`);
      if (control.type === 'select' && (!control.options.length || new Set(control.options).size !== control.options.length)) errors.push(`Invalid property options: ${entry.id}/${name}`);
    }
    for (const [state, props] of Object.entries(entry.stateProps ?? {})) {
      if (!entry.variants.includes(state)) errors.push(`Unknown property preset state: ${entry.id}/${state}`);
      for (const [name, value] of Object.entries(props)) {
        if (!Object.hasOwn(entry.propControls ?? {}, name) || !validProp(entry.propControls![name], value)) errors.push(`Invalid preset property: ${entry.id}/${state}/${name}`);
      }
    }
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

function validProp(control: PropControl, value: unknown): value is string | number | boolean {
  switch (control.type) {
    case 'text': return typeof value === 'string' && value.length <= 2000;
    case 'boolean': return typeof value === 'boolean';
    case 'select': return typeof value === 'string' && control.options.includes(value);
    case 'number': return typeof value === 'number' && Number.isFinite(value) && (control.min === undefined || value >= control.min) && (control.max === undefined || value <= control.max);
    default: return false;
  }
}
function filterProps(entry: WorkbenchEntry, input: unknown): PreviewProps {
  const output: PreviewProps = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return output;
  for (const [name, control] of Object.entries(entry.propControls ?? {})) {
    if (['__proto__', 'constructor', 'prototype'].includes(name) || !Object.hasOwn(input, name)) continue;
    const value = (input as Record<string, unknown>)[name];
    if (validProp(control, value)) output[name] = value;
  }
  return output;
}
function propertyOverrides(entry: WorkbenchEntry, json?: string): PreviewProps {
  if (!json || json.length > 16000) return {};
  try { return filterProps(entry, JSON.parse(json)); } catch { return {}; }
}
/** Defaults < selected state preset < validated URL overrides. Apply these in the host fixture. */
export function resolvePreviewProps(entry: WorkbenchEntry, selection: Selection): PreviewProps {
  const defaults = Object.fromEntries(Object.entries(entry.propControls ?? {}).map(([name, control]) => [name, control.defaultValue]));
  return { ...filterProps(entry, defaults), ...filterProps(entry, entry.stateProps?.[selection.state]), ...propertyOverrides(entry, selection.props) };
}
