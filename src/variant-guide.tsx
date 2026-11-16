import { useEffect, useState } from 'react';
import { Copy, Check, ChevronDown, ChevronRight, Component, Layers, LoaderCircle } from 'lucide-react';
import { Button } from './ui/button.tsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible.tsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.tsx';
import { PreviewThumbnail } from './thumbnail.tsx';
import type { DesignIdea, WorkbenchEntry } from './model.ts';

/** Actions on saved variants that need the dev server. The CLI supplies these; embedded workbenches show commands instead. */
export interface VariantActions {
  /** Replace the app's source file with a saved variant. Rejects with a readable message when the guard stops it. */
  promote?: (component: string, variant: string) => Promise<{ status: 'applied' | 'unchanged'; target: string; backup?: string }>;
}

const isSaved = (entry: WorkbenchEntry, design: DesignIdea) => design.source.startsWith(`.design-workbench/ideas/${entry.id}/${design.id}/`);
/** The app's own design comes first; everything else is a variant. */
export function splitDesigns(designs: DesignIdea[]) {
  const source = designs.find(design => design.kind !== 'exploration') ?? designs[0];
  return { source, variants: designs.filter(design => design !== source) };
}

/** A small live preview of one design at the current state, for menus and lists. */
function DesignThumbnail({ design, thumbnailUrl, size = 'small' }: { design: DesignIdea; thumbnailUrl?: (design: string) => string; size?: 'small' | 'medium' }) {
  if (!thumbnailUrl) return null;
  return <PreviewThumbnail className={`dw-design-thumbnail dw-design-thumbnail-${size}`} fit="content" renderWidth={480} title={design.name} url={thumbnailUrl(design.id)} />;
}

/**
 * Two separate controls: the source component the app uses today, and a menu of variants to try instead.
 * Hovering the source explains where it comes from.
 */
export function DesignPicker({ entry, designs, active, compare, grid = false, thumbnailUrl, onSelect, onCompare }: {
  entry: WorkbenchEntry; designs: DesignIdea[]; active: DesignIdea; compare: boolean;
  /** The grid view is showing every design, so neither control is the one on screen. */
  grid?: boolean;
  thumbnailUrl?: (design: string) => string;
  onSelect: (design: string) => void; onCompare: () => void;
}) {
  const { source, variants } = splitDesigns(designs);
  const single = !compare && !grid;
  const sourceActive = single && active.id === source.id;
  const variantActive = single && !sourceActive;
  return <div className="dw-design-picker" role="group" aria-label="Design">
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="dw-design-choice dw-design-source" aria-pressed={sourceActive} onClick={() => onSelect(source.id)}>
          <Component size={14} aria-hidden="true" />{source.name}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="dw-design-source-tip">
        <strong>The {entry.name} your app uses today</strong>
        <span>Rendered from <code>{source.source}</code>. Variants are copies you can try against it; your app only changes when you choose one.</span>
      </TooltipContent>
    </Tooltip>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="dw-design-choice dw-design-variants" data-active={variantActive || compare}
          aria-label={compare ? 'Variant: comparing all' : variantActive ? `Variant: ${active.name}` : `Variants, ${variants.length} available`}>
          <Layers size={14} aria-hidden="true" />
          {compare || variantActive
            ? <><span className="dw-design-variant-label">Variant</span><span className="dw-design-variant-value">{compare ? 'Compare all' : active.name}</span></>
            : <><span>Variants</span><span className="dw-design-count">{variants.length}</span></>}
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="dw-design-menu">
        <DropdownMenuLabel>Variants of {entry.name}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={compare ? 'compare' : variantActive ? `design:${active.id}` : ''}
          onValueChange={value => value === 'compare' ? onCompare() : onSelect(value.slice('design:'.length))}>
          {variants.map(design => <DropdownMenuRadioItem key={design.id} value={`design:${design.id}`} className="dw-design-menu-item">
            <DesignThumbnail design={design} thumbnailUrl={thumbnailUrl} />
            <span className="dw-design-menu-text"><span>{design.name}</span>{design.description && <small>{design.description}</small>}</span>
          </DropdownMenuRadioItem>)}
          <DropdownMenuSeparator />
          <DropdownMenuRadioItem value="compare">Compare all side by side</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}

