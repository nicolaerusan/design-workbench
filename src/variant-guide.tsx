import { useEffect, useState } from 'react';
import { ChevronRight, Copy, Check } from 'lucide-react';
import { Button } from './ui/button.tsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible.tsx';
import type { DesignIdea, WorkbenchEntry } from './model.ts';

export function VariantGuide({ entry, design, command = 'npx designbench' }: { entry: WorkbenchEntry; design: DesignIdea; command?: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (copied) { const timer = setTimeout(() => setCopied(false), 2200); return () => clearTimeout(timer); } }, [copied]);
  const saved = design.source.startsWith(`.design-workbench/ideas/${entry.id}/${design.id}/`);
  const prompt = `Read .design-workbench/AGENT.md and the existing preview for ${JSON.stringify(entry.id)} (${entry.name}). Inspect ${JSON.stringify(entry.source)} to find its public component export. Create a new visual variant with ${command} variant create ${entry.id} <variant-id> --from '<source-file>#<export-name>' --name '<display-name>'. Edit the copied component under .design-workbench/ideas/ and its index.tsx fixture, preserving public props, behavior, providers, and state presets. Keep the application source unchanged. Open this component in DesignBench, compare the app source and alternatives at the same state and viewport, and verify interactions. If this is an embedded workbench, register the alternative in entry.designs and its render function instead. Do not promote until I choose a direction.`;
  const promotion = `${command} variant promote ${entry.id} ${design.id}`;
  return <Collapsible className="dw-variant-guide">
    <CollapsibleTrigger className="dw-source-trigger"><ChevronRight size={14} aria-hidden="true" />Create a variant <span>Work with your agent</span></CollapsibleTrigger>
    <CollapsibleContent className="dw-variant-instructions">
      <p>Variants are separate implementations saved with your project. States are presets, such as Disabled; properties adjust the inputs. Selecting a variant only changes the preview.</p>
      <Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(prompt); setCopied(true); setError(''); } catch { setError('Copy is unavailable. Select the instructions below.'); } }}>
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied ? 'Copied' : 'Copy agent instructions'}
      </Button>
      {error && <p role="status">{error}</p>}
      <p className="dw-agent-prompt">{prompt}</p>
      {saved && <div><h3>Use {design.name} in your app</h3><p>Review a source diff in your terminal:</p><pre><code>{promotion}</code></pre><p>After reviewing and testing, add <code>--apply</code> to replace the original source file. A backup is saved beside the variant. Promotion stops if the source changed since creation. Dependency changes and fixture props must be handled separately.</p></div>}
    </CollapsibleContent>
  </Collapsible>;
}
