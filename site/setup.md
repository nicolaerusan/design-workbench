# Set up DesignBench for this project

You're a coding agent (Claude Code, Codex, Cursor or similar). The person you're working with pasted a one-line request that pointed here. Set up DesignBench in the project you have open, then fit it to that project, so the two of you can design its components together.

DesignBench is a local workbench for React components. It renders the project's real components with sample props, keeps each design variant as a file under `.design-workbench/`, and shows them side by side on one canvas.

The setup has three parts. Finish each one before starting the next, so a problem in one part doesn't get blamed on another.

## Part 1: Install DesignBench

This part is the same for every project.

1. **Check the project fits.** DesignBench needs React 18.2 or 19 and Node 20.19+ or 22.12+. In a monorepo, find the app or package the person is working on, and ask them if it's unclear. If there's no React app, or Node is too old, stop and tell them why.
2. **Install the preview build as a dev dependency**, using the package manager the project already uses (check the lockfile). With npm:

   ```
   npm install --save-dev https://github.com/nicolaerusan/design-workbench/releases/download/v0.3.0/designbench-0.3.0.tgz
   ```

   With pnpm, yarn or bun, add the same URL as a dev dependency.
3. **Create the workbench.** Run `npx designbench init`. In a monorepo, add `--cwd <app folder>`. If the components live in a few known folders, add `--source <folder>` for each one so discovery stays focused.
4. **Read `.design-workbench/AGENT.md`.** It explains how previews, states, variants and promotion work. Follow it for everything after this.
5. **Check that the tool runs.** Start `npx designbench dev` and open `http://127.0.0.1:7070`. The built-in "Welcome button" preview should render. If it doesn't, fix that first, because the problem is in the install, not in the project's components.

## Part 2: Fit it to this project

This is the part that makes the previews look like the real app.

6. **Learn how the app renders.** Find its global CSS, fonts, design tokens or theme, and the providers its components expect, such as theme, router, i18n, data or query clients, and auth context. Import the shared CSS in `.design-workbench/catalog.ts` and wrap previews in the providers there. Use mocks for network and auth, and never call real write APIs.
7. **Pick the components that matter.** Run `npx designbench scan --write` and check `inventory.json` against the source, because discovery is a heuristic. Choose about 5 to 8 components: the shared building blocks (button, input, card and so on) plus a few product components the person works on most. Add each one with `npx designbench add 'path/to/File.tsx#ExportName'`. Use `add --all` only when the project is small.
8. **Write real fixtures.** For each component, fill in `fixtureProps` with content from the product's own domain, not lorem ipsum. Add the states that matter for it, such as loading, disabled, empty, error and long content. Add `propControls` for the settings a designer would want to change.
9. **Check every preview in the browser.** Open each one, switch its states, and fix render errors and missing styles. Only call a component covered once it renders correctly.

## Part 3: Hand it over

10. Send the person the link and a short summary:
    - which components are on the bench
    - which components you skipped, and why
    - anything that needs them, such as components that need server features and must be mounted in the host app (see the package README)

    Then suggest a first request, for example "Give me three takes on the pricing card, one of them playful."

## Rules

- Only change `.design-workbench/`, plus the dev dependency in `package.json` and the lockfile. Don't change application source files.
- Use made-up data and mock side effects in fixtures.
- `designbench dev` runs project code to render previews, the same way the app's own dev server does.
- Don't commit unless the person asks. When they're ready, the files to commit are `.design-workbench/`, `package.json` and the lockfile.

More: https://designbench.pattern.garden · https://github.com/nicolaerusan/design-workbench
