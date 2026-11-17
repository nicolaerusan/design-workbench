import type { ReactNode } from 'react';
import type { Selection, WorkbenchEntry } from './model.ts';

/** What a fixture file in `.design-workbench/previews/` exports. */
export interface PreviewModule {
  entry: WorkbenchEntry;
  render: (selection: Selection) => ReactNode;
}
/** A fixture that could not be imported. It stays in the catalog so the failure is visible. */
export interface PreviewFailure {
  /** Project-relative path of the fixture file. */
  file: string;
  /** The catalog entry standing in for it. */
  id: string;
  message: string;
}
/** Thrown when a fixture that failed to import is rendered. */
export class PreviewLoadError extends Error {
  readonly file: string;
  readonly reason: string;
  constructor(file: string, reason: string) {
    super(`${file} could not be loaded: ${reason}`);
    this.name = 'PreviewLoadError';
    this.file = file;
    this.reason = reason;
  }
}

const reasonFor = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 2000);

/**
 * Import fixtures one by one, so a fixture whose imports fail is listed with its
 * error instead of stopping every other preview.
 *
 * Pass the lazy form of Vite's glob: `loadPreviews(import.meta.glob('./previews/*.tsx'))`.
 * `base` is the directory the glob is relative to, used to report project-relative paths.
 */
export async function loadPreviews(
  loaders: Record<string, () => Promise<unknown>>,
  { base = '.design-workbench' }: { base?: string } = {},
) {
  const loaded = await Promise.all(Object.keys(loaders).sort().map(async key => {
    const file = `${base.replace(/\/+$/, '')}/${key.replace(/^\.?\/+/, '')}`;
    try {
      const module = await loaders[key]() as Partial<PreviewModule> | undefined;
      if (!module?.entry || typeof module.entry.id !== 'string' || typeof module.render !== 'function')
        throw new Error('A fixture must export `entry` and `render`.');
      return { file, preview: module as PreviewModule };
    } catch (error) {
      return { file, reason: reasonFor(error) };
    }
  }));
  const ids = new Set(loaded.flatMap(item => item.preview ? [item.preview.entry.id] : []));
  const previews = new Map<string, PreviewModule>();
  const failures: PreviewFailure[] = [];
  const entries = loaded.map(item => {
    if (item.preview) {
      // A repeated ID is reported by validateCatalog; the first fixture keeps rendering.
      if (!previews.has(item.preview.entry.id)) previews.set(item.preview.entry.id, item.preview);
      return item.preview.entry;
    }
    const stem = item.file.slice(item.file.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
    const slug = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'fixture';
    let id = slug;
    for (let n = 2; ids.has(id); n++) id = `${slug}-unloaded${n > 2 ? `-${n - 1}` : ''}`;
    ids.add(id);
    failures.push({ file: item.file, id, message: item.reason });
    const entry: WorkbenchEntry = {
      id,
      // Generated fixture names end in a hash of their source; the readable part is enough here.
      name: stem.replace(/-[0-9a-f]{16}$/, '') || stem,
      group: 'Needs attention',
      source: item.file,
      description: `This fixture could not be loaded. ${item.reason}`,
      variants: ['Default'],
      width: 640,
    };
    return entry;
  });
  const failed = new Map(failures.map(failure => [failure.id, failure]));
  return {
    entries,
    failures,
    renderPreview(selection: Selection): ReactNode {
      const failure = failed.get(selection.component);
      if (failure) throw new PreviewLoadError(failure.file, failure.message);
      const preview = previews.get(selection.component);
      if (!preview) throw new Error('Unknown component: ' + selection.component);
      return preview.render(selection);
    },
  };
}
