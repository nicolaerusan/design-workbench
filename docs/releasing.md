# Releasing DesignBench

Releases publish to npm from GitHub Actions. The workflow proves its identity to
npm with a short-lived OIDC token (trusted publishing), so no npm token exists to
steal, and npm attaches a provenance attestation linking each tarball to the
commit and workflow that built it.

## One-time setup

1. **First publish.** A trusted publisher is configured from the package's
   settings page, so the package has to exist. Publish the first version by hand
   from a clean checkout of the tagged commit, signed in with two-factor
   authentication: `npm publish --access public`.
2. **Trusted publisher.** On npmjs.com, open the `designbench` package →
   Settings → Trusted publisher → GitHub Actions, and enter:
   - Organization or user: `nicolaerusan`
   - Repository: `design-workbench`
   - Workflow filename: `release.yml`
   - Environment name: `npm`
3. **Publishing access.** In the same settings page, require two-factor
   authentication and disallow tokens, so the workflow is the only automated path.
4. **GitHub environment.** Repository → Settings → Environments → `npm`. Add
   yourself as a required reviewer and limit deployment to tags matching `v*`.
   A pushed tag then waits for an approval before anything is published.
5. **Branch protection.** Protect `main` (pull request and passing CI required).
   The release job refuses tags that are not on `main`.

## Each release

1. Update `CHANGELOG.md` and run `npm version <patch|minor|major>` on `main`.
2. `git push --follow-tags`.
3. Approve the `npm` environment deployment in the Actions run.
4. Confirm the release: `npm view designbench version` and
   `npm audit signatures` in a project that installs it.

The job stops before publishing if the tag does not match `package.json`, the
commit is not on `main`, tests fail, or a shipped dependency has a high-severity
advisory.

## Withdrawing a release

Users on an affected version see the message in their workbench the next time
they run `designbench dev`, so write it for them:

```sh
npm deprecate designbench@0.4.0 "Security fix in 0.4.1. Update before running dev."
```

Publish the fixed version first, then deprecate. `npm unpublish` is available for
72 hours after publication and removes the version for everyone, including
lockfiles that pin it; prefer deprecation unless the tarball itself is harmful.
To clear a deprecation, pass an empty message.
