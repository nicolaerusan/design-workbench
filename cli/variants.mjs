import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { componentExports } from './scan.mjs';

const hash = text => createHash('sha256').update(text).digest('hex');
const validId = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const applicationPath = value => typeof value === 'string' && /\.[jt]sx?$/.test(value) && !path.normalize(value).split(path.sep).some(part => part.startsWith('.') || part === 'node_modules');
const inside = (root, target) => { const rel = path.relative(root, target); return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel); };

/** Refuse symlinks at every path segment, including the final write target. */
async function safePath(root, relative, { missing = false } = {}) {
  if (!relative || path.isAbsolute(relative)) throw new Error('Expected a path relative to the project.');
  const target = path.resolve(root, relative);
  if (!inside(root, target) || target === root) throw new Error('Path escapes the project.');
  let current = root;
  for (const segment of path.relative(root, target).split(path.sep)) {
    current = path.join(current, segment);
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw new Error('Symlinks are not supported for variants.'); }
    catch (error) { if (!(missing && error.code === 'ENOENT')) throw error; }
  }
  return target;
}
function variantDir(component, variant) {
  if (!validId(component) || !validId(variant) || variant === 'current') throw new Error('Use stable lowercase component and variant IDs; current is reserved.');
  return `.design-workbench/ideas/${component}/${variant}`;
}
function rebaseImports(text, from, to, root) {
  const source = ts.createSourceFile(from, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const add = node => {
    if (!node || !ts.isStringLiteralLike(node)) throw new Error('Dynamic module paths need manual setup; use static imports in a variant.');
    const specifier = node.text;
    if (!specifier.startsWith('.')) return;
    const target = path.resolve(path.dirname(from), specifier);
    if (!inside(root, target)) throw new Error('Relative import escapes the project.');
    let relative = path.relative(path.dirname(to), target).split(path.sep).join('/');
    if (!relative.startsWith('.')) relative = './' + relative;
    edits.push({ start: node.getStart(source), end: node.end, text: JSON.stringify(relative) });
  };
  const visit = node => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) { if (node.moduleSpecifier) add(node.moduleSpecifier); }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require')) add(node.arguments[0]);
    if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) throw new Error('import.meta needs manual setup; this file cannot be safely cloned or promoted automatically.');
    ts.forEachChild(node, visit);
  };
  visit(source);
  for (const edit of edits.sort((a,b) => b.start - a.start)) text = text.slice(0,edit.start) + edit.text + text.slice(edit.end);
  return text;
}
export async function createVariant(root, { component, variant, from, name }) {
  root = await fs.realpath(root);
  await safePath(root, '.design-workbench/config.json');
  const relative = variantDir(component, variant);
  const split = from?.lastIndexOf('#') ?? -1;
  if (split < 1) throw new Error('Use --from path/to/Component.tsx#ExportName (or #default).');
  const sourcePath = from.slice(0, split), exportName = from.slice(split + 1);
  if (!/^[A-Za-z_$][\w$]*$/.test(exportName)) throw new Error('Invalid export name.');
  if (!applicationPath(sourcePath)) throw new Error('Choose an application source .tsx, .ts, .jsx, or .js file outside hidden directories and dependencies.');
  const source = await safePath(root, sourcePath);
  const original = await fs.readFile(source, 'utf8');
  if (!componentExports(original, sourcePath).some(item => item.exportName === exportName)) throw new Error('No matching component export. Use scan to check the source export name.');
  const directory = await safePath(root, relative, { missing: true });
  const implementation = path.join(directory, 'component' + path.extname(source));
  const rebased = rebaseImports(original, source, implementation, root);
  await fs.mkdir(path.dirname(directory), { recursive: true });
  await fs.mkdir(directory); // Exclusive: preserve existing variants.
  const manifest = { schemaVersion: 1, component, id: variant, name: name || variant, source: sourcePath, exportName, baseHash: hash(original), createdAt: new Date().toISOString() };
  await fs.writeFile(implementation, rebased, { flag: 'wx' });
  await fs.writeFile(path.join(directory, 'variant.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  await fs.writeFile(path.join(directory, 'index.tsx'), `import React from 'react';
import * as Source from ${JSON.stringify('./' + path.basename(implementation))};
import metadata from './variant.json';
import type { Selection, PreviewProps } from 'designbench';

// Keep the original public props and behavior. Add synthetic fixture props here if required.
const Component = Source[${JSON.stringify(exportName)}] as React.ComponentType<any>;
export const componentId = metadata.component;
export const design = { id: metadata.id, name: metadata.name, kind: 'exploration' as const, source: ${JSON.stringify(relative + '/' + path.basename(implementation))} };
export function render(_selection: Selection, props: PreviewProps) { return <div style={{ padding: 32 }}><Component {...props} /></div>; }
`, { flag: 'wx' });
  return { component, variant, directory: relative, source: path.relative(root, implementation), next: 'Edit the copied implementation and index.tsx fixture. Open DesignBench to compare. Original application source is unchanged.' };
}
export async function promoteVariant(root, { component, variant, apply = false }) {
  root = await fs.realpath(root);
  const directory = await safePath(root, variantDir(component, variant));
  const manifestFile = await safePath(root, path.relative(root, path.join(directory, 'variant.json')));
  const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
  if (manifest.schemaVersion !== 1 || manifest.component !== component || manifest.id !== variant || !/^[a-f0-9]{64}$/.test(manifest.baseHash) || !applicationPath(manifest.source)) throw new Error('Invalid variant metadata.');
  const target = await safePath(root, manifest.source);
  const current = await fs.readFile(target, 'utf8');
  const variantSource = await safePath(root, path.relative(root, path.join(directory, 'component' + path.extname(target))));
  const proposed = rebaseImports(await fs.readFile(variantSource, 'utf8'), variantSource, target, root);
  if (hash(current) !== manifest.baseHash) throw new Error('Application source changed since this variant was created. Reconcile it manually before promoting.');
  if (current === proposed) return { status: 'unchanged', target: manifest.source };
  if (!componentExports(proposed, manifest.source).some(item => item.exportName === manifest.exportName)) throw new Error('Variant no longer exports the original component. Restore its public export before promotion.');
  if (!apply) {
    const before = current.trimEnd().split('\n'), after = proposed.trimEnd().split('\n');
    const diff = [`--- a/${manifest.source}`, `+++ b/${manifest.source}`, `@@ -1,${before.length} +1,${after.length} @@`, ...before.map(line => '-' + line), ...after.map(line => '+' + line)].join('\n');
    return { status: 'review', target: manifest.source, diff, next: 'Review the entire change, test it, then rerun with --apply. This replaces only this source file, not dependencies or fixture props.' };
  }
  // Exclusive backup is retained beside variant metadata. Recheck before the final write.
  const backup = path.join(directory, 'before-promotion' + path.extname(target));
  await fs.writeFile(backup, current, { flag: 'wx' });
  await safePath(root, manifest.source);
  const handle = await fs.open(target, constants.O_RDWR | constants.O_NOFOLLOW);
  try {
    if (await handle.readFile('utf8') !== current) throw new Error('Application source changed during promotion; no changes applied.');
    const bytes = Buffer.from(proposed);
    let offset = 0;
    while (offset < bytes.length) offset += (await handle.write(bytes, offset, bytes.length - offset, offset)).bytesWritten;
    await handle.truncate(bytes.length);
    await handle.sync();
  } finally { await handle.close(); }
  return { status: 'applied', target: manifest.source, backup: path.relative(root, backup), next: 'Review the Git diff and run application checks. The app source preview now renders this implementation.' };
}
