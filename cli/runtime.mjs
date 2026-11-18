import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const exists = file => fs.access(file).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
const shellQuote = value => "'" + value.replaceAll("'", "'\\''") + "'";

/** How to run this CLI for a project: its installed copy when there is one, otherwise this checkout. */
export async function projectCommand(root) {
  const cliFile = fileURLToPath(new URL('./index.mjs', import.meta.url));
  return await exists(path.join(root, 'node_modules/.bin/designbench'))
    ? 'npx --no-install designbench'
    : `node ${shellQuote(cliFile)} --cwd ${shellQuote(root)}`;
}

/**
 * Where a running workbench records its address and access token for `designbench mcp`.
 * It lives in the user's temporary folder, keyed by project, so nothing appears in the project or in Git.
 */
export function runtimeFile(root) {
  const { uid, username } = os.userInfo();
  return path.join(os.tmpdir(), `designbench-${uid >= 0 ? uid : username}`, createHash('sha256').update(root).digest('hex').slice(0, 16) + '.json');
}

/** Only this user may read the file: the token in it lets a local process drive the workbench. */
export async function writeRuntime(root, info) {
  const file = runtimeFile(root);
  const directory = path.dirname(file);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await fs.lstat(directory);
  // A shared temporary folder could hold a directory someone else made first.
  if (!stat.isDirectory() || process.getuid && stat.uid !== process.getuid()) throw new Error(`${directory} is not a private directory.`);
  const temporary = `${file}.${process.pid}`;
  await fs.writeFile(temporary, JSON.stringify(info), { mode: 0o600 });
  await fs.rename(temporary, file);
  return file;
}

export async function readRuntime(root) {
  try {
    const info = JSON.parse(await fs.readFile(runtimeFile(root), 'utf8'));
    return typeof info.url === 'string' && typeof info.token === 'string' ? info : null;
  } catch { return null; }
}

/** Removes the record when this server stops, unless a newer server for the same project has replaced it. */
export async function removeRuntime(root, token) {
  if ((await readRuntime(root))?.token === token) await fs.rm(runtimeFile(root), { force: true });
}
