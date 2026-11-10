'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, FileCode2, Folder, SquareArrowOutUpRight } from 'lucide-react';
import { Button } from './ui/button.tsx';
import { designFiles, type DesignIdea, type SourceFile, type WorkbenchEntry } from './model.ts';

/** Optional file access supplied by the dev server. Without it, the Code tab lists paths only. */
export interface SourceAccess {
  /** Return the text of a project file (path relative to the project root). */
  read?: (path: string) => Promise<string>;
  /** Open a project file in the developer's editor. */
  open?: (path: string) => void;
}

function kindOf(entry: WorkbenchEntry, design: DesignIdea) {
  if (design.productionUsage?.length) return 'Used in your app';
  if (/\.design-workbench\/ideas\//.test(design.source)) return 'Saved variant';
  return design.source === entry.source ? 'Your app' : 'Exploration';
}
function byFolder(files: SourceFile[]) {
  const groups = new Map<string, SourceFile[]>();
  for (const file of files) {
    const folder = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '';
    groups.set(folder, [...(groups.get(folder) ?? []), file]);
  }
  return [...groups];
}
const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1);

export function CodePanel({ entry, designs, active, compare, access, onSelect }: {
  entry: WorkbenchEntry; designs: DesignIdea[]; active: DesignIdea; compare: boolean;
  access?: SourceAccess; onSelect: (design: string) => void;
}) {
  const [file, setFile] = useState<SourceFile | null>(null);
  const [closed, setClosed] = useState<string[]>([]);
  const opener = useRef<string | null>(null);
  const tree = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (file || !opener.current) return;
    tree.current?.querySelector<HTMLElement>(`[data-path="${CSS.escape(opener.current)}"]`)?.focus();
    opener.current = null;
  }, [file]);
  if (file) return <FileViewer file={file} access={access} onBack={() => { opener.current = file.path; setFile(null); }} />;
  return <div className="dw-code" ref={tree}>
    <h2>Files</h2>
    <p>{designs.length > 1
      ? 'The source component is your app’s own code. Each variant is a separate copy saved in .design-workbench/ideas, so your app stays unchanged until you promote one.'
      : 'The code behind this preview. Your app stays unchanged; DesignBench only reads it.'}</p>
    <ul className="dw-tree">
      {designs.map(design => {
        const open = !closed.includes(design.id);
        const showing = compare || design.id === active.id;
        return <li key={design.id} className="dw-tree-design">
          <div className="dw-tree-design-row">
            <button type="button" className="dw-tree-toggle" aria-expanded={open}
              onClick={() => setClosed(current => open ? [...current, design.id] : current.filter(id => id !== design.id))}>
              <ChevronRight size={14} aria-hidden="true" /><strong>{design.name}</strong><span>{kindOf(entry, design)}</span>
            </button>
            {showing ? <span className="dw-tree-showing">In preview</span>
              : <Button variant="ghost" size="sm" className="dw-tree-preview" onClick={() => onSelect(design.id)} aria-label={`Preview ${design.name}`}>Preview</Button>}
          </div>
          {open && <ul className="dw-tree-children">
            {byFolder(designFiles(entry, design)).map(([folder, files]) => <li key={folder}>
              <div className="dw-tree-folder" title={folder || 'Project root'}>
                <Folder size={14} aria-hidden="true" /><span className="dw-tree-path"><bdi>{folder || 'Project root'}</bdi></span>
              </div>
              <ul className="dw-tree-children">
                {files.map(item => <li key={item.path}>
                  <button type="button" className="dw-tree-file" data-path={item.path} title={item.path} onClick={() => { setFile(item); }}>
                    <FileCode2 size={14} aria-hidden="true" /><span className="dw-tree-name">{basename(item.path)}</span><span className="dw-tree-role">{item.label}</span>
                  </button>
                </li>)}
              </ul>
            </li>)}
            {!!design.productionUsage?.length && <li className="dw-tree-usage">
              <span>Used in the app</span>
              {design.productionUsage.map(usage => <p key={`${usage.file}-${usage.symbol}`}><code>{usage.file}</code> → <code>{usage.symbol}</code><br />{usage.description}</p>)}
            </li>}
          </ul>}
        </li>;
      })}
    </ul>
  </div>;
}

function FileViewer({ file, access, onBack }: { file: SourceFile; access?: SourceAccess; onBack: () => void }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error' | 'unavailable'; text?: string }>({ status: 'loading' });
  const [copied, setCopied] = useState(false);
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => { back.current?.focus(); }, []);
  useEffect(() => { if (copied) { const timer = setTimeout(() => setCopied(false), 2000); return () => clearTimeout(timer); } }, [copied]);
  useEffect(() => {
    if (!access?.read) { setState({ status: 'unavailable' }); return; }
    let live = true;
    setState({ status: 'loading' });
    access.read(file.path).then(text => { if (live) setState({ status: 'ready', text }); }, () => { if (live) setState({ status: 'error' }); });
    return () => { live = false; };
  }, [file.path, access]);
  return <div className="dw-file-view">
    <Button ref={back} variant="ghost" size="sm" className="dw-file-back" onClick={onBack}><ArrowLeft size={14} aria-hidden="true" />All files</Button>
    <h2 title={file.path}><bdi>{file.path}</bdi></h2>
    <p><strong>{file.label}.</strong> {file.description}</p>
    <div className="dw-file-actions">
      {access?.open && <Button variant="outline" size="sm" onClick={() => access.open!(file.path)}><SquareArrowOutUpRight size={14} aria-hidden="true" />Open in editor</Button>}
      <Button variant="ghost" size="sm" aria-live="polite" onClick={async () => { try { await navigator.clipboard.writeText(file.path); setCopied(true); } catch {} }}>{copied ? 'Copied' : 'Copy path'}</Button>
    </div>
    {state.status === 'ready' ? <pre className="dw-code-view" tabIndex={0} aria-label={`Contents of ${file.path}`}><code>{state.text!.replace(/\n$/, '').split('\n').map((line, index) => <span key={index} className="dw-code-line">{line}</span>)}</code></pre>
      : <p className="dw-file-status" role="status">{state.status === 'loading' ? 'Loading…'
        : state.status === 'error' ? 'This file could not be read. It may have moved; check the path in your editor.'
        : 'Open this file in your editor to read it. The DesignBench dev server shows file contents here.'}</p>}
  </div>;
}
