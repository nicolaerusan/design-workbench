# Security

DesignBench is a local development tool for trusted project code. The preview
server binds to loopback, disables cross-origin reads, and blocks common credential
files. Do not expose it through a public tunnel or use it to execute untrusted
components. Preview iframes isolate layout, not permissions or side effects.

Discovery parses files without executing them. Previewing executes component and
fixture imports. Mock network writes, authentication, and private data in fixtures.
Property overrides and notes appear in URLs or local browser storage; use synthetic
data. Share copies a URL; it does not upload or host a preview.

Variant promotion is an explicit local CLI operation. It checks the original source
hash, rejects symlinks and out-of-project paths, and retains a backup. It replaces
one complete file, so review the proposed diff and host application tests first.
Variant manifests and fixtures are trusted project files, not an upload format.
These guards do not protect against a malicious process concurrently modifying
the checkout. Use version control for recovery.

Report suspected vulnerabilities privately through the repository owner's GitHub
profile contact options. Do not include credentials or private application code
in public issues. Automated tests and dependency audits are useful checks, not a
guarantee that all vulnerabilities have been found.
