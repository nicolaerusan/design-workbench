# DesignBench for DesignBench

DesignBench previews its own components here. Run `npm run design:dev` at the repository root and open http://127.0.0.1:7074.

Every file in `previews/` renders the real component from `src/`, so source edits refresh the previews. The surrounding workbench shell uses the compiled package; restart the command to rebuild that shell after changing it.

- `previews/` holds one fixture per component: the UI primitives in `src/ui/`, the workbench's parts (design picker, Variants and Code panels, inspector, thumbnails), and its pages (the workbench itself and Settings).
- `frame.tsx` wraps each preview in the `.dw-workbench` scope the styles need. `samples.ts` is a stand-in project component for parts that need an entry and designs.
- The inner Workbench preview lists only a few small parts and never itself, so nesting stops after one level.

`npm run design:scan` refreshes `inventory.json`, and `npm run design:typecheck` checks the fixtures. `npm test` fails if a component file under `src/` has no preview, a preview is left as a draft, or any state fails to render, so add a preview when you add a component (the **Populate the workbench** prompt in Settings does this with a coding agent).
