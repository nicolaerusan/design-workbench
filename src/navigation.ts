import type { WorkbenchEntry } from './model.ts';

export type WorkbenchPage = 'overview' | 'components' | 'setup';

/** Explicit page URLs take precedence over a retained component selection. */
export function resolveWorkbenchPage(entries: WorkbenchEntry[], query: URLSearchParams, needsInit = false): WorkbenchPage {
  if (needsInit || !entries.length || query.get('view') === 'setup') return 'setup';
  if (query.get('view') === 'components') return 'overview';
  return entries.some(entry => entry.id === query.get('component')) ? 'components' : 'overview';
}
