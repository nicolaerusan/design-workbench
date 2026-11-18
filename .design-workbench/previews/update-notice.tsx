import { DeprecationBanner, UpdateNotice } from '../../src/update-notice.tsx';
import type { Selection, UpdateInfo, WorkbenchEntry } from '../../src/model.ts';
import { Caption, Frame } from '../frame.tsx';

export const entry: WorkbenchEntry = {
  id: 'update-notice', name: 'Update notice', group: 'Workbench parts', source: 'src/update-notice.tsx',
  description: 'Tells you a newer DesignBench exists (a quiet sidebar notice) or that the running release was deprecated (a banner), with the command to run. It never installs anything.',
  width: 560, variants: ['Update available', 'Deprecated release', 'Deprecated, nothing newer'],
};

const available: UpdateInfo = { current: '0.4.0', latest: '0.5.0', command: 'npm install --save-dev designbench@0.5.0', notesUrl: 'https://github.com/nicolaerusan/design-workbench/releases' };
const deprecated: UpdateInfo = { ...available, deprecated: 'This release has a known problem with saved variants. Please update.' };

export function render(selection: Selection) {
  if (selection.state === 'Update available') return <Frame>
    {/* The notice lives at the foot of the sidebar; open it to see the command. */}
    <div style={{ width: 244, display: 'grid', gap: 8 }}>
      <UpdateNotice update={available} />
      <Caption>Shown in the sidebar. Select it to see the command.</Caption>
    </div>
  </Frame>;
  return <Frame fill style={{ height: 'auto' }}>
    <DeprecationBanner update={selection.state === 'Deprecated release' ? deprecated : { current: '0.4.0', deprecated: deprecated.deprecated }} />
  </Frame>;
}
