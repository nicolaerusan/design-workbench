import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { advisories, format, invalidReason, MAX_DAYS, review } from '../scripts/audit.mjs';

const TODAY = '2026-11-18';
const ID = 'GHSA-fc5q-39xc-vjpf';
const NO_FIX_IN_RANGE = { name: 'vite', version: '6.2.7', isSemVerMajor: true };

/** What `npm audit --json` reports for one advisory reached through other packages. */
const report = ({ fixAvailable = NO_FIX_IN_RANGE, severity = 'high' } = {}) => ({
  auditReportVersion: 2,
  vulnerabilities: {
    picomatch: { name: 'picomatch', severity, fixAvailable, via: [{ source: 1247710, name: 'picomatch', title: 'ReDoS through repeated extglobs', url: `https://github.com/advisories/${ID}`, severity, range: '<=4.0.7' }] },
    tinyglobby: { name: 'tinyglobby', severity, fixAvailable, via: ['fdir', 'picomatch'] },
    vite: { name: 'vite', severity, fixAvailable, via: ['picomatch', 'tinyglobby'] },
  },
});
const exception = (overrides = {}) => ({ advisory: ID, package: 'picomatch', expires: '2026-12-02', reason: 'No fixed version exists.', ...overrides });

test('an advisory blocks unless an exception names it', () => {
  // Packages that are vulnerable only through another package are not separate advisories.
  assert.deepEqual(advisories(report()).map(item => [item.id, item.package, item.severity]), [[ID, 'picomatch', 'high']]);

  const blocked = review(report(), [], TODAY);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.blocking.length, 1);
  assert.match(format(blocked), /BLOCKING {2}GHSA-fc5q-39xc-vjpf picomatch \(high\)[\s\S]*Audit failed/);

  const deferred = review(report(), [exception()], TODAY);
  assert.equal(deferred.ok, true);
  assert.deepEqual([deferred.blocking.length, deferred.excused.length, deferred.unused.length], [0, 1, 0]);
  assert.match(format(deferred), /DEFERRED {2}GHSA-fc5q-39xc-vjpf[\s\S]*until 2026-12-02: No fixed version exists\.[\s\S]*Audit passed[^\n]*1 deferred/);

  // An exception covers one advisory in one package, nothing else.
  assert.equal(review(report(), [exception({ package: 'vite' })], TODAY).ok, false);
  assert.equal(review(report(), [exception({ advisory: 'GHSA-aaaa-bbbb-cccc' })], TODAY).ok, false);
  const second = report();
  second.vulnerabilities.rolldown = { name: 'rolldown', severity: 'critical', fixAvailable: false, via: [{ name: 'rolldown', title: 'Other', url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc', severity: 'critical' }] };
  const mixed = review(second, [exception()], TODAY);
  assert.equal(mixed.ok, false);
  assert.deepEqual(mixed.blocking.map(item => item.advisory.id), ['GHSA-aaaa-bbbb-cccc']);
});

test('an exception stops applying when it expires or a fix can be installed', () => {
  assert.equal(review(report(), [exception({ expires: TODAY })], TODAY).ok, true);
  const expired = review(report(), [exception({ expires: '2026-11-17' })], TODAY);
  assert.equal(expired.ok, false);
  assert.match(expired.blocking[0].why, /expired on 2026-11-17/);

  const fixable = review(report({ fixAvailable: true }), [exception()], TODAY);
  assert.equal(fixable.ok, false);
  assert.match(fixable.blocking[0].why, /fix is now available/);
});

test('an exception needs a reason and a near expiry date', () => {
  assert.equal(invalidReason(exception(), TODAY), null);
  for (const broken of [exception({ reason: ' ' }), exception({ expires: undefined }), exception({ expires: 'soon' }), exception({ expires: '2026-13-45' }), exception({ package: undefined }), null, 'GHSA-fc5q-39xc-vjpf'])
    assert.equal(typeof invalidReason(broken, TODAY), 'string');
  assert.match(invalidReason(exception({ expires: '2099-01-01' }), TODAY), new RegExp(`more than ${MAX_DAYS} days`));

  // A malformed entry fails the audit even when it would have matched, and even when nothing else is wrong.
  assert.equal(review(report(), [exception({ expires: '2099-01-01' })], TODAY).ok, false);
  const clean = review({ auditReportVersion: 2, vulnerabilities: {} }, [exception({ reason: '' })], TODAY);
  assert.equal(clean.ok, false);
  assert.match(format(clean), /INVALID/);
});

test('lower severities pass and a leftover exception is reported', () => {
  const moderate = review(report({ severity: 'moderate' }), [exception()], TODAY);
  assert.equal(moderate.ok, true);
  assert.deepEqual(moderate.unused.map(item => item.advisory), [ID]);
  assert.match(format(moderate), /UNUSED[^\n]*Remove it\.[\s\S]*Audit passed/);
  assert.equal(review({ auditReportVersion: 2, vulnerabilities: {} }, [], TODAY).ok, true);
});

test('the committed exceptions are well formed and both workflows run this audit', async () => {
  const read = file => fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  const exceptions = JSON.parse(await read('scripts/audit-exceptions.json'));
  assert.ok(Array.isArray(exceptions));
  for (const entry of exceptions) {
    // Checked against its own expiry date, so this test does not start failing when the date passes.
    assert.equal(invalidReason(entry, entry.expires), null, entry.advisory);
    assert.match(entry.advisory, /^GHSA(-[0-9a-z]{4}){3}$/);
    assert.ok(entry.reason.length >= 40, 'the reason says why deferring is acceptable');
  }
  for (const workflow of ['.github/workflows/ci.yml', '.github/workflows/release.yml']) {
    const text = await read(workflow);
    assert.match(text, /run: node scripts\/audit\.mjs/, workflow);
    assert.doesNotMatch(text, /npm audit --omit=dev/, workflow);
  }
  // The audit script and its exceptions are release tooling. They are not part of the package.
  assert.ok(!JSON.parse(await read('package.json')).files.includes('scripts'));
});
