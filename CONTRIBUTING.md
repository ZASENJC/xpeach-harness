# Contributing

English | [中文](CONTRIBUTING.zh.md)

Thanks for your interest in XPeach Harness.

This repository is the client for the [🍑Code](https://xpeach.codes) relay. It is built on an
everything-is-a-plugin core, so most changes belong in one package rather than across the tree.

## Before you start

- Read [`docs/architecture.md`](docs/architecture.md) for the package layout.
- Read [`AGENTS.md`](AGENTS.md) for the conventions this repository enforces, including the
  pre-stable API and session-data rules.
- Run `pnpm run build` and the relevant tests before opening a pull request.

## Ways to help

- **Report a bug.** Open a [GitHub Issue](https://github.com/yellowpeachxgp/xpeach-harness/issues)
  with the app version, your platform, and the smallest reproduction you can manage.
- **Request a model or a route.** Groups and models are served by the site, not by this client.
  Tell us what your token cannot reach and we will look at the relay side.
- **Improve the client.** UI slots, tools and provider adapters are independent plugin packages;
  a focused pull request against one of them is easiest to review.

## Pull requests

- Keep one change per pull request and explain the user-visible effect.
- Match the surrounding style; the repository enforces formatting and type checks in CI.
- Add or update tests for behaviour you change. Snapshots and fixtures follow the product, so
  refresh them with the commands named in their test file.

## License

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
