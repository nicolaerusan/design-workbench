import { useEffect, useState } from 'react';
import { Check, ChevronRight, CircleArrowUp, Copy, TriangleAlert } from 'lucide-react';
import { Button } from './ui/button.tsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible.tsx';
import { safeReferenceUrl } from './model.ts';
import type { UpdateInfo } from './model.ts';

/** The command to run, a copy button, and a link to release notes. Nothing here installs anything. */
function UpdateSteps({ update }: { update: UpdateInfo }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (copied) { const timer = setTimeout(() => setCopied(false), 2200); return () => clearTimeout(timer); } }, [copied]);
  const notes = update.notesUrl ? safeReferenceUrl(update.notesUrl) : undefined;
  return <>
    {update.command && <pre><code>{update.command}</code></pre>}
    <div className="dw-update-actions">
      {update.command && <Button variant="outline" size="sm" onClick={async () => {
        try { await navigator.clipboard.writeText(update.command!); setCopied(true); setError(''); } catch { setError('Copy is unavailable. Select the command above.'); }
      }}>{copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied ? 'Copied' : 'Copy command'}</Button>}
      {notes && <a href={notes} target="_blank" rel="noreferrer">What’s new</a>}
    </div>
    {error && <p role="status">{error}</p>}
  </>;
}

/** A quiet sidebar notice that a newer release exists. */
export function UpdateNotice({ update }: { update: UpdateInfo }) {
  if (!update.latest || update.deprecated) return null;
  return <Collapsible className="dw-update">
    <CollapsibleTrigger className="dw-update-trigger">
      <CircleArrowUp size={16} aria-hidden="true" />Update available
      <span className="dw-update-version">{update.latest}</span>
      <ChevronRight size={14} aria-hidden="true" className="dw-update-chevron" />
    </CollapsibleTrigger>
    <CollapsibleContent className="dw-update-body">
      <p>You are running {update.current}. Run this in your project terminal, then restart the workbench.</p>
      <UpdateSteps update={update} />
    </CollapsibleContent>
  </Collapsible>;
}

/** A prominent warning that the running release was deprecated by its publisher. */
export function DeprecationBanner({ update }: { update: UpdateInfo }) {
  if (!update.deprecated) return null;
  return <div className="dw-update-banner" role="alert">
    <TriangleAlert size={16} aria-hidden="true" />
    <div>
      <p><strong>DesignBench {update.current} is deprecated.</strong> {update.deprecated}</p>
      {update.latest && <p>Move to {update.latest} from your project terminal, then restart the workbench.</p>}
      <UpdateSteps update={update} />
    </div>
  </div>;
}
