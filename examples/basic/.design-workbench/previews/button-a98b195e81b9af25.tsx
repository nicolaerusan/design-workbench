import React from 'react';
import * as Source from "../../src/Button.tsx";
import type { WorkbenchEntry, Selection } from '@design-workbench/react';

// Review required props, providers, and side effects before using this fixture.
const Component = Source["Button"] as React.ComponentType<any>;
const fixtureProps: Record<string, unknown> = {}; // TODO: supply representative props.
export const entry: WorkbenchEntry = {
  "id": "button-a98b195e81b9af25",
  "name": "Button",
  "group": "Discovered components",
  "source": "src/Button.tsx",
  "description": "Draft fixture: review props, providers, and states.",
  "width": 640,
  "variants": [
    "Default"
  ]
};
export function render(_selection: Selection) {
  return <Component {...fixtureProps} />;
}
