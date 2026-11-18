# Set up and iterate on this project's components

Read config.json, inventory.json, catalog.ts, and previews/ in this directory. Follow the user's request and the repository's existing instructions.

## Populate the workbench

The goal is a finished preview for every visual component, not a list of drafts.

1. Run designbench scan --write and review the candidates against their source. The inventory is a heuristic: skip hooks, providers, and helpers, and note why.
2. Use designbench add 'path/to/File.tsx#ExportName' for selected components, or designbench add --all for every candidate. Existing fixture files are preserved. Generated fixtures are marked draft: true and show a Draft label in the workbench.
3. Finish each generated fixture. Supply realistic synthetic props and children, providers, and callbacks. Add named states to entry.variants with entry.stateProps (default, empty, loading, error, disabled, long text; only those that apply), entry.propControls for the props worth editing live, a one-sentence description, and a sensible group. Empty props are a starting point, not a guarantee of a valid render. Remove draft: true when the preview is finished.
4. Import required shared CSS in catalog.ts. The standalone Vite runner supports client-renderable React code. For framework-specific server components, use a client fixture or mount Workbench in the host app as documented in the package README.
5. Mock network, authentication, and server dependencies. Do not call real write APIs from fixtures.
6. Run designbench dev and open each preview. A fixture whose imports fail appears under "Needs attention" with the error; the others keep working. Fix failures before claiming a component is covered. Settings shows how many component files still lack a preview.
7. Rerun designbench scan --write after source changes. Keep decisions in fixture files; inventory.json is generated.
8. Report what you added, what you skipped and why, and anything that needs the user's input. Do not change application source while populating.

## Working with the open workbench (MCP)

If the designbench MCP server is connected, use it instead of asking the user to describe their screen. get_current_view tells you the component, variant, state, and files they have open; call it when they say "this" or "the one I'm looking at". open_view shows them a component, variant, or state after you change it. list_components gives ids, states, variants, drafts, and component files without a preview. The server reads and changes what is on screen only. Edit files yourself, following this guide.

Connect it with designbench mcp (for example: claude mcp add designbench -- npx designbench mcp). The workbench Settings page has the exact command for each agent.

## Design iteration

Declare entry.propControls for editable text, boolean, select, and number values. Use entry.stateProps for named presets and resolvePreviewProps(entry, selection) in render to apply preset values and URL overrides.

Keep earlier implementations while exploring named alternatives. Use entry.designs for visual directions and entry.variants for fixture states. In render(selection), choose the implementation and props using selection.design and selection.state. Record references alongside each design, compare panels, and inspect parent compositions using entry.contexts. Verify production usage against actual render sites before adding productionUsage.

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

Pattern Garden reference metadata can use patternGardenReferences. Direct universal-library search, site indexing, autonomous code generation, and shared feedback storage are future integrations. This setup is local and requires no model API key or Storybook.
