# Design workbench for React

An independently installable component design catalog. It provides named components, collections of design ideas, side-by-side comparison, viewport controls, source-backed production markers, stable preview links, and per-idea reference links and feedback. It has no Next.js, Day.new, Tailwind, authentication, database, or Storybook dependency. React and React DOM are peers.

This is a standalone React workbench, not a Storybook addon. A host supplies a manifest and isolated preview routes, retaining its actual component runtime and styles. This avoids duplicating framework configuration for applications that already have a development server. Storybook integration can be added later by mapping its stories/parameters to this model; it is not part of V1.

## Install a local package

From this repository:

```sh
pnpm --filter @design-workbench/react build
npm pack ./packages/design-workbench --pack-destination /tmp
```

From another React project:

```sh
npm install /tmp/design-workbench-react-0.1.0.tgz
```

No registry publication is necessary. The tarball includes compiled JavaScript, declarations, CSS, and source. The development export points at TypeScript source for bundler hot reload; the default export is compiled ESM. Use TypeScript 5.7+ to build the package from source.

## Mount the workbench

```tsx
import { Workbench, type WorkbenchEntry } from '@design-workbench/react';
import '@design-workbench/react/styles.css';

const entries: WorkbenchEntry[] = [{
  id: 'primary-button',
  name: 'Primary action button',
  group: 'Controls',
  source: 'src/Button.tsx',
  description: 'Primary actions and alternative directions.',
  variants: ['Default', 'Disabled'], // Data / interaction states, not design ideas
  width: 400, // Suggested width for the host preview renderer
  designs: [
    {
      id: 'current', name: 'Current button', source: 'src/Button.tsx',
      productionUsage: [{
        file: 'src/App.tsx', symbol: 'Button',
        description: 'The main form action renders this component.',
      }],
    },
    {
      id: 'soft', name: 'Softer button', kind: 'exploration',
      source: 'ideas/SoftButton.tsx',
      references: [{ title: 'Direction', notes: 'More space and a softer outline.' }],
    },
  ],
}];

export function DesignPage() {
  return <Workbench project="Example app" projectId="example-app"
    basePath="/design" entries={entries} />;
}
```

Supply a route `/design/:componentId?design=:designId&state=:state` that renders the actual component, its sample props, and any providers. The workbench loads it into an iframe; the same URL opens independently. Use `designsFor(entry)` and `resolveSelection(entries, query)` to normalize missing/invalid selections. The host owns fixture isolation and must make design routes local or otherwise access-controlled. The generic package does not intercept application requests or claim to sandbox arbitrary components.

React Router, Next.js, or a small Vite app can provide the routes. No particular framework is required. A Next.js host can read its params/searchParams, resolve the entry, and render a client component. Keep the workbench route in development only. The Day.new integration in `src/catalog` demonstrates this adapter, but none of it is imported by the package.

### Identity and production status

Keep component `id` and design `id` stable, even when changing display names. Share `/design?component=primary-button&design=soft&state=Default&viewport=375` for the workbench, or `/design/primary-button?design=soft&state=Default` for isolation.

A design gets **Used in app** only when `productionUsage` has explicit source evidence. The host must verify that evidence against its source. A preview selection never updates imports, promotes an idea, or deploys code. `kind: 'exploration'` distinguishes an idea from an unverified source preview. Multiple designs can have real production usages in different surfaces.

To adopt an idea: edit the application to render it, verify that application flow, then update source evidence. Do not simply change the badge.

### References and feedback

Manifest references are portable project data. Users can also save a title, HTTP(S) reference link, and notes for each idea. These notes use browser local storage, namespaced by `projectId/componentId/designId`; they can be exported as JSON and shared with an agent or checked into the manifest. They do not automatically reach an agent. Remote reference images are not loaded automatically. Drawing, screenshot annotations, collaborative storage, and automatic design generation are not included.

### Coverage

