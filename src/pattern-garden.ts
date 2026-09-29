import { safeReferenceUrl, type DesignReference } from './model.ts';

/** A portable adapter boundary. The workbench never fetches or imports captured site code. */
export interface PatternGardenSource {
  name: string;
  canonicalUrl: string;
  limitations?: readonly string[];
  captures: readonly { id: string; patternGardenUrl: string; capturedAt?: string }[];
}

export function patternGardenReferences(source: PatternGardenSource): DesignReference[] {
  const references: DesignReference[] = [];
  const url = safeReferenceUrl(source.canonicalUrl);
  if (url) references.push({ title: `${source.name} · actual site`, url });
  for (const capture of source.captures) {
    const evidenceUrl = safeReferenceUrl(capture.patternGardenUrl);
    if (evidenceUrl) references.push({
      title: `${source.name} · PatternGarden capture ${capture.id}`,
      url: evidenceUrl,
      notes: [capture.capturedAt ? `Captured ${capture.capturedAt}.` : '', ...(source.limitations ?? [])].filter(Boolean).join(' '),
    });
  }
  return references;
}
