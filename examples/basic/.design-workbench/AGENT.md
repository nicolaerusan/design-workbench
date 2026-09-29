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
