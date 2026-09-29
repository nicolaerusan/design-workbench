#!/usr/bin/env node
import path from 'node:path';
import { parseArgs } from 'node:util';
import { scanProject } from './scan.mjs';
import { initialize, refreshInventory, addComponents } from './setup.mjs';

const help = `Design Workbench

Usage: design-workbench <init|scan|add|dev> [options]

  init            Discover components and create a runnable .design-workbench/.
  scan            Print a JSON component inventory; --write refreshes the saved inventory.
  add <id>        Add an editable preview fixture for a discovered file#export.
  add --all       Add draft fixtures for all candidates, preserving existing fixtures.
  dev             Start the standalone local workbench (no Storybook required).

Options:
  --cwd <directory>       Host project directory (default: current directory).
  --source <directory>    Source directory relative to the host (repeatable, init/scan).
  --write                Refresh the inventory on scan using saved config.
  --all                  Add all discovered candidates.
  --port <number>         Workbench port for dev (default: 7070).
  --help                 Show this help.

Discovery does not execute source. init never overwrites an existing setup.
Generated fixtures require review of props and providers. dev runs project code.
`;

try {
  const { values, positionals } = parseArgs({ options: {
    cwd: { type: 'string' }, source: { type: 'string', multiple: true },
    write: { type: 'boolean' }, all: { type: 'boolean' },
    port: { type: 'string' }, help: { type: 'boolean' },
  }, allowPositionals: true });
  const command = positionals[0];
  if (values.help || !command) console.log(help);
  else {
    if (!['init', 'scan', 'add', 'dev'].includes(command) || positionals.length > (command === 'add' ? 2 : 1)) throw new Error('Expected init, scan, add, or dev. Use --help.');
    if (values.write && command !== 'scan' || values.all && command !== 'add' || values.port && command !== 'dev' || values.source && (!['init', 'scan'].includes(command) || values.write))
      throw new Error('Option does not apply to this command. Use --help.');
    const root = path.resolve(values.cwd ?? process.cwd());
    if (command === 'init') {
      const inventory = await initialize(root, { sources: values.source });
      console.log(`Created .design-workbench/ with ${inventory.components.length} component candidates and a working example.\n\nRun design-workbench dev, or add your components with design-workbench add --all.\nReview .design-workbench/AGENT.md for fixture setup.`);
    } else if (command === 'scan') {
      const inventory = values.write ? await refreshInventory(root) : await scanProject(root, values.source);
      console.log(JSON.stringify(inventory, null, 2));
    } else if (command === 'add') {
      if (!!positionals[1] === !!values.all) throw new Error('Use add <file#export> or add --all.');
      console.log(JSON.stringify(await addComponents(root, { id: positionals[1], all: values.all }), null, 2));
    } else {
      const port = Number(values.port ?? 7070);
      if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Port must be an integer from 1024 to 65535.');
      const { startDev } = await import('./dev.mjs');
      const server = await startDev(root, { port });
      server.printUrls();
      console.log('Edit .design-workbench/previews/ to iterate. Press Ctrl+C to stop.');
      for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); process.exit(0); });
    }
  }
} catch (error) {
  console.error(`Design Workbench: ${error.code === 'EEXIST' ? '.design-workbench already exists. Use scan --write to refresh discovery; edit config.json to change settings.' : error.message}`);
  process.exitCode = 1;
}
