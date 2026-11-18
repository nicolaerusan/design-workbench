import { Braces, File, FileText, Hash } from 'lucide-react';

/** A file-type icon for the Code tab, so React components, data, and styles read at a glance. */
export function FileTypeIcon({ path }: { path: string }) {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  if (extension === 'tsx' || extension === 'jsx') return <svg className="dw-file-icon dw-file-icon-react" width="14" height="14" viewBox="-11.5 -10.23 23 20.46" aria-hidden="true">
    <circle r="2.05" fill="currentColor" />
    <g fill="none" stroke="currentColor" strokeWidth="1.3"><ellipse rx="11" ry="4.2" /><ellipse rx="11" ry="4.2" transform="rotate(60)" /><ellipse rx="11" ry="4.2" transform="rotate(120)" /></g>
  </svg>;
  if (['ts', 'mts', 'cts', 'js', 'mjs', 'cjs'].includes(extension)) {
    const script = ['ts', 'mts', 'cts'].includes(extension) ? 'TS' : 'JS';
    return <svg className={`dw-file-icon dw-file-icon-${script.toLowerCase()}`} width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect width="14" height="14" rx="3" fill="currentColor" />
      <text x="7" y="10.4" textAnchor="middle" fontSize="7" fontWeight="700" fontFamily="system-ui, sans-serif" className="dw-file-icon-label">{script}</text>
    </svg>;
  }
  if (extension === 'json') return <Braces size={14} className="dw-file-icon dw-file-icon-json" aria-hidden="true" />;
  if (['css', 'scss', 'sass', 'less'].includes(extension)) return <Hash size={14} className="dw-file-icon dw-file-icon-css" aria-hidden="true" />;
  if (['md', 'mdx', 'txt'].includes(extension)) return <FileText size={14} className="dw-file-icon" aria-hidden="true" />;
  return <File size={14} className="dw-file-icon" aria-hidden="true" />;
}
