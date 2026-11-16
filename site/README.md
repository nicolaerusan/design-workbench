# DesignBench site

The landing site for DesignBench. Everything in this folder is served as it is, with no build step, except the changelog page.

- `index.html` is the landing page, written by hand.
- `setup.md` is the guide an agent follows to set DesignBench up.
- `changelog/index.html` is generated from the repo's `CHANGELOG.md`. Don't edit it by hand.

## Update the changelog page

Edit `CHANGELOG.md` at the repo root, then run this from the repo root and commit both files:

```
node site/build-changelog.mjs
```

`node site/build-changelog.mjs --check` exits with an error when the page no longer matches `CHANGELOG.md`.

The page lists every `## <version>` section, newest first. Each version is its own anchor, so `/changelog#0.4.0` opens that release.

- Add a date to a heading to show it: `## 0.4.0 - 2026-11-15`.
- A `## Unreleased` section, or a heading such as `## 0.5.0 (unreleased)`, stays off the page.
- An entry is marked "Security" when it sits under a `### Security` heading, names an advisory (`GHSA-…` or `CVE-…`), or mentions a vulnerability or advisory.
- Links to files in the repo, such as `./docs/releasing.md`, point at GitHub.

The Markdown is rendered as text. HTML written in `CHANGELOG.md` shows up as literal characters.

## Preview

```
python3 -m http.server 4317 --bind 127.0.0.1 --directory site
```

Then open `http://127.0.0.1:4317/` and `http://127.0.0.1:4317/changelog`.

`build-changelog.mjs` and this file are listed in `.vercelignore`, so they are not uploaded with the site.
