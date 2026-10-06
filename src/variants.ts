import type { ReactNode } from 'react';
import { designsFor, resolvePreviewProps, type DesignIdea, type PreviewProps, type Selection, type WorkbenchEntry } from './model.ts';

export interface SavedVariant {
  componentId: string;
  design: DesignIdea;
  render: (selection: Selection, props: PreviewProps) => ReactNode;
}
/** Combine project-owned experiments without changing the production component. */
export function withVariants(entries: WorkbenchEntry[], renderSource: (selection: Selection) => ReactNode, variants: SavedVariant[]) {
  const registry = new Map<string, SavedVariant>();
  const combined = entries.map(entry => ({ ...entry, designs: [...designsFor(entry)] }));
  for (const variant of variants) {
    const entry = combined.find(entry => entry.id === variant.componentId);
    if (!entry) throw new Error('Variant references an unknown component: ' + variant.componentId);
    if (!variant.design || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(variant.design.id) || typeof variant.render !== 'function') throw new Error('Invalid saved variant: ' + variant.componentId);
    if (entry.designs.some(design => design.id === variant.design.id)) throw new Error('Duplicate design: ' + entry.id + '/' + variant.design.id);
    entry.designs.push({ ...variant.design, kind: 'exploration', productionUsage: undefined });
    registry.set(entry.id + '/' + variant.design.id, variant);
  }
  return {
    entries: combined,
    renderPreview(selection: Selection) {
      const variant = registry.get(selection.component + '/' + selection.design);
      if (!variant) return renderSource(selection);
      const entry = combined.find(entry => entry.id === selection.component)!;
      return variant.render(selection, resolvePreviewProps(entry, selection));
    },
  };
}
