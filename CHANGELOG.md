# Changelog

Notable changes to DesignBench. Versions follow [semantic versioning](https://semver.org);
before 1.0, a minor version may change behavior.

## 0.4.0

### Added

- **Update notice.** `designbench dev` asks the npm registry once a day whether a
  newer version exists. The terminal and the sidebar show the version and the
  command to run. DesignBench never installs anything itself. If the running
  version has been deprecated, the workbench shows the publisher's message
  prominently. Turn the check off with `--no-update-check`,
  `DESIGNBENCH_NO_UPDATE_CHECK=1`, or `NO_UPDATE_NOTIFIER=1`; it is always off in CI.
- **A broken fixture no longer stops the workbench.** Fixtures load one by one.
  One whose imports fail to build, or throw while loading, is listed under
  "Needs attention" with the file and the error, and the rest keep working.
  Saved variants load the same way. Previously `designbench add --all` could
  leave a blank page. New exports: `loadPreviews` and `PreviewLoadError`.
- If the catalog itself cannot load, the page says why instead of staying blank.
- The running version appears in the sidebar footer.
- `Workbench` accepts `version` and `update` for embedded hosts that run their own check.
- Collapsible sidebar groups.
- Live preview thumbnails on the Components overview.

### Changed

- Requires Vite 8.3.8 or later. Vite 8.3.0–8.3.2 have high-severity advisories
  affecting the development server (GHSA-9jrq-w75r-8gcw, GHSA-rq7h-c2jc-7f22,
  GHSA-vfpm-58rq-9qcg, and three in `launch-editor`).
- The Vite cache moved from the system temporary directory to a per-user cache
  directory, which other local users cannot write to.
- Previews can read `process.env`. It contains only `NODE_ENV`; your shell's
  environment is not copied into it. Client modules such as `next/link` need it to load.
- Build errors appear on the fixture they affect and in the terminal. Vite's
  full-page error overlay is off.
- `designbench dev --cwd <directory>` runs from that directory, so Tailwind and
  other host tools find their configuration.

### Upgrading from 0.3.0

A `.design-workbench/catalog.ts` created by 0.3.0 keeps working, but still
imports every fixture in one step. To isolate failing fixtures, replace its
`import.meta.glob` block with:

```ts
import { loadPreviews } from 'designbench';
export const { entries, renderPreview } = await loadPreviews(import.meta.glob('./previews/*.tsx'));
```

### Release process

- Releases publish from GitHub Actions with npm trusted publishing and provenance.
  No npm token is stored in the repository. See [docs/releasing.md](./docs/releasing.md).
- CI audits shipped dependencies and registry signatures on every change and weekly.

## 0.3.0

GitHub pre-release only. Saved design variants, guarded promotion, the standalone
CLI (`init`, `scan`, `add`, `variant`, `dev`), and the Components overview. See
[docs/release-review-0.3.0.md](./docs/release-review-0.3.0.md).
