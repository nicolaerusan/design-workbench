import React from 'react';
import * as Source from "../../src/Button.tsx";
import { resolvePreviewProps, type WorkbenchEntry, type Selection } from 'designbench';

const Component = Source["Button"] as React.ComponentType<any>;
const fixtureProps: Record<string, unknown> = {};
export const entry: WorkbenchEntry = {
  "id": "button-a98b195e81b9af25",
  "name": "Button",
  "group": "Discovered components",
  "source": "src/Button.tsx",
  "description": "The example app’s button, imported from src/Button.tsx. Click it to count.",
  "width": 640,
  propControls: { label: { type: 'text', label: 'Label', defaultValue: 'Click to try', description: 'The button’s visible text.' } },
  "variants": [
    "Default"
  ]
};
export function render(selection: Selection) {
  return <Component {...fixtureProps} {...resolvePreviewProps(entry, selection)} />;
}
