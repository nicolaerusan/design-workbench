# Set up and iterate on this project's components

Read config.json, inventory.json, catalog.ts, and previews/ in this directory. Follow the user's request and the repository's existing instructions.

## First setup

1. Review the discovered candidates against their source. The inventory is a heuristic, not verified preview coverage.
2. Use design-workbench add 'path/to/File.tsx#ExportName' for selected components, or design-workbench add --all for all discovered candidates. Existing fixture files are preserved.
3. Edit the generated fixtureProps and render functions. Supply realistic synthetic data, useful states, providers, and callbacks. Empty props are a starting point, not a guarantee of a valid render.
4. Import required shared CSS in catalog.ts. The standalone Vite runner supports client-renderable React code. For framework-specific server components, use a client fixture or mount Workbench in the host app as documented in the package README.
5. Mock network, authentication, and server dependencies. Do not call real write APIs from fixtures.
6. Run design-workbench dev and verify actual previews. Fix failures before claiming a component is covered.
7. Rerun design-workbench scan --write after source changes. Keep decisions in fixture files; inventory.json is generated.

## Design iteration

Keep earlier implementations while exploring named alternatives. Use entry.designs for visual directions and entry.variants for fixture states. In render(selection), choose the implementation and props using selection.design and selection.state. Record references alongside each design, compare panels, and inspect parent compositions using entry.contexts. Verify production usage against actual render sites before adding productionUsage.

Pattern Garden reference metadata can use patternGardenReferences. Direct universal-library search, site indexing, autonomous code generation, and shared feedback storage are future integrations. This setup is local and requires no model API key or Storybook.

## Saved variants and promotion

In standalone mode, create a variant with:

    npx designbench variant create <catalog-component-id> <variant-id> --from 'src/components/Button.tsx#Button' --name 'Soft button'

Use the entry.id from the preview catalog, not the scanner's file#export ID. IDs are lowercase words separated by hyphens. Inspect the actual export before running the command. The command copies the complete source file and rebases relative imports; it does not modify application source. Unsupported dynamic imports and import.meta require manual setup.

Edit .design-workbench/ideas/<component-id>/<variant-id>/component.tsx (or its original extension). The adjacent index.tsx provides the preview renderer; supply required fixture data, providers, styles, and callbacks there. Public props and state presets are forwarded automatically. The CLI discovers these index.tsx files, and variants appear without manual catalog registration. Commit the entire variant directory including variant.json. Treat metadata as project-owned code, not an untrusted upload format.

Verify each variant in the browser, switch states and properties, and compare at matching viewports. Use synthetic data and mock side effects. Annotation tools belong to the user's coding environment; use their feedback to edit variants. No model API key is required by DesignBench.

When the user chooses a direction, run:

    npx designbench variant promote <component-id> <variant-id>

This prints a source replacement diff without writing. Review the whole file, check public exports and behavior, and run the host's tests. Only after the user requests adoption, rerun with --apply. Promotion replaces that single original source file, rebases imports, and saves before-promotion.* beside the variant. It rejects changed source and symlinks. New dependencies, additional files, parent composition wiring, and fixture data are not promoted automatically. Use Git to review or revert. Older variants must be reconciled manually after source changes; do not bypass the base hash. Selecting a variant never promotes it.

For an embedded host, use entry.designs and its render function, or merge saved modules with withVariants(entries, renderSource, modules) before passing them to both routes. Standalone CLI auto-discovery does not run in embedded hosts.
