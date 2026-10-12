# Changelog

## 1.0.3 - 2026-10-12

- Reject malformed repository identifiers with empty owner/repository segments instead of silently normalizing them to a different repository.

## 1.0.2 - 2026-10-12

- Discover contributor, security, conduct, and issue-template files anywhere in the recursive repository tree, including under `.github/`.
- Flag truncated GitHub trees in the on-screen status and copied report so incomplete file discovery is visible.

## 1.0.1 - 2026-10-11

- Accept GitHub repository links copied from issues and file/tree views by extracting the repository path.
- Document the expanded URL input behavior.

## 1.0.0 - 2026-10-11

- Initial release of the local-first public GitHub repository readiness checker.
