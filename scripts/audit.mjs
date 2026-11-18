#!/usr/bin/env node
// The dependency audit that CI and the release workflow run.
//
// `npm audit --omit=dev --audit-level=high` has no way to accept one advisory, so
// an advisory with no fixed version blocks every release, including a security
// fix of our own. This runs the same audit and accepts only the advisories listed
// in audit-exceptions.json, each with a reason and an expiry date.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const BLOCKING = new Set(['high', 'critical']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// An exception is a short deferral. A far-off date would make it permanent.
export const MAX_DAYS = 60;
const DAY = 24 * 60 * 60 * 1000;

const isDate = value => typeof value === 'string' && DATE.test(value) && !Number.isNaN(Date.parse(value));
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

/** The advisories in an `npm audit --json` report (format 2), one per advisory and package. */
export function advisories(report) {
  const found = new Map();
  for (const entry of Object.values(report?.vulnerabilities ?? {})) {
    // A string in `via` names another vulnerable package. An object is the advisory itself.
    for (const via of entry.via ?? []) {
      if (typeof via !== 'object' || !via) continue;
      const id = String(via.url ?? '').split('/').pop() || String(via.source ?? via.title);
      found.set(`${id}\n${via.name}`, {
        id, package: via.name, severity: via.severity, title: via.title, url: via.url, range: via.range,
        // true: a version inside the ranges we already allow fixes it, so nothing needs deferring.
        fixInRange: entry.fixAvailable === true,
      });
    }
  }
  return [...found.values()];
}

/** Why an exception entry cannot be used, or null. `today` is YYYY-MM-DD. */
export function invalidReason(exception, today) {
  if (!exception || typeof exception !== 'object') return 'is not an object';
  for (const key of ['advisory', 'package', 'reason']) if (typeof exception[key] !== 'string' || !exception[key].trim()) return `needs "${key}"`;
  if (!isDate(exception.expires)) return 'needs "expires" as YYYY-MM-DD';
  if (Date.parse(exception.expires) - Date.parse(today) > MAX_DAYS * DAY) return `expires more than ${MAX_DAYS} days from now`;
  return null;
}

/**
 * Sorts a report's high and critical advisories into those that block and those an
 * exception defers. An exception stops applying when it expires or once a fix is
 * available inside the ranges we already allow.
 */
export function review(report, exceptions, today) {
  const result = { blocking: [], excused: [], invalid: [], unused: [] };
  const usable = [];
  for (const exception of Array.isArray(exceptions) ? exceptions : [exceptions]) {
    const problem = invalidReason(exception, today);
    if (problem) result.invalid.push({ exception, problem }); else usable.push(exception);
  }
  const used = new Set();
  for (const advisory of advisories(report)) {
    if (!BLOCKING.has(advisory.severity)) continue;
    const exception = usable.find(item => same(item.advisory, advisory.id) && same(item.package, advisory.package));
    if (!exception) { result.blocking.push({ advisory }); continue; }
    used.add(exception);
    if (exception.expires < today) result.blocking.push({ advisory, exception, why: `its exception expired on ${exception.expires}` });
    else if (advisory.fixInRange) result.blocking.push({ advisory, exception, why: 'a fix is now available: run `npm audit fix` and remove the exception' });
    else result.excused.push({ advisory, exception });
  }
  result.unused = usable.filter(exception => !used.has(exception));
  result.ok = result.blocking.length === 0 && result.invalid.length === 0;
  return result;
}

/** The report as lines of text. */
export function format(result) {
  const lines = [];
  const line = ({ id, package: name, severity, title, url }) => `${id} ${name} (${severity}): ${title}\n    ${url}`;
  for (const { advisory, why } of result.blocking) lines.push(`BLOCKING  ${line(advisory)}${why ? `\n    ${why}` : ''}`);
  for (const { exception, problem } of result.invalid) lines.push(`INVALID   exception ${JSON.stringify(exception?.advisory ?? exception)} ${problem}`);
  for (const { advisory, exception } of result.excused) lines.push(`DEFERRED  ${line(advisory)}\n    until ${exception.expires}: ${exception.reason}`);
  for (const exception of result.unused) lines.push(`UNUSED    exception ${exception.advisory} (${exception.package}) no longer matches an advisory. Remove it.`);
  lines.push(result.ok
    ? `Audit passed: no high or critical advisories in shipped dependencies${result.excused.length ? `, ${result.excused.length} deferred` : ''}.`
    : 'Audit failed. See docs/releasing.md, "Advisories with no fix".');
  return lines.join('\n');
}

function main() {
  const audit = spawnSync('npm', ['audit', '--omit=dev', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let report;
  try { report = JSON.parse(audit.stdout); } catch { /* reported below */ }
  // Fail closed: an audit that did not run is not a clean audit.
  if (!report || report.error || typeof report.vulnerabilities !== 'object') {
    console.error(`npm audit did not return a report.\n${report?.error?.summary ?? audit.stderr ?? audit.error ?? ''}`);
    return 1;
  }
  const exceptions = JSON.parse(fs.readFileSync(new URL('./audit-exceptions.json', import.meta.url), 'utf8'));
  const result = review(report, exceptions, new Date().toISOString().slice(0, 10));
  console.log(format(result));
  return result.ok ? 0 : 1;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
