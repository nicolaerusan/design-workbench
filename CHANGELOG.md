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

### Release process

- Releases publish from GitHub Actions with npm trusted publishing and provenance.
  No npm token is stored in the repository. See [docs/releasing.md](./docs/releasing.md).
- CI audits shipped dependencies and registry signatures on every change and weekly.

## 0.3.0

GitHub pre-release only. Saved design variants, guarded promotion, the standalone
CLI (`init`, `scan`, `add`, `variant`, `dev`), and the Components overview. See
[docs/release-review-0.3.0.md](./docs/release-review-0.3.0.md).
