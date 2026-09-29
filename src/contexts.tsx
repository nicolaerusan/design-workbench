import { useState } from 'react';
import { previewUrl, resolveSelection, type Selection, type WorkbenchEntry } from './model.ts';
import type { WorkbenchControls } from './controls.tsx';

export function ContextPanel({ entry, entries, basePath, controls, navigate }: {
  entry: WorkbenchEntry;
  entries: WorkbenchEntry[];
  basePath: string;
  controls: WorkbenchControls;
  navigate: (selection: Partial<Selection>) => void;
}) {
  const { Button } = controls;
  const [active, setActive] = useState<string | null>(null);
  const contexts = entry.contexts ?? [];
  const children = entries.filter(child => child.contexts?.some(context => context.componentId === entry.id));
  if (!contexts.length && !children.length) return null;
  const context = contexts.find(item => item.id === active);
  const parent = entries.find(item => item.id === context?.componentId);
  const selection = context && parent ? resolveSelection(entries, new URLSearchParams({ component: parent.id, design: context.design ?? '', state: context.state ?? '', viewport: context.viewport ?? 'fit' })) : undefined;
  return (
    <section className="dw-contexts" id="dw-contexts" aria-label="Component contexts">
      {!!contexts.length && <>
        <h2>Used in context <span>{contexts.length}</span></h2>
        <p>See this component inside a larger part of the app. Each context renders its own implementation; it does not substitute the design selected above.</p>
        <div className="dw-context-list">
          {contexts.map(item => <Button key={item.id} className="dw-context-choice" variant="outline" aria-pressed={active === item.id} onClick={() => setActive(active === item.id ? null : item.id)}>
            <strong>{item.name}</strong><span>{item.description}</span><small>{item.usage ? 'Source-backed usage' : 'Illustrative composition'}</small>
          </Button>)}
        </div>
        {context && parent && selection && <article className="dw-preview-card dw-context-preview">
          <div className="dw-frame-title"><span>{parent.name} · {selection.state}</span><Button variant="ghost" onClick={() => navigate(selection)}>Explore {parent.name} ↗</Button></div>
          <div className="dw-canvas"><iframe key={`${entry.id}/${context.id}`} title={`${entry.name} in ${context.name}`} src={previewUrl(basePath, parent, selection)} style={{width: selection.viewport === 'fit' ? '100%' : Number(selection.viewport)}} allow="clipboard-write; camera 'none'; microphone 'none'" /></div>
          {context.usage && <p className="dw-context-evidence"><code>{context.usage.file}</code> · <code>{context.usage.symbol}</code><br />{context.usage.description}</p>}
        </article>}
      </>}
      {!!children.length && <div className="dw-context-children"><h2>Contains</h2><p>Registered components used in this composition.</p><div>{children.map(child => <Button key={child.id} variant="outline" onClick={() => navigate({component:child.id,design:'',state:''})}>{child.name} ↗</Button>)}</div></div>}
    </section>
  );
}
