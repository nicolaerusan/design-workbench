import { PreviewThumbnail } from '../../src/thumbnail.tsx';
import { resolvePreviewProps, type Selection, type WorkbenchEntry } from '../../src/model.ts';
import { Caption, Frame } from '../frame.tsx';

export const entry: WorkbenchEntry = {
  id: 'thumbnail', name: 'Preview thumbnail', group: 'Workbench parts', source: 'src/thumbnail.tsx',
  description: 'A live miniature of a preview, used on overview tiles and for variants. It can zoom in on what the preview draws.',
  width: 520, variants: ['Zoomed to content', 'Whole frame', 'Sizes'],
  propControls: {
    width: { type: 'number', label: 'Box width', defaultValue: 160, min: 48, max: 420 },
    height: { type: 'number', label: 'Box height', defaultValue: 100, min: 32, max: 300 },
  },
};

const url = '/button?state=Default';
const box = { position: 'relative', overflow: 'hidden', border: '1px solid #e8e8e6', borderRadius: 8, background: '#fafaf9' } as const;

export function render(selection: Selection) {
  const props = resolvePreviewProps(entry, selection);
  const size = { width: Number(props.width), height: Number(props.height) };
  if (selection.state === 'Sizes') return <Frame>
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
      {[[72, 44, 'Menu'], [84, 52, 'Variant list'], [240, 150, 'Overview tile']].map(([width, height, label]) => <div key={label} style={{ display: 'grid', gap: 6 }}>
        <div style={{ ...box, width: Number(width), height: Number(height) }}><PreviewThumbnail className="dw-design-thumbnail" title="Button" url={url} fit="content" renderWidth={480} /></div>
        <Caption>{label}</Caption>
      </div>)}
    </div>
  </Frame>;
  const content = selection.state === 'Zoomed to content';
  return <Frame>
    <div style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
      <div style={{ ...box, ...size }}><PreviewThumbnail className="dw-design-thumbnail" title="Button" url={url} fit={content ? 'content' : 'width'} renderWidth={480} /></div>
      <Caption>{content ? 'Fits what the preview paints, so a small button stays legible.' : 'Shows the frame from its top-left corner, scaled to the box width.'}</Caption>
    </div>
  </Frame>;
}
