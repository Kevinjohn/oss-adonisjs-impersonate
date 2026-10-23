# Contributing

Thanks for helping. Bug reports, documentation fixes and store adapters are all welcome.

## Before you start

- For a bug, open an issue with a reproduction first, unless the fix is a one-line change.
- For a new feature or a behaviour change, open an issue to agree the shape before writing code.
  Masquerade keeps a small public surface on purpose, and [DEVELOPMENT-PLAN.md](DEVELOPMENT-PLAN.md)
  records what v1 deliberately leaves out.
- Report security problems privately, as described in [SECURITY.md](SECURITY.md). Do not open a
  public issue.

## Project principles

Every change follows these.

- **Built for everyone who uses AdonisJS.** Follow the open-source AdonisJS packages and starter
  kits for names, shapes and behaviour. Match AdonisJS Plus only where that costs nothing; Plus
  compatibility is not a goal and never outweighs consistency for open-source users.
- **The application owns its language.** Errors carry stable codes and English messages. The host
  exception handler localises; the package ships no translations, loader or locale setting.
- **The actor stays authenticated.** Masquerade never logs in as the target, mints a target
  credential or unions actor and target permissions. [SPEC-impersonation.md](SPEC-impersonation.md)
  section 3 lists the invariants; a pull request that weakens one is a product change, not a fix.

## Local setup

You need Node.js 24 and pnpm. The repository pins Node 24 in `.nvmrc`; `better-sqlite3` is compiled
against it and the tests fail under other versions.

```sh
nvm use
pnpm install
pnpm quick:test
```

To skip local setup, open the repository in GitHub Codespaces. The dev container installs Node 24,
pnpm and the dependencies; run `pnpm quick:test` once it is ready.

## Checks

Run the repository scripts, not the bare tools. They carry the flags the release gate uses.

| Script                    | What it does                                                   |
| ------------------------- | -------------------------------------------------------------- |
| `pnpm lint`               | ESLint with the AdonisJS config                                |
| `pnpm typecheck`          | TypeScript without emitting                                    |
| `pnpm quick:test`         | Japa test suite against SQLite                                 |
| `pnpm test:pg`            | The same suite against a throwaway local PostgreSQL 16 cluster |
| `pnpm build`              | Compiles to `build/`                                           |
| `pnpm test:built-exports` | Loads public exports and runs Ace configure from the build     |

`pnpm test:pg` needs PostgreSQL 16 binaries (`brew install postgresql@16` on macOS). To use your
own server instead, set `DB_CLIENT=pg` plus `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` and
`DB_DATABASE`, then run `pnpm quick:test`.

`pnpm test:mutation` runs Stryker against `src/` with `pnpm quick:test`. It edits the source files
in place while it runs and restores them afterwards, so run it on a clean checkout. The `mutation`
workflow runs it weekly and on demand and uploads the report; the score never fails a build.

Changes to the control store or its migrations should pass on both SQLite and PostgreSQL. The
`checks` workflow runs both on every pull request.

## Code layout

The layout follows [SPEC-impersonation.md](SPEC-impersonation.md) section 2.

- `src/` holds the core: state machine, policy, context token, expiry, errors. One responsibility
  per file.
- `auth/` holds the effective guard, `http/` the controllers, middleware and markers, `native/`
  the native session authority.
- `stores/` holds the optional Lucid control store, `providers/` the AdonisJS provider and
  `testing/` the memory store and conformance suite.
- `tests/` mirrors the source: one spec per module. Shared fixtures live in `tests/helpers/`.

[The maintainer source map](docs/maintainers/source-map.md) maps common tasks to their owning
modules, contracts and focused tests. Start there before loading the implementation history.

[AGENTS.md](AGENTS.md#single-responsibility-principle-files) describes the responsibility and file-splitting rules the codebase follows.
[docs/maintainers/conventions.md](docs/maintainers/conventions.md) records where every convention
comes from.

## Pull requests

- Keep each pull request to one change.
- Add or update tests. A bug fix should include a test that fails without the fix.
- Update the relevant page in `docs/` and add a line under `## Unreleased` in
  [CHANGELOG.md](CHANGELOG.md) when behaviour visible to users changes.
- Write commit messages in the imperative mood, describing the change ("Reject a stale stop
  against a newer mode").

## Store adapters

A control store for another database is a good first contribution. The conformance suite in
`adonisjs-masquerade/testing` checks a store against the same behaviour the Lucid store passes,
including compare-and-swap under concurrent connections.

## Code of conduct

Everyone taking part in this project follows the [code of conduct](CODE_OF_CONDUCT.md).
