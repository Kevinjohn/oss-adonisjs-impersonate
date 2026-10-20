# Repository conventions

Masquerade is built the same way as its sibling,
[Account Kit](https://github.com/Kevinjohn/oss-adonisjs-account-kit). This page records every
convention taken from it, which file carries it here, and the reason behind it. Where the two
repositories must differ, the difference is named. Account Kit references are to its commit
`286b342`.

## Principles

| Principle                                                                                                                | Where it lives                                 | Why                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Built for everyone who uses AdonisJS: follow the open-source packages and starter kits; Plus compatibility is not a goal | `CONTRIBUTING.md`, `AGENTS.md`                 | The package is for open-source users; consistency with their stack beats matching a paid product.                                                                     |
| The application owns its language: stable error codes, English messages, host localises                                  | `CONTRIBUTING.md`, `AGENTS.md`, SPEC section 8 | Same rule as the official AdonisJS packages. v1 goes one step further than Account Kit and does no `@adonisjs/i18n` lookup at all; that was cut by the design review. |
| The actor stays authenticated; no target credential; no permission union                                                 | `CONTRIBUTING.md`, SPEC section 3              | Masquerade-specific. Account Kit's equivalent is "route every account write through the kit".                                                                         |
| Design documents are the contract                                                                                        | `AGENTS.md`, `DEVELOPMENT-PLAN.md`             | The v1 scope was settled by a four-reviewer consensus; agents and contributors must not reopen it in code.                                                            |

## SOLID, applied to files

Account Kit's `AGENTS.md` states the file-level Single Responsibility rule, copied unchanged into
this repository's `AGENTS.md`. The other four principles are applied the same way in both repositories:

- **Open/closed:** behaviour is extended through ports, never by editing the core. Here the ports
  are `ControlStore`, `NativeAuthority` and `MasqueradePolicy` (SPEC sections 4 and 6.3).
  Account Kit's equivalent is `UsersAdapter`.
- **Liskov:** every implementation of a port must pass the exported conformance suite. Here
  `adonisjs-masquerade/testing` holds the `ControlStore` suite; Account Kit exports
  `testing/adapter_contract`. A custom implementation that passes the suite is supported; one that
  does not is not.
- **Interface segregation:** subpath exports keep optional integrations out of the root. Importing
  the root must not resolve Lucid or Account Kit; `T-PACKAGE` proves it, as Account Kit's
  `package_exports.spec.ts` does there.
- **Dependency inversion:** the core depends on port types only. Lucid, Auth and Session are
  reached through `stores/`, `auth/` and `native/`, and are optional peers.

## Toolchain

Every file in this table is a verbatim copy of Account Kit's unless the note says otherwise.

| File                                    | Purpose                                                                                                          | Note                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `.nvmrc`, `engines.node`                | Node 24                                                                                                          | `better-sqlite3` is compiled against it.                                         |
| `packageManager`, `pnpm-workspace.yaml` | pnpm 11.23.0; `allowBuilds` for `better-sqlite3`, `esbuild`, `@swc/core`                                         | pnpm refuses postinstall scripts unless listed.                                  |
| `.editorconfig`, `.gitattributes`       | Two-space indent, LF, UTF-8, final newline; LF normalisation                                                     |                                                                                  |
| `eslint.config.js`                      | `@adonisjs/eslint-config` `configPkg`, ignoring `stubs/**` and `examples/**`                                     | Account Kit also ignores a demo overlay directory this repository does not have. |
| `prettier` field, `.prettierignore`     | `@adonisjs/prettier-config`                                                                                      |                                                                                  |
| `tsconfig.json`                         | Extends `@adonisjs/tsconfig/tsconfig.package.json`, `rootDir` `./`, `outDir` `./build`                           |                                                                                  |
| `tsdown` field                          | ESM build, one entry per public export, `dts: false`, declarations from `tsc`                                    | Entry list follows SPEC section 2.                                               |
| `typedoc.json`                          | Markdown API docs into `docs/api`, warnings are errors                                                           | Entry points follow SPEC section 2.                                              |
| `docs/.vitepress/`                      | VitePress site at `/oss-adonisjs-impersonate/`, `maintainers/**` excluded, out-of-site links rewritten to GitHub | Title, base and repository URL changed.                                          |
| `.devcontainer/devcontainer.json`       | Node 24 image, installs pnpm and dependencies                                                                    | Name changed.                                                                    |

## Scripts

Run the repository script, never the bare tool: the script carries the flags the release gate
uses.

| Script                                   | Same as Account Kit | Note                                                                                                         |
| ---------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `lint`, `typecheck`, `format`            | yes                 |                                                                                                              |
| `quick:test`                             | yes                 | Japa through `@poppinss/ts-exec`, `bin/test.ts` unchanged.                                                   |
| `test`                                   | yes                 | `c8` coverage around `quick:test`; `pretest` runs lint.                                                      |
| `test:built-exports`                     | yes                 | Loads every export from `build/` through the package name.                                                   |
| `build`, `compile`, `copy:templates`     | yes                 | `precompile` runs lint; `postcompile` copies `stubs/**/*.stub`.                                              |
| `test:pg`, `pg:start`, `pg:stop`         | yes                 | `bin/pg.sh` unchanged: throwaway PostgreSQL 16 cluster under `tmp/`.                                         |
| `docs:api`, `docs:dev`, `docs:build`     | yes                 |                                                                                                              |
| `release`, `version`, `prepublishOnly`   | yes                 | `release-it` with the Angular conventional-changelog preset, npm provenance.                                 |
| `test:consumer`                          | not yet             | Account Kit packs the candidate into fresh consumers. Added in milestone M4 with `examples/native-session/`. |
| `test:pg-service`, `test:mysql`, `demos` | no                  | Account Kit specific. MySQL is not a v1 target here.                                                         |

## Tests

- Japa with `@japa/assert`; `tests/**/*.spec.ts`; one spec per module; fixtures in
  `tests/helpers/`.
- `tests/docs_links.spec.ts` and `tests/helpers/tracked_markdown.ts` are copied unchanged: every
  relative Markdown link and anchor in tracked files must resolve.
- `tests/package_exports.spec.ts` runs only under `TEST_BUILT_EXPORTS=1` and imports the built
  package by name, as Account Kit's does.
- Every test family in SPEC section 11.1 maps to one or more spec files; M4 produces the
  requirement-to-test ledger, mirroring Account Kit's `docs/maintainers/release-assessment.md`.
- A fix is finished when a command fails without it. Mutation-check new tests before claiming
  coverage.

## Continuous integration

| Workflow                      | Same as Account Kit | Note                                                                                                                                                                                          |
| ----------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checks.yml`                  | yes                 | Matrix of `pg` and `better-sqlite3`; lint, typecheck, test, build, built-exports. Database name changed to `masquerade_test`. Push and pull-request runs start once the repository is public. |
| `release.yml`                 | yes                 | Manual; runs `checks` then `release-it --ci` with `NPM_TOKEN`.                                                                                                                                |
| `docs.yml`                    | yes                 | Builds and deploys the VitePress site to GitHub Pages on `main`.                                                                                                                              |
| `codeql.yml`, `scorecard.yml` | yes                 | Weekly, once public.                                                                                                                                                                          |
| `dependabot.yml`              | policy identical    | Patch always, minor only for AdonisJS-owned packages, major never. The ignore list is trimmed to this repository's dependencies; add new third-party packages to it.                          |

## Repository files

| File                                                  | Same as Account Kit                                 | Note                                                                                                                                                                                                          |
| ----------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONTRIBUTING.md`                                     | structure identical                                 | Principles, setup, checks, layout, pull requests, adapters, code of conduct. Translation section dropped: v1 ships no i18n lookup.                                                                            |
| `AGENTS.md`, `CLAUDE.md`                              | identical apart from the design-documents principle | `CLAUDE.md` is `@AGENTS.md`.                                                                                                                                                                                  |
| `SECURITY.md`                                         | identical apart from the security-model link        | Private reporting address, provenance check.                                                                                                                                                                  |
| `CODE_OF_CONDUCT.md`, `LICENSE.md`                    | identical                                           | Contributor Covenant 2.1; MIT.                                                                                                                                                                                |
| `CHANGELOG.md`                                        | identical format                                    | Keep an `## Unreleased` section; `release-it` cuts versions from it.                                                                                                                                          |
| `.github/pull_request_template.md`, `ISSUE_TEMPLATE/` | adapted                                             | Checklist and bug-report fields name this package's stores and peers.                                                                                                                                         |
| `.gitignore`                                          | identical                                           | `PLAN*.md`, `docs/PRD*.md` and `docs/reviews/` are private by convention. This repository commits its PRD, SPEC and plan at the root on purpose, and `files` in `package.json` keeps them out of the archive. |
| `README-AGENTS.md`                                    | not yet                                             | Account Kit's agent-facing integration notes. Written in M4 once there is an API to describe.                                                                                                                 |

## Layout

Account Kit keeps `src/` for operations and `adapters/`, `http/`, `providers/`, `commands/`,
`stubs/`, `testing/` beside it. This repository uses the same shape with the names from SPEC
section 2: `src/` core, `auth/`, `http/`, `native/`, `stores/`, `providers/`, `testing/`,
`stubs/`, `commands/` (from M2), `examples/native-session/` (from M0, kept as the consumer
fixture) and `docs/`.

## Working rules carried over

- Commit messages in the imperative mood, one change per pull request, tests with every behaviour
  change, a changelog line for anything a user can see.
- No private planning metadata, AI attribution or credentials in source, docs, commits or
  screenshots.
- Re-read repository state before any claim about it; other sessions and CI change it.
- Keep the public surface small; a feature request goes through an issue before code.
