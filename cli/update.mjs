import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const NAME = 'designbench';
const DAY = 24 * 60 * 60 * 1000;
// Stable releases only. The match is interpolated into a suggested shell command.
const STABLE = /^(\d{1,6})\.(\d{1,6})\.(\d{1,6})$/;
const NOTES = 'https://github.com/nicolaerusan/design-workbench/blob/main/CHANGELOG.md';

/** A per-user cache directory. Shared temporary directories are writable by other local users. */
export function userCacheDir(env = process.env) {
  if (env.XDG_CACHE_HOME && path.isAbsolute(env.XDG_CACHE_HOME)) return path.join(env.XDG_CACHE_HOME, NAME);
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Caches', NAME);
  if (process.platform === 'win32' && env.LOCALAPPDATA) return path.join(env.LOCALAPPDATA, NAME, 'Cache');
  return path.join(os.homedir(), '.cache', NAME);
}

export async function currentVersion() {
  return JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
}

export function isNewer(candidate, current) {
  const a = STABLE.exec(candidate), b = STABLE.exec(String(current).split('-')[0]);
  if (!a || !b) return false;
  for (let i = 1; i <= 3; i++) if (Number(a[i]) !== Number(b[i])) return Number(a[i]) > Number(b[i]);
  // A stable release supersedes a prerelease of the same version.
  return String(current).includes('-');
}

export function updateCheckDisabled(env = process.env) {
  const on = name => env[name] && !['0', 'false'].includes(String(env[name]).toLowerCase());
  return !!(on('DESIGNBENCH_NO_UPDATE_CHECK') || on('NO_UPDATE_NOTIFIER') || on('CI') || on('npm_config_offline'));
}

/** The registry npm would install from. Plain HTTP is accepted only for loopback. */
export function registryUrl(env = process.env) {
  try {
    const url = new URL(env.npm_config_registry || 'https://registry.npmjs.org/');
    const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    if (url.protocol === 'https:' || url.protocol === 'http:' && loopback) return url.href.endsWith('/') ? url.href : url.href + '/';
  } catch {}
  return 'https://registry.npmjs.org/';
}

// Registry text is untrusted: one plain line, bounded, without control characters.
const plain = value => typeof value === 'string' ? value.replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ').trim().slice(0, 280) : '';

async function fetchRelease(registry, current, timeout) {
  const response = await fetch(new URL(NAME, registry), {
    headers: { accept: 'application/vnd.npm.install-v1+json' }, signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`Registry responded ${response.status}`);
  const text = await response.text();
  if (text.length > 2_000_000) throw new Error('Registry response too large');
  const doc = JSON.parse(text);
  const latest = doc?.['dist-tags']?.latest;
  return { latest: typeof latest === 'string' && STABLE.test(latest) ? latest : '', deprecated: plain(doc?.versions?.[current]?.deprecated) };
}

/**
 * Compare the running version with the registry. Resolves to a notice, or null when
 * there is nothing to say. Never rejects, installs, or executes anything.
 */
export async function checkForUpdate({
  current, env = process.env, registry = registryUrl(env), ttl = DAY, timeout = 1500,
  cacheFile = path.join(userCacheDir(env), 'update-check.json'), now = Date.now(),
} = {}) {
  try {
    if (updateCheckDisabled(env)) return null;
    current ??= await currentVersion();
    let release;
    try {
      const cached = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
      if (cached.current === current && cached.registry === registry && now - cached.checkedAt >= 0 && now - cached.checkedAt < ttl)
        release = { latest: typeof cached.latest === 'string' && STABLE.test(cached.latest) ? cached.latest : '', deprecated: plain(cached.deprecated) };
    } catch {}
    if (!release) {
      release = await fetchRelease(registry, current, timeout);
      await fs.mkdir(path.dirname(cacheFile), { recursive: true, mode: 0o700 });
      await fs.writeFile(cacheFile, JSON.stringify({ checkedAt: now, current, registry, ...release }), { mode: 0o600 });
    }
    const latest = isNewer(release.latest, current) ? release.latest : undefined;
    if (!latest && !release.deprecated) return null;
    return { current, ...(latest && { latest }), ...(release.deprecated && { deprecated: release.deprecated }), notesUrl: NOTES };
  } catch { return null; }
}

/** The command that moves this project to a version, matching how DesignBench is installed. */
export async function updateCommand(root, version) {
  if (!STABLE.test(version)) return undefined;
  const has = file => fs.access(path.join(root, file)).then(() => true, () => false);
  if (!await has('node_modules/.bin/designbench')) return `npx designbench@${version} dev`;
  if (await has('pnpm-lock.yaml')) return `pnpm add -D designbench@${version}`;
  if (await has('yarn.lock')) return `yarn add -D designbench@${version}`;
  if (await has('bun.lock') || await has('bun.lockb')) return `bun add -d designbench@${version}`;
  return `npm install --save-dev designbench@${version}`;
}

export function formatUpdate(notice) {
  const lines = [];
  if (notice.deprecated) lines.push(`Warning: designbench@${notice.current} is deprecated: ${notice.deprecated}`);
  if (notice.latest) lines.push(`DesignBench ${notice.latest} is available (running ${notice.current}).`);
  if (notice.command) lines.push(`  ${notice.command}`);
  if (notice.latest) lines.push(`  What's new: ${notice.notesUrl}`, '  Set DESIGNBENCH_NO_UPDATE_CHECK=1 to turn this check off.');
  return lines.join('\n');
}
