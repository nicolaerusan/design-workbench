/// <reference types="vite/client" />
// This file belongs to your project. Customize it for providers or shared styles.
// Import your global CSS here if required by your components.
const modules = import.meta.glob('./previews/*.tsx', { eager: true });
export const previews = Object.values(modules) as Array<{
  entry: import('@design-workbench/react').WorkbenchEntry;
  render: (selection: import('@design-workbench/react').Selection) => import('react').ReactNode;
}>;
export const entries = previews.map(preview => preview.entry);
export function renderPreview(selection: import('@design-workbench/react').Selection) {
  const preview = previews.find(preview => preview.entry.id === selection.component);
  if (!preview) throw new Error('Unknown component: ' + selection.component);
  return preview.render(selection);
}
