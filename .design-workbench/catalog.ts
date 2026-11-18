/// <reference types="vite/client" />
// DesignBench's own catalog: every preview in ./previews renders the real component from ../src.
import '../src/styles.css';
import type { ReactNode } from 'react';
import type { Selection, WorkbenchEntry } from '../src/model.ts';

const modules = import.meta.glob<{ entry: WorkbenchEntry; render: (selection: Selection) => ReactNode }>('./previews/*.tsx', { eager: true });
const groupOrder = ['Controls', 'Menus & overlays', 'Navigation & layout', 'Workbench parts', 'Pages', 'Identity'];
const rank = (group: string) => { const index = groupOrder.indexOf(group); return index < 0 ? groupOrder.length : index; };
export const previews = Object.values(modules).sort((a, b) => rank(a.entry.group) - rank(b.entry.group) || a.entry.name.localeCompare(b.entry.name));
export const entries = previews.map(preview => preview.entry);
export function renderPreview(selection: Selection) {
  const preview = previews.find(preview => preview.entry.id === selection.component);
  if (!preview) throw new Error('Unknown component: ' + selection.component);
  return preview.render(selection);
}