type Promoted = { name: string; target: string; backup?: string; status: 'applied' | 'unchanged' };

/** The Variants tab: what variants are, the ones saved for this component, and how to add or adopt one. */
export function VariantsPanel({ entry, designs, active, compare, command, actions, thumbnailUrl, onSelect }: {
  entry: WorkbenchEntry; designs: DesignIdea[]; active: DesignIdea; compare: boolean; command?: string;
  actions?: VariantActions; thumbnailUrl?: (design: string) => string;
  onSelect: (design: string) => void;
}) {
  const { source, variants } = splitDesigns(designs);
  const saved = variants.some(design => isSaved(entry, design)) || !variants.length;
  // Writing the app's source reloads the page, so the confirmation is kept for this browser tab until it is shown.
  const promotedKey = `design-workbench:promoted:${entry.id}`;
  const [promoted, setPromotedState] = useState<Promoted | null>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(promotedKey) ?? 'null');
      sessionStorage.removeItem(promotedKey);
      if (saved && Date.now() - saved.at < 60_000 && typeof saved.name === 'string' && typeof saved.target === 'string') setPromotedState(saved);
    } catch {}
  }, [promotedKey]);
  const remember = (result: Promoted | null) => {
    try { if (result) sessionStorage.setItem(promotedKey, JSON.stringify({ ...result, at: Date.now() })); else sessionStorage.removeItem(promotedKey); } catch {}
  };
  return <div className="dw-variants">
    <h2>Variants</h2>
    <p>{saved
      ? <>Variants are other versions of this component. Each is saved in its own folder in <code>.design-workbench/ideas</code>, so your app’s code stays unchanged while you compare them. When you choose one, you can switch your app to it.</>
      : 'Variants are other versions of this component, registered in your catalog. Selecting one only changes the preview.'}</p>
    {promoted && <div className="dw-promoted" role="status">
      <Check size={14} aria-hidden="true" />
      <p>{promoted.status === 'unchanged'
        ? <>Your app already matches {promoted.name}. Nothing changed.</>
        : <>Your app now uses {promoted.name}. <code>{promoted.target}</code> was replaced{promoted.backup && <>; the previous version is saved at <code>{promoted.backup}</code></>}. Review the change in Git before committing.</>}</p>
    </div>}
    {variants.length ? <ul className="dw-variant-list">
      {variants.map(design => <li key={design.id}>
        <DesignThumbnail design={design} thumbnailUrl={thumbnailUrl} size="medium" />
        <div><strong>{design.name}</strong>{design.description && <span>{design.description}</span>}</div>
        {compare || design.id === active.id ? <span className="dw-tree-showing">In preview</span>
          : <Button variant="ghost" size="sm" className="dw-tree-preview" aria-label={`Preview ${design.name}`} onClick={() => onSelect(design.id)}>Preview</Button>}
      </li>)}
    </ul> : <p className="dw-variants-empty">No variants yet.</p>}
    <VariantGuide entry={entry} design={active} command={command} actions={actions} promotion={{
      // The reload can arrive before the response, so the expected result is saved first.
      start: name => remember({ name, target: entry.source, status: 'applied' }),
      fail: () => remember(null),
      done: result => { remember(result); setPromotedState(result); if (result.status === 'applied') onSelect(source.id); },
    }} />
  </div>;
}

