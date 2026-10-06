# DesignBench 0.3.0 preview review

Reviewed on October 6, 2026, on macOS with Node 24.8.0 and npm 11.6.0.

## Scope and findings

Reviewed the CLI's discovery, fixture generation, development server, variant
creation and promotion, property URL validation, reference URL handling, browser
storage, package exports, and release contents. Reviewed the repository's tracked
files and history for credential patterns before public release.

Changes made during review:

- Updated the transitive source-map-js dependency to resolve GHSA-68fv-2mgg-jv7q.
- Disabled cross-origin responses on the loopback preview server and explicitly
  blocked npm/Netrc/SSH credential paths as well as environment and Git files.
- Added path confinement, symlink rejection, export checks, original-source hash
  checks, an exclusive backup, and a final source recheck for promotion.
- Kept all writes in explicit local CLI commands; the browser has no promotion
  endpoint. Promotion defaults to a diff and requires --apply to write.
- Retained shadcn/ui attribution and added the project's MIT license.

## Validation

- TypeScript build and typecheck pass.
- 18 automated tests pass, including selection/property validation, discovery,
  fixture preservation, server routes, credential-file denial, CORS, variant
  comparison data, import rebasing, promotion/backup, stale-source rejection,
  missing exports, traversal, and symlinks.
- npm audit reports zero known vulnerabilities after the dependency update.
- Installed the actual package tarball in a new React project outside the repo.
  Ran the installed npx executable through init, add, variant create, and dev.
- Browser verified the installed UI and variants with React 19.3.0 and 18.3.1.
  A variant created while the server was running appeared automatically.
- Browser verified the example's Source, Ink, and Soft variants, shared label
  overrides, independent click behavior, and copyable agent instructions.
- Reviewed the package file allowlist. No project fixtures, application source,
  extraction records, credential files, or node_modules are included.
- A credential-pattern scan of 111 historical file blobs found no matches for
  private keys, npm/GitHub tokens, AWS keys, or long secret literals. This was
  a heuristic scan, not a comprehensive external security audit.

## Release limits

This is suitable for an early preview of trusted local React projects, not a hosted
multi-user service. Fixtures execute project code and may have side effects.
Promotion handles one complete file; it cannot prove semantic compatibility or
promote dependency changes and additional files. Host application tests remain
necessary. Framework-specific server components require custom fixtures or an
embedded host integration. Annotation tools and AI coding are supplied by the
user's development environment. Pattern Garden network integrations are planned.

npm publication still requires account authentication and publishing verification.
The public GitHub release tarball can be installed independently of npm publication.
