import { FileTypeIcon } from '../../src/file-icon.tsx';
import { resolvePreviewProps, type Selection, type WorkbenchEntry } from '../../src/model.ts';
import { Frame } from '../frame.tsx';

export const entry: WorkbenchEntry = {
  id: 'file-icon', name: 'File type icon', group: 'Workbench parts', source: 'src/file-icon.tsx',
  description: 'Marks each file in the Code tab by type: React components, scripts, data, styles, and documents.',
  width: 360, variants: ['All types', 'Single'],
  propControls: { path: { type: 'text', label: 'File path', defaultValue: 'src/Button.tsx', description: 'Only the extension matters.' } },
};

const samples = ['component.tsx', 'Legacy.jsx', 'model.ts', 'index.mjs', 'variant.json', 'styles.css', 'README.md', 'LICENSE'];

export function render(selection: Selection) {
  const props = resolvePreviewProps(entry, selection);
  const paths = selection.state === 'Single' ? [String(props.path)] : samples;
  return <Frame>
    <ul className="dw-tree" style={{ width: 260 }}>
      {paths.map(path => <li key={path}><span className="dw-tree-file" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 28 }}><FileTypeIcon path={path} /><span className="dw-tree-name">{path}</span></span></li>)}
    </ul>
  </Frame>;
}
