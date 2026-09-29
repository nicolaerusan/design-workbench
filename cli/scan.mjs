import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const ignored = new Set(['node_modules', 'dist', 'build', 'coverage', 'vendor', 'storybook-static']);
const sourcePattern = /\.(?:[cm]?[jt]sx?)$/;
const storyPattern = /\.stories\.[cm]?[jt]sx?$/;
const excludedPattern = /\.(?:test|spec|stories)\.[cm]?[jt]sx?$|\.d\.[cm]?ts$/;
const upper = name => /^[A-Z]/.test(name);
const modifier = (node, kind) => node.modifiers?.some(item => item.kind === kind);

function callable(node) {
  if (!node) return false;
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) return true;
  if (ts.isClassDeclaration(node)) return !!node.heritageClauses?.some(clause => clause.types.some(type => /(?:^|\.)(?:Pure)?Component$/.test(type.expression.getText())));
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) return callable(node.expression);
  if (ts.isCallExpression(node)) return /(?:^|\.)(memo|forwardRef)$/.test(node.expression.getText());
  return false;
}

export function componentExports(text, file) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const declarations = new Map();
  for (const node of source.statements) {
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) declarations.set(node.name.text, node);
    if (ts.isVariableStatement(node)) for (const item of node.declarationList.declarations)
      if (ts.isIdentifier(item.name)) declarations.set(item.name.text, item.initializer);
  }
  const result = new Map();
  const inferredName = path.basename(file).replace(/\.[^.]+$/, '').replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());
  const add = (exportName, localName, node) => {
    if (upper(localName) && callable(node)) result.set(exportName, { exportName, name: localName });
  };
  for (const node of source.statements) {
    if (modifier(node, ts.SyntaxKind.ExportKeyword)) {
      if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
        const name = node.name?.text ?? inferredName;
        add(modifier(node, ts.SyntaxKind.DefaultKeyword) ? 'default' : name, name, node);
      }
      if (ts.isVariableStatement(node)) for (const item of node.declarationList.declarations)
        if (ts.isIdentifier(item.name)) add(item.name.text, item.name.text, item.initializer);
    }
    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      const identifier = ts.isIdentifier(node.expression) ? node.expression.text : inferredName;
      add('default', identifier, declarations.get(identifier) ?? node.expression);
    }
    if (ts.isExportDeclaration(node) && !node.isTypeOnly && !node.moduleSpecifier && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const item of node.exportClause.elements) {
        if (item.isTypeOnly) continue;
        const name = item.propertyName?.text ?? item.name.text;
        add(item.name.text, item.name.text === 'default' ? name : item.name.text, declarations.get(name));
      }
    }
  }
  return [...result.values()];
}

export async function scanProject(root, sourceDirs) {
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const sources = sourceDirs?.length ? sourceDirs : ['src', 'app', 'components', 'pages'];
  const files = new Set();
  async function walk(dir) {
    for (const item of (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (item.isSymbolicLink() || item.name.startsWith('.') || ignored.has(item.name)) continue;
      const file = path.join(dir, item.name);
      if (item.isDirectory()) await walk(file);
      else if (item.isFile() && sourcePattern.test(file)) files.add(file);
    }
  }
  const scanned = [];
  for (const dir of sources) {
    const full = path.resolve(root, dir);
    const relative = path.relative(root, full);
    if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) throw new Error(`Source directory must be inside the project: ${dir}`);
    let stat;
    try { stat = await fs.lstat(full); } catch (error) { if (error.code === 'ENOENT' && !sourceDirs?.length) continue; throw error; }
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Source directory must be a real directory: ${dir}`);
    const real = await fs.realpath(full);
    const realRoot = await fs.realpath(root);
    const realRelative = path.relative(realRoot, real);
    if (realRelative.startsWith('..' + path.sep) || path.isAbsolute(realRelative)) throw new Error(`Source directory resolves outside the project: ${dir}`);
    scanned.push(dir);
    await walk(full);
  }
  const components = [];
  const stories = [];
  const posix = file => path.relative(root, file).split(path.sep).join('/');
  for (const file of [...files].sort()) {
    if (storyPattern.test(file)) { stories.push(posix(file)); continue; }
    if (excludedPattern.test(file)) continue;
    for (const component of componentExports(await fs.readFile(file, 'utf8'), file)) {
      components.push({ id: `${posix(file)}#${component.exportName}`, file: posix(file), ...component, status: 'needs-review' });
    }
  }
  const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  return {
    schemaVersion: 1,
    project: pkg.name ?? path.basename(root),
    sources: scanned,
    frameworks: ['next', 'vite', 'react', 'storybook'].filter(name => dependencies[name] || name === 'storybook' && Object.keys(dependencies).some(key => key.startsWith('@storybook/'))),
    components, stories,
    limitations: [
      'Candidates are exported PascalCase functions, classes, or memo/forwardRef wrappers; a candidate may not be a React component.',
      'Barrel re-exports, dynamic exports, custom HOCs, and files outside the source directories are not resolved.',
      'Required props, providers, styles, server dependencies, and actual production usage require review.',
      'Discovery does not execute source code, create stories, or claim preview coverage.',
    ],
  };
}