/** Adopting the selected saved variant, and creating a new one with an agent. */
type PromotionEvents = { start?: (name: string) => void; fail?: () => void; done?: (result: Promoted) => void };
export function VariantGuide({ entry, design, command = 'npx designbench', actions, promotion }: {
  entry: WorkbenchEntry; design: DesignIdea; command?: string; actions?: VariantActions; promotion?: PromotionEvents;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { if (copied) { const timer = setTimeout(() => setCopied(false), 2200); return () => clearTimeout(timer); } }, [copied]);
  const saved = isSaved(entry, design);
  const prompt = `Read .design-workbench/AGENT.md and the existing preview for ${JSON.stringify(entry.id)} (${entry.name}). Inspect ${JSON.stringify(entry.source)} to find its public component export. Create a new visual variant with ${command} variant create ${entry.id} <variant-id> --from '<source-file>#<export-name>' --name '<display-name>'. Edit the copied component under .design-workbench/ideas/ and its index.tsx fixture, preserving public props, behavior, providers, and state presets. Keep the application source unchanged. Open this component in DesignBench, compare the app source and alternatives at the same state and viewport, and verify interactions. If this is an embedded workbench, register the alternative in entry.designs and its render function instead. Do not promote until I choose a direction.`;
  return <div className="dw-variant-guide">
    {saved && (actions?.promote
      ? <PromoteVariant key={design.id} entry={entry} design={design} promote={actions.promote} events={promotion} />
      : <section className="dw-variant-promotion" aria-label={`Use ${design.name} in your app`}>
        <h3>Use {design.name} in your app</h3>
        <p>Run this in your project terminal to review the change:</p>
        <pre><code>{`${command} variant promote ${entry.id} ${design.id}`}</code></pre>
        <p>Add <code>--apply</code> to replace the source file. A backup is saved beside the variant, and promotion stops if the source changed since the variant was made.</p>
      </section>)}
    <Collapsible className="dw-create-variant">
      <CollapsibleTrigger className="dw-create-variant-trigger"><ChevronRight size={14} aria-hidden="true" />Create a variant</CollapsibleTrigger>
      <CollapsibleContent className="dw-create-variant-body">
        <p>Your coding agent makes variants. Copy the instructions and paste them into your agent: it copies this component into a new folder and edits the copy, leaving your app unchanged.</p>
        <Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(prompt); setCopied(true); setFailed(false); } catch { setFailed(true); } }}>
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied ? 'Copied' : 'Copy agent instructions'}
        </Button>
        {failed && <><p role="status">Copying isn’t available here. Select the instructions below and copy them.</p><textarea className="dw-agent-prompt" readOnly rows={6} value={prompt} aria-label="Agent instructions" /></>}
      </CollapsibleContent>
    </Collapsible>
  </div>;
}

/** One button switches the app to this variant, after a confirmation that names the file it replaces. */
function PromoteVariant({ entry, design, promote, events }: {
  entry: WorkbenchEntry; design: DesignIdea; promote: NonNullable<VariantActions['promote']>; events?: PromotionEvents;
}) {
  const [step, setStep] = useState<'idle' | 'confirm' | 'working'>('idle');
  const [error, setError] = useState('');
  const apply = async () => {
    setStep('working'); setError('');
    events?.start?.(design.name);
    try {
      const result = await promote(entry.id, design.id);
      setStep('idle');
      events?.done?.({ name: design.name, ...result });
    } catch (reason) {
      events?.fail?.();
      setStep('confirm');
      setError(reason instanceof Error ? reason.message : 'The variant could not be applied.');
    }
  };
  return <section className="dw-variant-promotion" aria-label={`Use ${design.name} in your app`}>
    <h3>Use {design.name} in your app</h3>
    <p>Replaces <code>{entry.source}</code> with this variant. A backup is saved, and nothing changes if the source was edited since the variant was made.</p>
    {step === 'idle'
      ? <Button className="dw-promote-button" onClick={() => setStep('confirm')}>Use {design.name} in my app</Button>
      : <div className="dw-promote-confirm">
        <Button className="dw-promote-button" disabled={step === 'working'} onClick={apply}>
          {step === 'working' && <LoaderCircle size={14} className="dw-spin" aria-hidden="true" />}Replace {entry.source.slice(entry.source.lastIndexOf('/') + 1)}
        </Button>
        <Button variant="ghost" disabled={step === 'working'} onClick={() => { setStep('idle'); setError(''); }}>Cancel</Button>
      </div>}
    {error && <p className="dw-promote-error" role="alert">{error}</p>}
  </section>;
}
