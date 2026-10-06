#!/usr/bin/env node
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createVariant, promoteVariant } from './variants.mjs';
import { scanProject } from './scan.mjs';
import { initialize, refreshInventory, addComponents } from './setup.mjs';

const help = `DesignBench

Usage: designbench <init|scan|add|variant|dev> [options]

  init            Discover components and create a runnable .design-workbench/.
  scan            Print a JSON component inventory; --write refreshes the saved inventory.
  add <id>        Add an editable preview fixture for a discovered file#export.
  add --all       Add draft fixtures for all candidates, preserving existing fixtures.
  variant create <component-id> <variant-id> --from <file#export>
                  Copy an implementation into an isolated, editable design variant.
  variant promote <component-id> <variant-id> [--apply]
                  Review the source replacement; --apply writes it with a backup.
  dev             Start the standalone local workbench (no Storybook required).

Options:
  --cwd <directory>       Host project directory (default: current directory).
  --source <directory>    Source directory relative to the host (repeatable, init/scan).
  --write                Refresh the inventory on scan using saved config.
  --all                  Add all discovered candidates.
  --from <file#export>   Source export for variant create.
  --name <label>         Display name for variant create.
  --apply                Apply a reviewed variant promotion.
  --port <number>         Workbench port for dev (default: 7070).
  --help                 Show this help.

Discovery does not execute source. init never overwrites an existing setup.
Generated fixtures require review of props and providers. dev runs project code.
`;

try {
  const { values, positionals } = parseArgs({ options: {
    cwd: { type: 'string' }, source: { type: 'string', multiple: true },
    write: { type: 'boolean' }, all: { type: 'boolean' },
    from: { type: 'string' }, name: { type: 'string' }, apply: { type: 'boolean' },
    port: { type: 'string' }, help: { type: 'boolean' },
  }, allowPositionals: true });
  const command = positionals[0];
  if (values.help || !command) console.log(help);
  else {
    if (!['init', 'scan', 'add', 'variant', 'dev'].includes(command) || positionals.length > (command === 'variant' ? 4 : command === 'add' ? 2 : 1)) throw new Error('Expected init, scan, add, variant, or dev. Use --help.');
    if ((values.from || values.name || values.apply) && command !== 'variant' || values.write && command !== 'scan' || values.all && command !== 'add' || values.port && command !== 'dev' || values.source && (!['init', 'scan'].includes(command) || values.write))
      throw new Error('Option does not apply to this command. Use --help.');
    const root = path.resolve(values.cwd ?? process.cwd());
    if (command === 'variant') {
      const [, action, component, variant] = positionals;
      if (!['create', 'promote'].includes(action) || !component || !variant) throw new Error('Use variant create|promote <component-id> <variant-id>.');
      if (action === 'create' && values.apply || action === 'promote' && (values.from || values.name)) throw new Error('Option does not apply to this variant action.');
      const result = await (action === 'create' ? createVariant(root, { component, variant, from: values.from, name: values.name }) : promoteVariant(root, { component, variant, apply: values.apply }));
      console.log(result.status === 'review' ? result.diff + '\n\n' + result.next : JSON.stringify(result, null, 2));
    } else if (command === 'init') {
      const inventory = await initialize(root, { sources: values.source });
      console.log(`Created .design-workbench/ with ${inventory.components.length} component candidates and a working example.\n\nRun designbench dev, or add your components with designbench add --all.\nReview .design-workbench/AGENT.md for fixture setup.`);
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
  console.error(`DesignBench: ${error.code === 'EEXIST' ? 'Destination already exists; existing setup, variants, and promotion backups are never overwritten.' : error.message}`);
  process.exitCode = 1;
}
