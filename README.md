# Design Workbench

**A component workbench for designing with AI.** Explore ideas in browser panels, keep multiple directions for the same React component, compare them side by side, and refine them in the context of a real application.

The vision is a richer workspace for human–agent design iteration, inspired by component tools like Storybook, with deep integration with [Pattern Garden](https://pattern.garden) for inspiration from a universal component library. **Storybook is not required:** Design Workbench has its own catalog and preview runtime.

> **Early development.** `@design-workbench/react` provides the React catalog, comparison UI, and a standalone CLI. The workbench was extracted from Day.new and is used by HomeBase. The CLI runs client React previews through Vite; existing applications can still provide their own preview routes. The repository is private and the package has not been published to npm. Direct Pattern Garden library access, site-indexing requests, and built-in AI orchestration are planned.

## What works today

| Capability | Current behavior |
| --- | --- |
| Setup CLI | `init` creates a runnable workbench, `scan` discovers exported component candidates, `add` generates editable fixtures, and `dev` starts the standalone preview server. |
| Component catalog | Named components grouped by category; search by name, ID, group, or source path; Cmd/Ctrl+K focuses search. |
| Multiple design directions | Each component can retain several named designs with stable IDs, descriptions, source paths, and references. Designs are registered in the project manifest. |
| Side-by-side comparison | Compare all registered designs for one component using the same selected fixture state and viewport. |
| Interactive preview panels | Render real components in host-provided iframes, open a preview independently, and reset its mounted state. |
| Responsive inspection | Fit the panel or select 375, 768, or 1280 px preview widths. |
| Shareable selection | URLs preserve component, design, state, and viewport; browser back/forward restores selection. |
| Components in context | Inspect a component inside registered parent compositions, explore the parent, and follow automatically derived “Contains” links. |
| Source and usage inspector | Inspect source paths and explicit production-usage evidence. Badges distinguish “Used in app,” “Exploration,” and “Source preview.” |
| References and feedback | Attach manifest references or save per-design links and notes in browser local storage; remove local notes and export references as JSON. |
| Pattern Garden reference bridge | Convert normalized capture metadata into reference links, retaining capture identity, dates, and limitations. |
| Coverage and gaps | Display host-supplied inventories of previewed, excluded, and missing source files. |
| Adaptable interface | Native controls by default; optional host design-system controls, including shadcn adapters and navigation-preview wrappers. |
| Responsive navigation | Resizable and collapsible desktop sidebar, saved sidebar width, and a mobile drawer with keyboard containment. |

The current AI workflow uses an external coding agent: edit component source and the manifest, inspect the resulting previews, compare alternatives, and export feedback for another iteration. Live updates come from the standalone runner or the host development server. The CLI scaffolds preview fixtures; it does not generate new component implementations, receive prompts, or automatically deliver feedback to an agent.

## The design loop

1. Open a component and inspect its current implementation, states, and usage.
2. Keep a new direction as a separate source component and manifest design rather than overwriting the previous idea.
3. Compare directions in browser panels at the same state and viewport.
4. Record references and feedback, then iterate with your coding agent.
5. Inspect registered parent compositions to understand the surrounding layout.
6. Adopt a direction in the application's source and update its reviewed usage evidence.

Selecting a design only changes the preview. It does not change application imports or deploy code. Context previews render their own implementations; selecting an alternative child design does not automatically substitute it into a parent.

## Getting started

The intended published install is a development dependency with an executable:

```sh
# After the first npm release (not available yet):
npm install --save-dev @design-workbench/react
npx design-workbench init
npx design-workbench add --all
npx design-workbench dev
```

For a one-off start after publication, `npx @design-workbench/react init` will invoke the same executable. A pinned project dependency is the recommended ongoing workflow so a team's CLI version is recorded in its lockfile. The shorter unscoped `npx design-workbench` package name is not reserved or published by this project.

### Try it now from this repository

```sh
git clone https://github.com/nicolaerusan/design-workbench.git
cd design-workbench
npm ci
npm test
node cli/index.mjs dev --cwd examples/basic
```

Open `http://127.0.0.1:7070`. The example includes an imported interactive component and two comparable design directions. Node 20.19+ or 22.12+ is required (Node 21 is excluded).

To use it in another React project before the npm release:

```sh
# In this repository:
npm pack

# In your host project:
npm install --save-dev /absolute/path/to/design-workbench/design-workbench-react-0.2.0.tgz
npx design-workbench init
npx design-workbench scan
npx design-workbench add 'src/components/Button.tsx#Button'
npx design-workbench dev
```

React and React DOM 18.2 or 19 are peers. The package includes compiled ESM, TypeScript declarations, CSS, source, and the CLI. TypeScript and Vite are used by the CLI, not imported by the React UI. The `development` export points to TypeScript source; the default export is compiled JavaScript.

### Bring in existing components

`init` creates `.design-workbench/config.json`, a generated `inventory.json`, an editable `catalog.ts`, a working example in `previews/`, and an `AGENT.md` setup guide. It does not replace existing setup or modify application source.

```sh
# Limit discovery or use a monorepo package:
npx design-workbench init --cwd apps/web --source src/components --source src/features

# Refresh generated inventory after source changes:
npx design-workbench scan --write

# Create draft fixtures for every discovered candidate:
npx design-workbench add --all
```

Discovery parses JavaScript/TypeScript syntax without executing source. It recognizes exported PascalCase functions, React component classes, and common `memo`/`forwardRef` wrappers. Default source directories are `src`, `app`, `components`, and `pages`. Tests, declarations, build output, dependencies, hidden directories, and symlinks are excluded. Existing story files are reported as context but not imported automatically. Barrel re-exports, custom higher-order components, and dynamic exports are not resolved.

Generated fixtures import your real components with an editable `fixtureProps` object. **Review required props, providers, and side effects before opening them.** `add` preserves existing fixtures; `scan --write` only replaces generated inventory. Discovery does not prove that a fixture renders correctly or that the component is used in production.

The standalone runner supports client-renderable React components, TypeScript path aliases, and CSS imports. Add your shared CSS and wrappers in `catalog.ts` or individual fixtures. It does not load the host's Vite configuration, framework plugins, or server runtime. Components requiring Next.js server features or other framework-specific behavior should use client fixtures or the host integration below. Files in a host `public/` directory are not served automatically.

The dev server binds to `127.0.0.1` and defaults to port 7070 (`--port` changes it). It is a local development tool and executes your fixture imports. Keep setup files in version control so teammates and agents share the same fixtures.

### Work with an AI agent

Give your coding agent this request:

> Read .design-workbench/AGENT.md and inventory.json. Review the discovered components, add preview fixtures for the useful ones, supply representative props and providers, and verify the previews in the browser. Preserve existing design directions and add new alternatives separately.

`entry.designs` holds visual directions; `entry.variants` holds states. The fixture's `render(selection)` selects an implementation and its props. The generated guide explains context previews, reference provenance, and production evidence. The CLI works without a model API key; the agent runs in your existing editor or coding environment.

### Embed in an existing application

The React API remains available if your host already supplies preview routes, as Day.new and HomeBase do. This path uses the host's runtime and fixtures instead of the standalone server.

### Register and mount components

```tsx
import { Workbench, validateCatalog, type WorkbenchEntry } from '@design-workbench/react';
import '@design-workbench/react/styles.css';

export const entries: WorkbenchEntry[] = [{
  id: 'primary-button',
  name: 'Primary button',
  group: 'Controls',
  source: 'src/components/Button.tsx',
  description: 'Primary actions and alternative visual directions.',
  variants: ['Default', 'Disabled'],
  width: 400,
  designs: [
    {
      id: 'current',
      name: 'Current button',
      source: 'src/components/Button.tsx',
      productionUsage: [{
        file: 'src/components/Checkout.tsx',
        symbol: 'Button',
        description: 'Renders the checkout submit action.',
      }],
    },
    {
      id: 'soft',
      name: 'Softer button',
      kind: 'exploration',
      source: 'src/ideas/SoftButton.tsx',
      references: [{ title: 'Direction', notes: 'More space and a softer outline.' }],
    },
  ],
}];

const errors = validateCatalog(entries);
if (errors.length) throw new Error(errors.join('\n'));

export function DesignPage() {
  return <Workbench
    project="Example app"
    projectId="example-app"
    basePath="/design"
    entries={entries}
  />;
}
```

`designs` are alternative implementations; `variants` are fixture or interaction states such as Default, Disabled, Loading, or Empty. A component without explicit designs receives a single `current` source preview. Keep component and design IDs stable when renaming them.

### Provide the preview route

The host supplies two routes:

- `/design` renders the workbench above.
- `/design/:componentId?design=:designId&state=:state` renders the chosen real component with representative props, styles, and providers.

For example, `/design/primary-button?design=soft&state=Disabled` should render the disabled `SoftButton`. Map IDs to an explicit component registry in your host. `resolveSelection(entries, query)` normalizes unknown selections, `designsFor(entry)` supplies the default design, and `previewUrl(basePath, entry, selection)` builds preview links. For an isolated route, include its path component ID in the query passed to `resolveSelection`.

A workbench link looks like `/design?component=primary-button&design=soft&state=Disabled&viewport=375`. Optional `initialSelection` supports a server-resolved initial selection.

The host owns fixture isolation, application providers, and access control. Use synthetic data and development-only or access-controlled routes. Preview iframes are not a security sandbox for arbitrary code. There is no Next.js, Tailwind, authentication, or database dependency in the core package.

### Show components in context

Add `contexts` to a child entry, targeting another registered entry that renders the larger composition:

```ts
contexts: [{
  id: 'inside-checkout',
  name: 'Inside checkout',
  componentId: 'checkout-form',
  description: 'The primary action below the checkout fields.',
  state: 'Ready',
  viewport: '375',
  usage: {
    file: 'src/components/Checkout.tsx',
    symbol: 'Button',
    description: 'Checkout renders this button as its submit action.',
  },
}]
```

Register `checkout-form` and its `Ready` state first. Context `design` and `state` default to the parent's first choices. Omit `usage` for an illustrative composition. The parent iframe mounts on demand, and reverse “Contains” links are derived from the child relationships.

`validateCatalog` checks stable component IDs, duplicates, missing states, design-ID collisions, context targets, self-links, context selections, and incomplete usage metadata. The host must verify that source evidence is accurate and that its fixtures visibly contain the child.

### Customize and persist

Pass `controls: WorkbenchControls` to use your own `Button`, `Input`, `Textarea`, and `Select`. An optional `NavigationPreview` wrapper can add a hover preview; the default is a plain navigation item. Keep adapter component identities stable outside render. Public types are exported from the package.

Optional `coverage: CoverageItem[]` and `scopeNote` describe your component inventory. The React UI consumes host-provided coverage. The CLI discovers candidates, but does not label them as verified coverage.

Manifest designs and references live in your project files. Browser-created notes are stored under `projectId/componentId/designId` and can be exported as JSON; there is no shared backend or automatic manifest writeback. Remote reference images are not loaded automatically. Drawing and screenshot annotations are planned possibilities, not implemented features.

## Pattern Garden

[Pattern Garden](https://pattern.garden) is the intended source of cross-site component inspiration. The goal is to bring an example into the workbench, riff on it in your own stack, retain several variants, and keep the source reference attached throughout iteration.

### Available now: reference metadata adapter

```ts
import { patternGardenReferences } from '@design-workbench/react';

// Supply these values from a real capture manifest or integration.
const references = patternGardenReferences({
  name: capturedSite.name,
  canonicalUrl: capturedSite.canonicalUrl,
  limitations: ['Public page only.'],
  captures: [{
    id: capture.id,
    patternGardenUrl: capture.referenceUrl,
    capturedAt: capture.capturedAt,
  }],
});
// Assign references to a design's `references` field.
```

The helper accepts normalized metadata and creates HTTP(S) reference links. It performs no network requests, authentication, capture, or component import. HomeBase already uses this boundary with a synced Pattern Garden reference manifest.

Pattern Garden captures describe rendered evidence such as screenshots, DOM, and styles. They should not be presented as recovered original React source. A future import should preserve provenance, capture limitations, and the distinction between reference material and a new local implementation.

### Planned integration

- **Universal library search:** find component examples by purpose, visual treatment, and state, then pull selected reference material into a component's inspiration collection.
- **Local variations:** turn a selected reference into several implementations in the host stack, preserving the original reference and each local design direction.
- **Site-indexing requests:** submit a website URL from the workbench to Pattern Garden, track its request status, and bring resulting references back when available.
- **Agent workflow:** give agents structured access to the selected component, source, references, variants, previews, and feedback so an iteration can continue with its context intact.

These are product requirements, not available API methods. The library transport, authentication, indexing lifecycle, and agent protocol still need to be implemented.

## Roadmap

- [x] Extract a reusable React workbench from Day.new.
- [x] Support named designs, state selection, comparison, responsive previews, and composition contexts.
- [x] Connect a second host application, HomeBase.
- [x] Add a portable Pattern Garden reference adapter.
- [x] Add npm-executable setup, component discovery, draft fixture generation, and a standalone preview server.
- [x] Include a runnable example with real component imports.
- [ ] Expand discovery and framework adapters based on real host projects. Storybook interoperability can be added later if useful.
- [ ] Connect Pattern Garden universal-library search and reference retrieval.
- [ ] Add site-indexing requests and status tracking.
- [ ] Add agent-driven variant creation, durable iteration history, and feedback handoff.
- [ ] Choose an open-source license and publish the repository and package.

## Development

```sh
npm ci
npm run typecheck
npm test
npm pack --dry-run
```

`npm test` compiles the package and checks React rendering, selection URLs, catalog validation, Pattern Garden link safety, CLI argument handling, component discovery, preservation of authored fixtures, and standalone server routes. Browser interaction checks are currently manual. GitHub Actions runs typechecking, tests, and a package dry run; account billing must permit Actions jobs to start.

| File | Purpose |
| --- | --- |
| `cli/` | Setup, syntax-based discovery, fixture generation, and the Vite preview runner. |
| `examples/basic/` | Runnable project with imported components and comparable designs. |
| `src/workbench.tsx` | Catalog UI, preview panels, navigation, references, and feedback. |
| `src/model.ts` | Public data model, selection helpers, URLs, and catalog validation. |
| `src/contexts.tsx` | Parent composition previews and reverse component relationships. |
| `src/controls.tsx` | Native controls and host control-adapter interfaces. |
| `src/pattern-garden.ts` | Capture-metadata-to-reference adapter. |
| `src/styles.css` | Workbench styling. |
| `tests/package.test.mjs` | Package smoke and model tests. |

This project began as the design catalog in Day.new. HomeBase is the first consumer of the standalone extraction. [EXTRACTION.json](./EXTRACTION.json) records the historical extraction metadata and original hashes; [UPSTREAM_README.md](./UPSTREAM_README.md) preserves the original package documentation, including commands and paths specific to its former host. This README describes the standalone repository.

## License and release status

Intended for open-source release; private during initial development. The package retains its existing `UNLICENSED` designation until an open-source license is selected. No npm registry release has been made. Before publishing: confirm npm scope ownership, choose a license, verify a clean tarball install, and then publish explicitly. Repository setup and local packaging do not publish to the registry.
