# Security

DesignBench is a local development tool for trusted project code. The preview
server binds to loopback, disables cross-origin reads, and blocks common credential
files. Do not expose it through a public tunnel or use it to execute untrusted
components. Preview iframes isolate layout, not permissions or side effects.

Discovery parses files without executing them. Previewing executes component and
fixture imports. Mock network writes, authentication, and private data in fixtures.
Property overrides and notes appear in URLs or local browser storage; use synthetic
data. Share copies a URL; it does not upload or host a preview.

Previews see a `process.env` that contains only `NODE_ENV`. The runner does not
copy your shell's environment into it. When a fixture fails to
build, the page reads the build error, with project-relative file paths and a
source excerpt, from the local server. That request is read-only and, like the
rest of the server, is not readable from other origins.

Variant promotion is an explicit local operation: the `variant promote --apply`
command, or the **Use … in my app** button in the workbench the CLI serves, which
names the file it replaces and asks you to confirm. The button calls the local
preview server, which accepts that request only from the workbench page itself: a
loopback Host, a matching Origin, and a header other sites cannot send. Either way
promotion checks the original source hash, rejects symlinks and out-of-project
paths, and retains a backup. It replaces one complete file, so review the proposed
diff and host application tests first.
Variant manifests and fixtures are trusted project files, not an upload format.
These guards do not protect against a malicious process concurrently modifying
the checkout. Use version control for recovery.

The workbench page tells the local preview server which component, variant, and
state it is showing, so that `designbench mcp` can pass that to a coding agent you
connected. Only names, ids, and file paths are sent, and only to the loopback
server. `designbench mcp` authenticates with a random token that the server writes
to a file in your temporary folder, readable by your user account only; requests
that carry a browser Origin are refused. The MCP server can read the current view,
change which view is open, and list components. It cannot edit files or promote
variants. Any process running as your user can read the token, as it can read
your project.

## Updates and releases

`designbench dev` makes one outbound request a day: a GET for the public
`designbench` package metadata, from the registry npm is configured to use. It
sends nothing about your project. The response is untrusted input: DesignBench
reads a stable version number and a plain-text deprecation message from it, and
executes nothing. It never downloads or installs a version; it shows a command
for you to run. Disable the check with `--no-update-check`,
`DESIGNBENCH_NO_UPDATE_CHECK=1`, or `NO_UPDATE_NOTIFIER=1`. The browser has no
endpoint that installs or updates DesignBench. The only endpoint that writes
source is variant promotion, described above.

The package has no install scripts and works when installed with
`--ignore-scripts`. Releases are published from GitHub Actions through npm
trusted publishing, without a stored npm token, and carry a provenance
attestation that `npm audit signatures` verifies. Prefer a pinned development
dependency and a committed lockfile. An unversioned `npx designbench` runs the
newest release of DesignBench and of each dependency, with nothing pinned.

A release with a known security problem is deprecated on the registry, and the
workbench then shows that message to anyone still running it.

## Reporting

Report suspected vulnerabilities privately through the repository owner's GitHub
profile contact options. Do not include credentials or private application code
in public issues. Automated tests and dependency audits are useful checks, not a
guarantee that all vulnerabilities have been found.
