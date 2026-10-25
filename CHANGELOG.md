# Changelog

## 1.0.6 - 2026-10-25

- Use a root README found in the recursive tree when the separate README API request is unavailable.
- Require exact community-file names and valid `.github/ISSUE_TEMPLATE` paths to avoid false positives from lookalike filenames.
- Add regression checks for evidence matching and package/changelog/cache-version consistency.

## 1.0.5 - 2026-10-25

- Add the score denominator element required by the checkup renderer so successful audits display results without a runtime error.
- Add a regression test that checks app selectors are present in the page markup.


## 1.0.4 - 2026-10-25

- Mark failed optional GitHub API checks as unavailable instead of reporting them as missing; calculate and label the score using only verified signals.
- Include unavailable checks and the verified score denominator in copied reports.

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
