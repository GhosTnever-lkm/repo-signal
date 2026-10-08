<div align="center">

# ↗ RepoSignal

**Make a good repository easy to trust.**

A free, local-first checkup for the public GitHub signals that help people understand, find, and contribute to a project.

[Open the web app](https://ghostnever-lkm.github.io/repo-signal/) · [Report a problem](https://github.com/GhosTnever-lkm/repo-signal/issues/new)

</div>

RepoSignal reads public GitHub metadata and builds a practical checklist for a repository. It looks for a clear description, README, license, topics, Actions workflows, a release, contributor guidance, code of conduct, security policy, and issue templates.

## What you get

- A weighted score with each signal explained; no opaque AI judgement.
- Direct links to places where missing project details can be added.
- A copyable Markdown checklist for a project board or release plan.
- Public repositories only, no account and no access token.
- A dark or light interface that runs in your browser.

## Use it

Open [RepoSignal](https://ghostnever-lkm.github.io/repo-signal/) and paste a public GitHub repository URL or `owner/name`. You can also run a local copy by serving this folder over HTTP; opening `index.html` directly may block JavaScript modules in some browsers.

## How scoring works

The 10 visible checks have fixed weights that add up to 100. A signal earns its points only when the corresponding public metadata or file is visible. The app shows the evidence and missing steps instead of calling the score a measure of code quality.

This is a discoverability and project handoff checklist. It does **not** inspect source code, validate release quality, or perform a security review. Some projects intentionally do not need every item.

## Privacy and limits

The page sends read-only requests to GitHub's public REST API from your browser. It does not clone or upload repository files and has no backend or database. GitHub's unauthenticated public API rate limits apply; if a limit is reached, wait and try again.

## Development

Requires Node.js 20 or newer for the test suite:

```sh
npm test
```

The app itself has no build step or runtime dependencies.

## License

MIT. See [LICENSE](LICENSE).
