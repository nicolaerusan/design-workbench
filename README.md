# DesignBench

**A component workbench for designing with AI.** Explore ideas in browser panels, keep multiple directions for the same React component, compare them side by side, and refine them in the context of a real application.

The vision is a richer workspace for human–agent design iteration, inspired by component tools like Storybook, with deep integration with [Pattern Garden](https://pattern.garden) for inspiration from a universal component library. **Storybook is not required:** DesignBench has its own catalog and preview runtime.

The package and executable are **designbench**. Project files stay in `.design-workbench/`; the older `design-workbench` executable remains an alias.

> **Early preview · MIT licensed.** Client React previews run through Vite, with source-copied shadcn/ui controls and Lucide icons. Direct Pattern Garden library access, site-indexing requests, and built-in AI orchestration remain planned. npm publication is pending account authentication; the GitHub release install below works independently of npm publication.

## Why we built this

Working with an AI coding agent makes it easy to ask for another direction. Keeping those directions around, comparing them in a real browser, and deciding what should actually ship should be just as easy.

We wanted a small bench beside the product: the real component on one side, several editable alternatives on the other, with shared properties and states. Use your coding environment's annotation mode to point at a preview, describe what should change, and ask the agent to make another variant. Keep the useful ideas in Git, then adopt one deliberately. DesignBench provides the workspace and files; your existing agent does the coding. It does not include its own annotation overlay or require a model API key.

## What works today

| Capability | Current behavior |
| --- | --- |
| Setup CLI | `init` creates a runnable workbench, `scan` discovers exported component candidates, `add` generates editable fixtures, and `dev` starts the standalone preview server. |
| Component catalog | Named components grouped by category; search by name, ID, group, or source path; Cmd/Ctrl+K focuses search. |
| Multiple design directions | Each component can retain several named designs with stable IDs, descriptions, source paths, and references. Designs are registered in the project manifest. |
| Side-by-side comparison | Compare all registered designs for one component using the same selected fixture state and viewport. |
| Interactive preview panels | Render real components in host-provided iframes, open a preview independently, and reset its mounted state. |
| Editable properties | Text, boolean, select, and number controls; named-state presets; validated overrides included in shared URLs. |
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

### Install the GitHub preview

In an existing React project:

```sh
npm install --save-dev https://github.com/nicolaerusan/design-workbench/releases/download/v0.3.0/designbench-0.3.0.tgz
npx designbench init
npx designbench add --all
npx designbench dev
```

Open `http://127.0.0.1:7070`. Keep the server running, and review generated fixtures for required props, providers, and styles. Commit your lockfile and `.design-workbench/`.

### npm / npx install (pending first registry publication)

Once `designbench` is published to npm, the same flow starts with:

```sh
npm install --save-dev designbench
npx designbench init
npx designbench add --all
npx designbench dev
```

For a one-off start, `npx designbench@0.3.0 init` will run the published CLI. A pinned development dependency is recommended for teams. The npm name is not reserved until publication succeeds; do not use these registry commands before the release is announced.

### Try it now from this repository

```sh
git clone https://github.com/nicolaerusan/design-workbench.git
cd design-workbench
npm ci
npm test
node cli/index.mjs dev --cwd examples/basic
```

Open `http://127.0.0.1:7070`. The example includes an imported interactive button with two saved alternatives, Ink and Soft, plus a welcome fixture with property and state controls. Node 20.19+ or 22.12+ is required (Node 21 is excluded).

To use it in another React project before the npm release:

```sh
# In this repository:
npm pack

# In your host project:
npm install --save-dev /absolute/path/to/design-workbench/designbench-0.3.0.tgz
npx designbench init
npx designbench scan
npx designbench add 'src/components/Button.tsx#Button'
npx designbench dev
```

React and React DOM 18.2 or 19 are peers. The package includes compiled ESM, TypeScript declarations, CSS, source, and the CLI. TypeScript and Vite are used by the CLI, not imported by the React UI. The `development` export points to TypeScript source; the default export is compiled JavaScript.

### Bring in existing components

`init` creates `.design-workbench/config.json`, a generated `inventory.json`, an editable `catalog.ts`, a working example in `previews/`, and an `AGENT.md` setup guide. It does not replace existing setup or modify application source.

```sh
# Limit discovery or use a monorepo package:
npx designbench init --cwd apps/web --source src/components --source src/features

# Refresh generated inventory after source changes:
npx designbench scan --write

# Create draft fixtures for every discovered candidate:
npx designbench add --all
```

Discovery parses JavaScript/TypeScript syntax without executing source. It recognizes exported PascalCase functions, React component classes, and common `memo`/`forwardRef` wrappers. Default source directories are `src`, `app`, `components`, and `pages`. Tests, declarations, build output, dependencies, hidden directories, and symlinks are excluded. Existing story files are reported as context but not imported automatically. Barrel re-exports, custom higher-order components, and dynamic exports are not resolved.

Generated fixtures import your real components with an editable `fixtureProps` object. **Review required props, providers, and side effects before opening them.** `add` preserves existing fixtures; `scan --write` only replaces generated inventory. Discovery does not prove that a fixture renders correctly or that the component is used in production.

The standalone runner supports client-renderable React components, TypeScript path aliases, and CSS imports. Add your shared CSS and wrappers in `catalog.ts` or individual fixtures. It does not load the host's Vite configuration, framework plugins, or server runtime. Components requiring Next.js server features or other framework-specific behavior should use client fixtures or the host integration below. Files in a host `public/` directory are not served automatically.

`dev` can start before `init`: it shows a setup page with commands appropriate to the current installation. Run those commands in another terminal and choose **Check setup**. An empty catalog explains how to discover and add components. An already-open page shows restart guidance if the dev server disconnects. A fresh browser navigation while the server is stopped will still show the browser’s connection error; no app code is running to render an empty state.

The dev server binds to `127.0.0.1` and defaults to port 7070 (`--port` changes it). It is a local development tool and executes your fixture imports. Keep setup files in version control so teammates and agents share the same fixtures.

### Work with an AI agent

Give your coding agent this request:

> Read .design-workbench/AGENT.md and inventory.json. Review the discovered components, add preview fixtures for the useful ones, supply representative props and providers, and verify the previews in the browser. Preserve existing design directions and add new alternatives separately.

`entry.designs` holds visual directions; `entry.variants` holds states. The fixture's `render(selection)` selects an implementation and its props. The generated guide explains saved variants, context previews, reference provenance, and production evidence. The CLI works without a model API key; the agent runs in your existing editor or coding environment.

### Create, compare, and promote variants

Use the stable component ID from its preview URL and the actual source export:

```sh
npx designbench variant create button-a98b195e81b9af25 soft \
  --from 'src/Button.tsx#Button' --name 'Soft'
```

This creates project-owned files:

```text
.design-workbench/ideas/button-a98b195e81b9af25/soft/
  component.tsx     # Copy of the complete original source file
  index.tsx         # Preview renderer, with fixture props/providers as needed
  variant.json     # Source path, export, identity, and original source hash
```

Edit the copied implementation or ask your agent to do so. The standalone runner discovers it automatically. Toggle between the source and alternatives, or choose **Compare variants**. They share state presets, properties, and viewport settings. Commit the whole folder to retain history. Delete a variant folder to remove it from the catalog.

Every component includes **Create a variant → Copy agent instructions**. The generated `.design-workbench/AGENT.md` explains creation, fixture setup, comparison, and adoption. Selecting a preview does not modify the app. The **Source preview** is the baseline from its source file; production usage is only labeled when a maintainer has supplied reviewed evidence.

To adopt a saved direction:

```sh
# Show the replacement diff; no source write:
npx designbench variant promote button-a98b195e81b9af25 soft

# After reviewing the diff and checking the component:
npx designbench variant promote button-a98b195e81b9af25 soft --apply
```

Promotion replaces the complete original file, rebases relative imports, and keeps a `before-promotion.*` backup beside the variant. It stops if source changed since creation, the public export disappeared, or a target is a symlink or outside the project. Run your application's checks and review the Git diff after adoption. Use Git or the backup to restore the original. Existing variants then need manual reconciliation against the changed source.

This first version promotes **one source file**. Additional dependencies, sibling files, fixture props, and parent composition wiring need explicit edits. Dynamic module paths and `import.meta` require manual setup. Saved files are trusted project code; these checks are not a sandbox for downloaded variants.

### Embed in an existing application

The React API remains available if your host already supplies preview routes. This path uses the host's runtime and fixtures instead of the standalone server.

### Register and mount components

```tsx
import { Workbench, validateCatalog, type WorkbenchEntry } from 'designbench';
import 'designbench/styles.css';

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

For embedded hosts, merge saved modules with `withVariants(entries, renderSource, modules)` and use the returned `entries` and `renderPreview` in both routes. Automatic filesystem discovery is specific to the standalone CLI.

`designs` are alternative implementations; `variants` are fixture or interaction states such as Default, Disabled, Loading, or Empty. A component without explicit designs receives a single `current` source preview. Keep component and design IDs stable when renaming them.

### Provide the preview route

The host supplies two routes:

- `/design` renders the workbench above.
- `/design/:componentId?design=:designId&state=:state` renders the chosen real component with representative props, styles, and providers.

For example, `/design/primary-button?design=soft&state=Disabled` should render the disabled `SoftButton`. Map IDs to an explicit component registry in your host. `resolveSelection(entries, query)` normalizes unknown selections, `designsFor(entry)` supplies the default design, and `previewUrl(basePath, entry, selection)` builds preview links. For an isolated route, include its path component ID in the query passed to `resolveSelection`.

A workbench link looks like `/design?component=primary-button&design=soft&state=Disabled&viewport=375`. Optional `initialSelection` supports a server-resolved initial selection.

The host owns fixture isolation, application providers, and access control. Use synthetic data and development-only or access-controlled routes. Preview iframes are not a security sandbox for arbitrary code. There is no Next.js, Tailwind, authentication, or database dependency in the core package.

### Properties and state presets

States are named fixture presets. Properties are individual inputs that can be adjusted independently, similar to component properties in design tools. Designs remain separate implementations or visual directions.

```tsx
// Add to a WorkbenchEntry:
propControls: {
  label: { type: 'text', defaultValue: 'Continue', description: 'Button text.' },
  disabled: { type: 'boolean', defaultValue: false },
  size: { type: 'select', defaultValue: 'Medium', options: ['Small', 'Medium', 'Large'] },
  radius: { type: 'number', defaultValue: 8, min: 0, max: 32 },
},
stateProps: { Disabled: { disabled: true } },
```

Apply them in the fixture renderer:

```tsx
import { resolvePreviewProps } from 'designbench';
const props = resolvePreviewProps(entry, selection);
return <Button {...fixtureProps} {...props} />;
```

Precedence is defaults, then the selected state preset, then validated URL overrides. Switching state or component clears overrides. **Reset properties** returns to preset values; **Reset** remounts the preview with current values. Comparison panels receive the same overrides. **Share** copies the current URL and briefly shows **Copied**; a localhost URL still needs the project running on the recipient's machine.

Controls are explicitly declared by the fixture author, not inferred from all component props. Only declared string, boolean, and finite number values are accepted; invalid options, out-of-range numbers, malformed JSON, and undeclared props are ignored. Strings are limited to 2,000 characters and serialized overrides to 16,000 characters. Functions, JSX, providers, and complex data remain in fixture code. Existing hosts without `propControls` keep their state-based previews unchanged.

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

**Components** is the project home: a searchable overview with links and lazy hover previews. The project name and breadcrumb return here; component URLs still open the selected preview directly. Empty projects default to Setup.

**Setup** stays at the bottom of the project sidebar. It provides the run, scan, and add commands and a short usage guide. Empty catalogs open Setup automatically; projects without CLI configuration also show the init command. The Setup URL can be bookmarked, and browser Back returns to the previous component.

The **Properties & states** inspector groups state presets and editable values beside the preview. Collapse it to gain canvas space, or use the docking buttons to stack it below the preview or place it on the right. Drag the divider vertically or horizontally to resize it; arrow keys adjust the focused divider, and double-click resets its size. Position, size, and collapsed state are remembered locally per project. Viewport and Reset live inside the inspector; Share sits beside the component name. Narrow panels automatically stack it below. Changing the layout preserves the running preview; changing a state preset clears property overrides. Edited presets show **Modified**.

### UI foundation

The default UI uses source-copied **shadcn/ui** components with **Lucide** icons. Buttons, inputs, textareas, selects, checkboxes, hover cards, tooltips, collapsibles, and the preview/inspector splitter use these local components. Their source and MIT attribution live in `src/ui`. Namespaced CSS replaces Tailwind utilities so host projects do not need a Tailwind setup. Layout, catalog logic, and host-specific adapters remain ordinary React.

The selected **Trestle** logo is available as editable SVG in `design/brand/designbench.svg`; the other studies remain in that folder.

### Customize and persist

Pass `controls: WorkbenchControls` to use your own `Button`, `Input`, `Textarea`, and `Select`. Sidebar items show a live, scaled preview after a 200 ms hover or keyboard focus. Only the open preview mounts an iframe; it closes on Escape, selection, scroll, resize, or leaving the card, and is disabled for mobile navigation. Previews show the default design/state and do not change the current selection. An optional `NavigationPreview` wrapper can replace this built-in behavior. Keep adapter component identities stable outside render. Public types are exported from the package.

Optional `coverage: CoverageItem[]` and `scopeNote` describe your component inventory. The React UI consumes host-provided coverage. The CLI discovers candidates, but does not label them as verified coverage.

Manifest designs and references live in your project files. Browser-created notes are stored under `projectId/componentId/designId` and can be exported as JSON; there is no shared backend or automatic manifest writeback. Remote reference images are not loaded automatically. Use annotation tools supplied by your coding environment; DesignBench does not provide its own drawing or screenshot annotation overlay.

## Pattern Garden

[Pattern Garden](https://pattern.garden) is the intended source of cross-site component inspiration. The goal is to bring an example into the workbench, riff on it in your own stack, retain several variants, and keep the source reference attached throughout iteration.

### Available now: reference metadata adapter

```ts
import { patternGardenReferences } from 'designbench';

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

The helper accepts normalized metadata and creates HTTP(S) reference links. It performs no network requests, authentication, capture, or component import. A host can supply this metadata from its own synced capture manifest.

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
- [x] Add agent instructions, saved variant files, automatic discovery, and guarded single-file promotion.
- [ ] Expand multi-file adoption and shared feedback handoff.
- [x] Adopt the MIT license.
- [ ] Complete the first npm registry publication.

## Development

```sh
npm ci
npm run typecheck
npm test
npm pack --dry-run
```

`npm test` compiles the package and checks React rendering, selection URLs, catalog validation, Pattern Garden link safety, CLI argument handling, component discovery, preservation of authored fixtures, and standalone server routes. Browser interaction checks are currently manual. GitHub Actions runs typechecking, tests, and a package dry run.

| File | Purpose |
| --- | --- |
| `cli/` | Setup, syntax-based discovery, fixture generation, and the Vite preview runner. |
| `examples/basic/` | Runnable project with imported components and comparable designs. |
| `src/workbench.tsx` | Catalog UI, preview panels, navigation, references, and feedback. |
| `src/model.ts` | Public data model, selection helpers, URLs, and catalog validation. |
| `src/contexts.tsx` | Parent composition previews and reverse component relationships. |
| `src/controls.tsx` | shadcn/ui defaults and host control-adapter interfaces. |
| `src/pattern-garden.ts` | Capture-metadata-to-reference adapter. |
| `src/styles.css` | Workbench styling. |
| `tests/package.test.mjs` | Package smoke and model tests. |

This project began as the design catalog in Day.new. HomeBase is the first consumer of the standalone extraction. [EXTRACTION.json](./EXTRACTION.json) records the historical extraction metadata and original hashes; [UPSTREAM_README.md](./UPSTREAM_README.md) preserves the original package documentation, including commands and paths specific to its former host. This README describes the standalone repository.

## License and release status

[MIT](./LICENSE). Copied shadcn/ui components retain their [upstream MIT attribution](./src/ui/LICENSE.md).

Version 0.3.0 is an early preview. npm publication is pending account authentication. The GitHub release tarball supports local installation and the npx commands above. See [SECURITY.md](./SECURITY.md) for the local development trust boundary and [release review](./docs/release-review-0.3.0.md) for validation and limitations.