Pass optional `coverage: CoverageItem[]` and `scopeNote` to report previewed, excluded, and missing source files. Coverage discovery is the host's responsibility; the package never scans a project's filesystem.

## Verification

`pnpm catalog:package:check` builds and packs this directory, installs its tarball plus React into a fresh temporary project outside the workspace, imports the installed package, renders the workbench, and verifies identity resolution, duplicate detection, preview URLs, and reference URL safety. It does not rely on workspace symlinks. The test reports the consumer directory and tarball path.

### Bring your own shadcn controls

Pass an optional `controls: WorkbenchControls` adapter to render the workbench with the host's shadcn `Button`, `Input`, `Textarea`, and `Select`. `src/catalog/WorkbenchClient.tsx` is the Day.new example. This client boundary supplies real Radix-backed shadcn selects and existing app primitives. Other projects can supply their own components; native controls remain the dependency-free fallback.

The workbench includes neutral design chips, a collapsible desktop sidebar, a mobile drawer with a scrim and keyboard containment, Cmd/Ctrl+K search, and an expandable source/reference inspector. Keep control adapters outside render so their identity is stable and inputs retain focus.

The optional `NavigationPreview` control receives the sidebar link, component name/description, default preview URL, natural width, and a disabled flag for mobile navigation. Day.new supplies a shadcn HoverCard adapter: 350ms open delay, collision-aware right placement, a scaled noninteractive iframe mounted only while open, keyboard focus support, and Escape/scroll/resize dismissal. Hosts that omit this adapter retain plain navigation links.

### Component contexts: show the composition, not just the part

Apps populate `WorkbenchEntry.contexts` with relationships to other registered entries. A context is a real parent preview, with its own fixture state and optional design. For example:

```ts
{
  id: 'meal-card',
  // ...normal entry fields
  contexts: [{
    id: 'inside-day',
    name: 'Inside a calendar day',
    componentId: 'calendar-day',
    state: 'Populated',
    description: 'A meal beside the day’s activities.',
    usage: {
      file: 'src/components/CalendarDay.tsx',
      symbol: 'MealCard',
      description: 'Each meal in the day renders this component.',
    },
  }],
}
```

`componentId` targets a registered composition; `design` and `state` default to that entry's first choices. `viewport` optionally selects `fit`, `375`, `768`, or `1280`. Context IDs must be unique within their child entry. `usage` is optional: without source evidence, the UI labels the context as an illustrative composition. The host should verify supplied evidence against its code, as Day.new does in `scripts/check-catalog.mjs`.

The workbench provides a **Contexts** shortcut, a **Used in context** section, an on-demand interactive iframe, and an **Explore parent** action. It also derives the parent's **Contains** links from these same relationships; apps do not maintain a second reverse map. Parent previews mount only when selected. Exploring an alternative child design does not inject that design into the parent; the parent renders its own registered implementation.

#### Setup workflow for another app

1. Register standalone components and important compositions (cards, sections, dialogs, pages) with representative fixtures.
2. Find actual render sites/imports in the host code. Review each site before recording it as real usage; an import alone is not evidence that a component is visible.
3. Add one context per useful location or layout. Choose a fixture state that visibly includes the child. If a parent lacks a preview, first register a composition story using real parent code and synthetic data.
4. Add `usage` for reviewed source sites, or omit it for proposed/illustrative examples. This data is serializable and can live in a TS manifest, JSON normalized by the host, or a generated manifest.
5. Run `validateCatalog(entries)` during setup/CI. It rejects missing parent IDs, duplicate context IDs, self-links, unknown states/designs, and invalid viewports. Add framework-specific source-evidence checks in the host.
6. Open the actual contexts and confirm the child is visible. Keep relationships and fixtures updated with source changes.

The package does not infer a component tree from arbitrary apps, depend on Day.new names, or require React-source introspection. Setup agents can use source searches to propose relationships; the host manifest is the durable, reviewed contract.
