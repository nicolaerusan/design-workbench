# Set up DesignBench

These are setup steps for a coding agent (Claude Code, Codex, Cursor or similar). The person you're working with pasted a one-line request pointing here. Set up DesignBench in their current project so you can design its components together.

DesignBench is a local workbench for React components. It renders the project's real components, keeps every variant you make as a file under `.design-workbench/`, and lays them out on one canvas to compare.

## Steps

1. Install the preview build as a dev dependency:

   ```
   npm install --save-dev https://github.com/nicolaerusan/design-workbench/releases/download/v0.3.0/designbench-0.3.0.tgz
   ```

2. Run `npx designbench init`, then read `.design-workbench/AGENT.md` and follow it from here on.
3. Run `npx designbench scan --write` and add finished previews for the project's main components, with realistic props and states.
4. Start the workbench with `npx designbench dev` and send the person the link. It runs on `http://127.0.0.1:7070` by default.

## Rules

- Don't change application source files. Everything DesignBench needs lives under `.design-workbench/`.
- DesignBench needs a React project and Node 20.19+ or 22.12+. If either is missing, stop and say so instead of working around it.
- `dev` runs project code to render previews, the same as the app's own dev server.

More: https://designbench.pattern.garden · https://github.com/nicolaerusan/design-workbench
