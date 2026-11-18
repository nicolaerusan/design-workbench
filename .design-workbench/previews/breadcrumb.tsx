import { useState } from 'react';
import { Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '../../src/ui/breadcrumb.tsx';
import { Button } from '../../src/ui/button.tsx';
import { resolvePreviewProps, type PreviewProps, type Selection, type WorkbenchEntry } from '../../src/model.ts';
import { Caption, Frame } from '../frame.tsx';

export const entry: WorkbenchEntry = {
  id: 'breadcrumb', name: 'Breadcrumb', group: 'Navigation & layout', source: 'src/ui/breadcrumb.tsx',
  description: 'The trail in the top bar that names the current page and links back to the component overview.',
  // Wide enough that thumbnails show the full trail; frames 700px wide or less show only the current page, as on phones.
  width: 640, variants: ['Component page', 'Overview', 'Long name', 'Collapsed'],
  propControls: {
    page: { type: 'text', label: 'Current page', defaultValue: 'Button', description: 'The name of the page you are on.' },
    maxWidth: { type: 'number', label: 'Available width', defaultValue: 420, min: 120, max: 700, description: 'In pixels. A page name that does not fit is cut short.' },
  },
  stateProps: { 'Long name': { page: 'Preview inspector with resizable panels', maxWidth: 260 } },
};

/** The top bar's trail. Following the Components link shows the overview's trail, as it does in the workbench. */
function Sample({ props, state }: { props: PreviewProps; state: string }) {
  const [overview, setOverview] = useState(state === 'Overview');
  const page = String(props.page);
  return <div style={{ maxWidth: Number(props.maxWidth) }}>
    <Breadcrumb className="dw-breadcrumb" aria-label="Breadcrumb"><BreadcrumbList>
      <BreadcrumbItem>{overview
        ? <BreadcrumbPage>Components</BreadcrumbPage>
        : <BreadcrumbLink href="#components" onClick={event => { event.preventDefault(); setOverview(true); }}>Components</BreadcrumbLink>}</BreadcrumbItem>
      {!overview && state === 'Collapsed' && <><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbEllipsis /></BreadcrumbItem></>}
      {!overview && <><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>{page}</BreadcrumbPage></BreadcrumbItem></>}
    </BreadcrumbList></Breadcrumb>
    <div style={{ marginTop: 14 }}>{overview
      ? <Button variant="outline" size="sm" onClick={() => setOverview(false)}>Open {page}</Button>
      : <Caption>Components links back to the overview.</Caption>}</div>
  </div>;
}

export function render(selection: Selection) {
  return <Frame><Sample key={selection.state} props={resolvePreviewProps(entry, selection)} state={selection.state} /></Frame>;
}
