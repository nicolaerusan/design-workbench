#!/usr/bin/env node
// Renders the repo's CHANGELOG.md into site/changelog/index.html.
//
//   node site/build-changelog.mjs           write the page
//   node site/build-changelog.mjs --check   exit 1 if the page is out of date
//
// CHANGELOG.md is the only source. Edit it, run this, and commit both files.
//
// Node built-ins only. The Markdown is rendered as text: every character is
// escaped, and only the small subset handled here becomes markup (headings,
// lists, paragraphs, fenced code, `code`, **bold**, *emphasis* and links).
// Raw HTML in the Markdown comes out as literal text.
//
// What the page shows:
//   - Every `## <version>` section, newest first. The heading may carry a date
//     (`## 0.4.0 - 2026-11-15`, `## [0.4.0] - 2026-11-15`), which is shown.
//   - Each version heading gets the version as its id, so /changelog#0.4.0 works.
//   - Other `##` sections, such as `## Unreleased` or `## 0.5.0 (unreleased)`,
//     are left out.
//   - An entry is marked "Security" when it sits under a `### Security` heading,
//     names an advisory (GHSA-… or CVE-…), or mentions a vulnerability or advisory.

import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(here, '..', 'CHANGELOG.md');
const OUTPUT = join(here, 'changelog', 'index.html');
const REPO = 'https://github.com/nicolaerusan/design-workbench';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ---------- Text ----------

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value) => value.replace(/[&<>"']/g, (char) => ENTITIES[char]);

// Running text between inline marks: typographic apostrophes like the rest of the site, then escaped.
const text = (value) => escapeHtml(value.replace(/(?<=\p{L})'(?=\p{L})/gu, '’'));

// Links may point at the web, an email address, an anchor on this page, or a file in the repo.
// Anything else (javascript:, data:, another host reached through a relative trick) is refused.
function resolveHref(raw) {
  const href = raw.trim();
  if (/^#[\w.-]+$/.test(href)) return href;
  try {
    if (/^(?:https?:\/\/|mailto:)/i.test(href)) return new URL(href).href;
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return null;
    const url = new URL(href, `${REPO}/blob/main/`);
    return url.href.startsWith(`${REPO}/`) ? url.href : null;
  } catch {
    return null;
  }
}

const INLINE = new RegExp([
  '(`+)(.+?)\\1(?!`)',                                                 // 1, 2  `code`
  '\\[([^\\]\\n]+)\\]\\(([^()\\s]+(?:\\([^()\\s]*\\)[^()\\s]*)*)\\)',  // 3, 4  [text](url)
  '<((?:https?://|mailto:)[^\\s<>]+)>',                                // 5     <url>
  '\\*\\*([^\\s*](?:[^*]*?[^\\s*])?)\\*\\*',                           // 6     **bold**
  '(?<![\\w*])\\*([^\\s*](?:[^*]*?[^\\s*])?)\\*(?![\\w*])',            // 7     *emphasis*
  '(?<![\\w_])_([^\\s_](?:[^_]*?[^\\s_])?)_(?![\\w_])',                // 8     _emphasis_
  '\\b(GHSA(?:-[0-9a-z]{4}){3})\\b',                                   // 9     GitHub advisory id
  '\\b(CVE-\\d{4}-\\d{4,7})\\b',                                       // 10    CVE id
  '(https?://[^\\s<>()]*[^\\s<>().,;:!?\'"])',                         // 11    bare url
].join('|'), 'g');

function inline(source, { links = true } = {}) {
  const link = (href, label, attrs = '') => (links && href ? `<a${attrs} href="${escapeHtml(href)}">${label}</a>` : label);
  let html = '';
  let last = 0;
  for (const match of source.matchAll(INLINE)) {
    const [whole, , code, label, target, autolink, bold, star, underscore, ghsa, cve, bare] = match;
    let piece;
    if (code !== undefined) piece = `<code>${escapeHtml(code.replace(/^ (.*) $/, '$1'))}</code>`;
    else if (label !== undefined) {
      const href = resolveHref(target);
      // A link that is refused stays on the page as the Markdown that was written.
      piece = links && !href ? text(whole) : link(href, inline(label, { links: false }));
    }
    else if (autolink !== undefined) piece = link(resolveHref(autolink), text(autolink));
    else if (bold !== undefined) piece = `<strong>${inline(bold, { links })}</strong>`;
    else if (star !== undefined || underscore !== undefined) piece = `<em>${inline(star ?? underscore, { links })}</em>`;
    else if (ghsa !== undefined) piece = link(`https://github.com/advisories/${ghsa}`, text(ghsa), ' class="ref"');
    else if (cve !== undefined) piece = link(`https://www.cve.org/CVERecord?id=${cve}`, text(cve), ' class="ref"');
    else piece = link(resolveHref(bare), text(bare));
    html += text(source.slice(last, match.index)) + piece;
    last = match.index + whole.length;
  }
  return html + text(source.slice(last));
}

// ---------- Blocks ----------

const BLANK = /^\s*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const RULE = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const LINK_DEFINITION = /^ {0,3}\[[^\]]+\]:\s*\S+/;
const LIST_ITEM = /^( *)([-*+]|\d{1,9}[.)])( +)(.*)$/;
const indentOf = (line) => line.length - line.trimStart().length;
const startsBlock = (line) => FENCE.test(line) || HEADING.test(line) || RULE.test(line) || LIST_ITEM.test(line);

function parseBlocks(lines) {
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (BLANK.test(line) || RULE.test(line) || LINK_DEFINITION.test(line)) { i += 1; continue; }

    const fence = FENCE.exec(line);
    if (fence) {
      const close = new RegExp(`^ {0,3}${fence[1][0]}{${fence[1].length},}\\s*$`);
      const body = [];
      i += 1;
      while (i < lines.length && !close.test(lines[i])) body.push(lines[i++]);
      i += 1;
      blocks.push({ type: 'pre', text: body.join('\n') });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      i += 1;
      continue;
    }

    const first = LIST_ITEM.exec(line);
    if (first) {
      const indent = first[1].length;
      const ordered = /\d/.test(first[2]);
      const list = { type: ordered ? 'ol' : 'ul', items: [] };
      while (i < lines.length) {
        const item = LIST_ITEM.exec(lines[i]);
        if (!item || item[1].length !== indent || /\d/.test(item[2]) !== ordered) break;
        const contentIndent = indent + item[2].length + item[3].length;
        const body = [item[4]];
        i += 1;
        while (i < lines.length) {
          const next = lines[i];
          if (BLANK.test(next)) {
            // A blank line stays inside the item only when indented content follows it.
            let j = i;
            while (j < lines.length && BLANK.test(lines[j])) j += 1;
            if (j < lines.length && indentOf(lines[j]) > indent) { body.push(''); i = j; continue; }
            break;
          }
          if (indentOf(next) > indent) { body.push(next.slice(Math.min(indentOf(next), contentIndent))); i += 1; continue; }
          if (startsBlock(next) || body.at(-1) === '') break;
          body.push(next.trim());
          i += 1;
        }
        list.items.push(parseBlocks(body));
        // Blank lines between two items of the same list don't end it.
        let j = i;
        while (j < lines.length && BLANK.test(lines[j])) j += 1;
        const sibling = j < lines.length && LIST_ITEM.exec(lines[j]);
        if (sibling && sibling[1].length === indent && /\d/.test(sibling[2]) === ordered) i = j;
      }
      blocks.push(list);
      continue;
    }

    const paragraph = [line.trim()];
    i += 1;
    while (i < lines.length && !BLANK.test(lines[i]) && !startsBlock(lines[i])) paragraph.push(lines[i++].trim());
    blocks.push({ type: 'p', text: paragraph.join(' ') });
  }
  return blocks;
}

// ---------- Releases ----------

function parseDate(value) {
  const match = /(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const [iso, year, month, day] = match;
  const date = new Date(Date.UTC(+year, +month - 1, +day));
  if (date.getUTCFullYear() !== +year || date.getUTCMonth() !== +month - 1 || date.getUTCDate() !== +day) return null;
  return { iso, label: `${+day} ${MONTHS[+month - 1]} ${year}` };
}

// "0.4.0", "v0.4.0", "[0.4.0] - 2026-11-15", "[0.4.0](https://…) (2026-11-15)", "0.2.1 - 2026-09-01 [YANKED]"
function parseReleaseHeading(heading) {
  const match = /^\[?v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)\]?(?:\([^)]*\))?(.*)$/.exec(heading.trim());
  if (!match || /\bunreleased\b/i.test(match[2])) return null;
  return { version: match[1], date: parseDate(match[2]), yanked: /\byanked\b/i.test(match[2]) };
}

// Semantic-version order, so the page is newest first whatever order the Markdown is in.
function compareVersions(a, b) {
  const parse = (version) => {
    const [core, pre] = version.split('+')[0].split(/-(.*)/s);
    return { core: core.split('.').map(Number), pre: pre ? pre.split('.') : null };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i += 1) if (x.core[i] !== y.core[i]) return x.core[i] - y.core[i];
  if (!x.pre || !y.pre) return x.pre ? -1 : y.pre ? 1 : 0;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i += 1) {
    const p = x.pre[i];
    const q = y.pre[i];
    if (p === undefined || q === undefined) return p === undefined ? -1 : 1;
    if (p === q) continue;
    const pn = /^\d+$/.test(p);
    const qn = /^\d+$/.test(q);
    if (pn && qn) return +p - +q;
    if (pn !== qn) return pn ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return 0;
}

const ADVISORY_ID = /\b(?:GHSA(?:-[0-9a-z]{4}){3}|CVE-\d{4}-\d{4,7})\b/;
const SECURITY_WORDS = /\b(?:vulnerabilit(?:y|ies)|advisor(?:y|ies)|security (?:fix|fixes|patch|patches|update|updates|issue|issues|release))\b/i;
const isSecurityText = (value) => ADVISORY_ID.test(value) || SECURITY_WORDS.test(value) || /^\**security\b/i.test(value);
const flatten = (blocks) => blocks.map((block) => (block.type === 'ul' || block.type === 'ol' ? block.items.map(flatten).join(' ') : block.text)).join(' ');

function readChangelog(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const changelog = { title: 'Changelog', intro: [], releases: [], skipped: [] };
  let release = null;
  let skipping = false;
  for (const block of parseBlocks(lines)) {
    if (block.type === 'heading' && block.level === 1 && !release && !skipping) { changelog.title = block.text; continue; }
    if (block.type === 'heading' && block.level === 2) {
      const head = parseReleaseHeading(block.text);
      skipping = !head;
      release = head ? { ...head, blocks: [] } : null;
      if (head) changelog.releases.push(release);
      else changelog.skipped.push(block.text);
      continue;
    }
    if (skipping) continue;
    (release ? release.blocks : changelog.intro).push(block);
  }

  const seen = new Set();
  for (const item of changelog.releases) {
    if (seen.has(item.version)) throw new Error(`CHANGELOG.md lists version ${item.version} twice; each version heading must be unique.`);
    seen.add(item.version);
  }
  changelog.releases.sort((a, b) => compareVersions(b.version, a.version));
  return changelog;
}

// ---------- HTML ----------

const pad = (depth) => '  '.repeat(depth);
const TAG_SECURITY = '<span class="tag">Security</span>';

function renderList(list, depth, state) {
  const items = list.items.map((blocks) => {
    const [lead, ...rest] = blocks;
    const tagged = state.tagItems && isSecurityText(flatten(blocks));
    if (tagged) state.security = true;
    const head = (tagged ? `${TAG_SECURITY} ` : '') + (lead?.type === 'p' ? inline(lead.text) : '');
    const body = renderBlocks(lead?.type === 'p' ? rest : blocks, depth + 2, { ...state, tagItems: false });
    return body ? `${pad(depth + 1)}<li>${head}\n${body}\n${pad(depth + 1)}</li>` : `${pad(depth + 1)}<li>${head}</li>`;
  });
  return `${pad(depth)}<${list.type}>\n${items.join('\n')}\n${pad(depth)}</${list.type}>`;
}

function renderBlocks(blocks, depth, state) {
  return blocks.map((block) => {
    if (block.type === 'heading') {
      // Entries under "Security" are marked by their heading, not one by one.
      const security = /^security\b/i.test(block.text);
      if (block.level === 3) state.tagItems = !security;
      if (security) state.security = true;
      const level = block.level === 3 ? 'h3' : 'h4';
      return `${pad(depth)}<${level}${security ? ' class="is-security"' : ''}>${inline(block.text)}</${level}>`;
    }
    if (block.type === 'pre') return `${pad(depth)}<pre><code>${escapeHtml(block.text)}</code></pre>`;
    if (block.type === 'p') {
      const tagged = state.tagItems && state.topLevel && isSecurityText(block.text);
      if (tagged) state.security = true;
      return `${pad(depth)}<p>${tagged ? `${TAG_SECURITY} ` : ''}${inline(block.text)}</p>`;
    }
    return renderList(block, depth, state);
  }).join('\n');
}

function renderRelease(release) {
  const id = escapeHtml(release.version);
  const state = { tagItems: true, topLevel: true, security: false };
  const body = renderBlocks(release.blocks, 3, state);
  release.security = state.security;
  const head = [
    `<h2 id="${id}"><a href="#${id}">${id}</a></h2>`,
    release.date && `<p class="meta"><time datetime="${release.date.iso}">${release.date.label}</time></p>`,
    release.yanked && '<span class="tag tag-quiet">Withdrawn</span>',
    release.security && TAG_SECURITY,
  ].filter(Boolean).map((line) => `${pad(4)}${line}`).join('\n');
  return `    <section class="col release" aria-labelledby="${id}">
      <header class="release-head">
${head}
      </header>
${body}
    </section>`;
}

function renderIntro(blocks) {
  return blocks.map((block) => (block.type === 'p'
    ? `${pad(3)}<p class="lede">${inline(block.text)}</p>`
    : renderBlocks([block], 3, { tagItems: false, topLevel: false, security: false }))).join('\n');
}

const LOGO = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h38M15 12 8 38M33 12l7 26M12 28h25"/></svg>';

// Tokens, base, top bar and footer mirror site/index.html. Keep the two in step.
const STYLES = `
:root {
  --bg: #f5f5f3;
  --fg: #1a1c18;
  --muted: #76766f;
  --line: #e3e3de;
  --line-strong: #cfcfc8;
  --surface-2: #fafaf8;
  --chip: #efefeb;
  --select: #2f62ff;

  --font-sans: "Geist", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  --font-mono: "Fragment Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --text: 19px;
  --col: 640px;
  --wide: 1040px;

  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #121311; --fg: #ecebe5; --muted: #8d8d86;
    --line: #272824; --line-strong: #3a3b36; --surface-2: #161714;
    --chip: #262723; --select: #7196ff;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #121311; --fg: #ecebe5; --muted: #8d8d86;
  --line: #272824; --line-strong: #3a3b36; --surface-2: #161714;
  --chip: #262723; --select: #7196ff;
  color-scheme: dark;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-sans);
  font-size: var(--text);
  font-weight: 300;
  line-height: 1.42;
  letter-spacing: -0.012em;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
svg { max-width: 100%; }
:focus-visible { outline: 2px solid var(--select); outline-offset: 2px; }

.page {
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
}

/* ---------- Top bar ---------- */
.topbar {
  max-width: var(--wide);
  margin: 0 auto;
  padding-block: 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: var(--fg);
  text-decoration: none;
  font-weight: 600;
  font-size: 17px;
  letter-spacing: -0.025em;
}
.brand svg { width: 22px; height: 22px; }
.topnav { display: flex; gap: 22px; font-family: var(--font-mono); font-size: 13px; letter-spacing: 0; }
.topnav a { color: var(--fg); text-decoration: none; }
.topnav a:hover, .topnav a[aria-current="page"] { text-decoration: underline; text-underline-offset: 4px; }
@media (max-width: 480px) { .topnav .on-wide { display: none; } }

/* ---------- Page ---------- */
.story { display: flex; flex-direction: column; gap: 64px; padding-bottom: 24px; }
.col { width: 100%; max-width: var(--col); margin-inline: auto; }
.intro { display: flex; flex-direction: column; gap: 22px; padding-top: clamp(28px, 7vw, 72px); }
h1 {
  margin: 0;
  font-size: clamp(32px, 5.2vw, 50px);
  line-height: 1.04;
  font-weight: 500;
  letter-spacing: -0.035em;
  text-wrap: balance;
}
.meta {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--muted);
}
.lede { margin: 0; font-size: clamp(19px, 2vw, 21px); }
.story a { color: inherit; text-decoration-line: underline; text-decoration-color: var(--line-strong); text-decoration-thickness: 1px; text-underline-offset: 4px; }
.story a:hover { text-decoration-color: currentColor; }
code { font-family: var(--font-mono); font-size: .8em; letter-spacing: 0; padding: .12em .38em; border-radius: 5px; background: var(--chip); }

/* ---------- Releases ---------- */
.release { display: flex; flex-direction: column; gap: 14px; padding-top: 30px; border-top: 1px solid var(--line-strong); overflow-wrap: break-word; }
.release-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; }
.release h2 {
  margin: 0;
  font-size: clamp(24px, 3.4vw, 28px);
  line-height: 1.1;
  font-weight: 500;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  scroll-margin-top: 28px;
}
.release h2 a { text-decoration-color: transparent; }
.release h3, .release h4 { margin: 12px 0 0; font-size: inherit; font-weight: 400; color: var(--muted); letter-spacing: inherit; }
.release h3.is-security, .release h4.is-security { color: var(--select); }
.release p { margin: 0; }
.release strong { font-weight: 500; }
.release .ref { white-space: nowrap; }
.release ul, .release ol { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 12px; }
.release li { position: relative; padding-left: 26px; }
.release ul > li::before { content: "–"; position: absolute; left: 0; color: var(--muted); }
.release ol { counter-reset: entry; }
.release ol > li { counter-increment: entry; }
.release ol > li::before { content: counter(entry); position: absolute; left: 0; top: .42em; font-family: var(--font-mono); font-size: 13px; line-height: 1.4; letter-spacing: 0; color: var(--muted); }
.release li > ul, .release li > ol, .release li > p, .release li > pre { margin-top: 10px; }
.release pre {
  margin: 0;
  padding: 11px 12px;
  overflow-x: auto;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 10px;
  font: 400 12.5px/1.55 var(--font-mono);
  letter-spacing: 0;
}
/* A flag or variable name stays in one piece and moves to the next line whole; it only breaks when it is wider than the column. */
.story code { display: inline-block; max-width: 100%; overflow-wrap: anywhere; }
.release pre code { display: inline; padding: 0; background: none; border-radius: 0; font-size: inherit; }

/* Same chip as the "Soon" marker on the home page */
.tag {
  display: inline-block;
  padding: 3px 8px;
  border: 1px solid color-mix(in srgb, var(--select) 35%, transparent);
  border-radius: 99px;
  color: var(--select);
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 400;
  line-height: 1.3;
  letter-spacing: .06em;
  text-transform: uppercase;
  white-space: nowrap;
}
.tag-quiet { border-color: var(--line-strong); color: var(--muted); }
.release-head .tag { align-self: center; }
.release-head .tag:first-of-type { margin-left: auto; }
.release li > .tag, .release p > .tag { margin-right: 4px; vertical-align: .2em; }

/* ---------- Footer ---------- */
.foot {
  max-width: var(--wide);
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 18px;
  padding-block: 64px 40px;
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: 0;
}
.foot .rule { flex: 1; min-width: 40px; height: 1px; background: var(--line-strong); }
.foot nav { display: flex; flex-wrap: wrap; gap: 8px 18px; }
.foot a { color: var(--fg); text-decoration: none; }
.foot a:hover, .foot a[aria-current="page"] { text-decoration: underline; text-underline-offset: 4px; }
`;

function renderPage(changelog) {
  const releases = changelog.releases.map(renderRelease).join('\n\n');
  const empty = `    <section class="col release">\n      <p>No releases yet.</p>\n    </section>`;
  return `<!doctype html>
<!-- Generated from CHANGELOG.md by site/build-changelog.mjs. Don't edit this file: change the Markdown, then run \`node site/build-changelog.mjs\`. -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Changelog · DesignBench</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="What changed in each DesignBench release, newest first, with security updates marked.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48' fill='none' stroke='%231a1c18' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12h38M15 12 8 38M33 12l7 26M12 28h25'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fragment+Mono&family=Geist:wght@300;400;500;600&display=swap">
<style>${STYLES}</style>
</head>
<body>
<div class="page">
  <header class="topbar">
    <a class="brand" href="/">
      ${LOGO}
      DesignBench
    </a>
    <nav class="topnav" aria-label="Site">
      <a href="/#start">Get started</a>
      <a class="on-wide" href="/changelog" aria-current="page">Changelog</a>
      <a href="${REPO}">GitHub</a>
    </nav>
  </header>

  <main class="story">

    <header class="col intro">
      <h1>${inline(changelog.title, { links: false })}</h1>
${renderIntro(changelog.intro)}
    </header>

${releases || empty}

  </main>

  <footer class="foot">
    <span>DesignBench</span>
    <span class="rule" aria-hidden="true"></span>
    <nav aria-label="Footer">
      <a href="/changelog" aria-current="page">Changelog</a>
      <a href="${REPO}">GitHub</a>
      <a href="${REPO}/blob/main/LICENSE">MIT license</a>
      <a href="https://pattern.garden">Pattern Garden</a>
    </nav>
  </footer>
</div>
</body>
</html>
`;
}

// ---------- Run ----------

const isMain = Boolean(process.argv[1]) && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url;
if (isMain) {
  const changelog = readChangelog(readFileSync(SOURCE, 'utf8'));
  const page = renderPage(changelog);
  const target = relative(process.cwd(), OUTPUT);
  const summary = changelog.releases.map((release) => release.version + (release.security ? ' (security)' : '')).join(', ') || 'no releases';

  if (process.argv.includes('--check')) {
    let current = null;
    try { current = readFileSync(OUTPUT, 'utf8'); } catch {}
    if (current !== page) {
      console.error(`${target} is out of date with CHANGELOG.md. Run: node site/build-changelog.mjs`);
      process.exit(1);
    }
    console.log(`${target} is up to date: ${summary}`);
  } else {
    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, page);
    console.log(`Wrote ${target}: ${summary}`);
  }
  for (const heading of changelog.skipped) console.log(`Left out "${heading}" (not a released version)`);
}

export { inline, parseBlocks, readChangelog, renderPage, resolveHref };
