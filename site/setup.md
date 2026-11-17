# Set up DesignBench for this project

You're a coding agent (Claude Code, Codex, Cursor or similar). The person you're working with pasted a one-line request that pointed here. Set up DesignBench in the project you have open, then fit it to that project, so the two of you can design its components together.

DesignBench is a local workbench for React components. It renders the project's real components with sample props, keeps each design variant as a file under `.design-workbench/`, and shows them side by side on one canvas.

The setup has three parts. Finish each one before starting the next, so a problem in one part doesn't get blamed on another.

## Part 1: Install DesignBench

This part is the same for every project.

1. **Check the project fits.** DesignBench needs React 18.2 or 19 and Node 20.19+ or 22.12+. In a monorepo, find the app or package the person is working on, and ask them if it's unclear. If there's no React app, or Node is too old, stop and tell them why.
2. **Install DesignBench as a dev dependency**, using the package manager the project already uses (check the lockfile). With npm:

   ```
   npm install --save-dev designbench
   ```

   With pnpm, run `pnpm add -D designbench`. With yarn, `yarn add -D designbench`. With bun, `bun add -d designbench`. If the install warns about install or build scripts it didn't run, for example for fsevents or esbuild, leave it. DesignBench doesn't need them, so don't approve them or change the project's script settings.
3. **Create the workbench.** Run `npx designbench init`. In a monorepo, add `--cwd <app folder>`. If the components live in a few known folders, add `--source <folder>` for each one so discovery stays focused. In a Yarn Plug'n'Play project, which has no `node_modules`, use `yarn designbench` wherever this guide says `npx designbench`.
4. **Read `.design-workbench/AGENT.md`.** It explains how previews, states, variants and promotion work. Follow it for everything after this.
5. **Check that the tool runs.** Start `npx designbench dev` in the background, because it keeps running until stopped, and open `http://127.0.0.1:7070`. If port 7070 is taken, add `--port <number>`. The built-in "Welcome button" preview should render. If it doesn't, fix that first, because the problem is in the install, not in the project's components.

## Part 2: Fit it to this project

This is the part that makes the previews look like the real app.

6. **Learn how the app renders.** Find its global CSS, fonts, design tokens or theme, and the providers its components expect, such as theme, router, i18n, data or query clients, and auth context. Import the shared CSS in `.design-workbench/catalog.ts` and wrap previews in the providers inside its `renderPreview` function. The file has to stay `catalog.ts`, so use `React.createElement` there instead of JSX. The project's `vite.config` plugins aren't loaded, so anything previews need from them has to come through `catalog.ts`. In a Next.js project, `app/layout.tsx` doesn't run either, so fonts set there with `next/font` are missing until you declare them for the workbench. `AGENT.md` says how, and which `next/*` imports the runner replaces for you. Any it doesn't list need a mock in the fixture. Use mocks for network and auth, and never call real write APIs.
7. **Pick the components that matter.** Run `npx designbench scan --write` and check `.design-workbench/inventory.json` against the source, because discovery is a heuristic. It can list things that aren't components, such as API route handlers, and whole pages and layouts, which are rarely the right thing to preview. Choose about 5 to 8 components: the shared building blocks (button, input, card and so on) plus a few product components the person works on most. Don't drop a product component only because it imports framework modules or types. Try it first, and skip it only if it still fails after mocking. Add each one with `npx designbench add 'path/to/File.tsx#ExportName'`. Use `add --all` only when the project is small.
8. **Write real fixtures.** For each component, fill in `fixtureProps` with content from the product's own domain, not lorem ipsum. Add the states that matter for it, such as loading, disabled, empty, error and long content. Use `stateProps` for simple values of props declared in `propControls`. For anything else, such as an empty list or long content, branch on `selection.state` in `render()`. One invalid entry stops the whole workbench from loading, so check the browser after each component. Add `propControls` for the settings a designer would want to change.
9. **Check every preview in the browser.** Open each one, switch its states, and fix render errors and missing styles. Only call a component covered once it renders correctly. If `AGENT.md` describes `designbench check`, run it too. The project's own typecheck skips `.design-workbench/`, so nothing else catches a fixture that doesn't match its component's props.
10. **Remove the sample.** Once the project's own components render, delete `.design-workbench/previews/welcome.tsx`. It was only there to prove the install works.

## Part 3: Hand it over

11. **Make the workbench easy to find again.** Add a `package.json` script, for example `"designbench": "designbench dev"`. If the project has agent instructions (`AGENTS.md`, `CLAUDE.md` or similar), add one line there that says the workbench exists and points to `.design-workbench/AGENT.md`, so later sessions use it.
12. Leave `npx designbench dev` running, or tell the person to start it with that command, because the link only works while it runs. Then send them the link and a short summary:
    - which components are on the bench
    - which components you skipped, and why
    - anything that needs them, such as components that need server features and must be mounted in the host app (see the package README)

    Then suggest a first request, for example "Give me three takes on the pricing card, one of them playful."

## Rules

- Only change `.design-workbench/`, the dev dependency and script in `package.json`, the lockfile, and the one line in the project's agent instructions. Don't change application source files or the project's other configuration.
- Use made-up data and mock side effects in fixtures.
- `designbench dev` runs project code to render previews, the same way the app's own dev server does.
- Don't commit unless the person asks. When they're ready, the files to commit are `.design-workbench/`, `package.json`, the lockfile and the agent instructions file if you edited it.

More: https://component.garden · https://github.com/nicolaerusan/design-workbench
