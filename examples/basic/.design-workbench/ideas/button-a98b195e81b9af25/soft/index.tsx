import React from 'react';
import * as Source from "./component.tsx";
import metadata from './variant.json';
import type { Selection, PreviewProps } from 'designbench';

// Keep the original public props and behavior. Add synthetic fixture props here if required.
const Component = Source["Button"] as React.ComponentType<any>;
export const componentId = metadata.component;
export const design = { id: metadata.id, name: metadata.name, kind: 'exploration' as const, source: ".design-workbench/ideas/button-a98b195e81b9af25/soft/component.tsx" };
export function render(_selection: Selection, props: PreviewProps) { return <div style={{ padding: 32 }}><Component {...props} /></div>; }
