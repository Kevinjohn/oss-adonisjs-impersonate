# Local alpha baseline verification

This record captures the local self-test candidate for issue #66. It is not a production release or
evidence from external users.

## Candidate artifact

- Source: clean `origin/main` commit `7117345a94d6679d046b060b659bdb8bad40679b`.
- Package version: `0.0.0`; the manifest was not changed.
- Artifact: ignored local file `tmp/alpha-baselines/alpha-1/native-session-package.tgz`.
- SHA-256: `d251eecf42ef41fcd0b1226fb61b07741757bc3ce0ac7e2a6c6e2320047e867b`.
- Lockfile SHA-256: `cd2c9ef70539dd7b815ba0c0934548ee9edc9d4e5c2a920cc01c80438e1796f7`.
- Toolchain: Node `v24.21.0`, pnpm `11.23.0`.
- No alpha tag or GitHub Release has been created. Tagging remains pending completion of the
  fresh-host browser walkthrough and the owner's final decision.

The packed archive contains the declared runtime exports, JavaScript, declarations, configure
templates and public guides. It excludes tests, maintainer records, private design documents and
local environment files. The packed consumer matrix installed and exercised this exact artifact.

## Verification

| Command                              | Result                                                                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`     | Passed; 860 locked packages reused from the local pnpm store.                                                                                                                        |
| `pnpm build`                         | Passed; its `precompile` hook ran ESLint.                                                                                                                                            |
| `pnpm typecheck`                     | Passed.                                                                                                                                                                              |
| `pnpm quick:test`                    | Passed: 181 tests, 1 skip. The built-package Ace configure case is covered by the built-export command.                                                                              |
| `pnpm test:built-exports`            | Passed: 7 tests, including all declared exports and Ace configure from build output.                                                                                                 |
| `DB_PORT=55466 pnpm test:pg`         | Passed: 177 tests, 1 skip; isolated PostgreSQL 16 server stopped after the run.                                                                                                      |
| `pnpm docs:build`                    | Passed on the exact main commit; the updated setup-guide branch also passed this command.                                                                                            |
| `pnpm test:consumer`                 | Passed all floor/latest × SQLite/PostgreSQL cells against the artifact SHA above.                                                                                                    |
| Edge demo browser walkthrough        | Passed on the source commit and artifact SHA above: operator start, customer read, reversible preference change, sensitive-action denial (403), stale-form rejection (409) and stop. |
| `pnpm test:recipe --database=sqlite` | Passed in a clean checkout of the exact main commit; repacked SHA matched the artifact above.                                                                                        |
| Fresh-host browser walkthrough       | Pending.                                                                                                                                                                             |

The consumer matrix recorded 62 compatible peer checks per cell, no peer warnings, packed
configure/typecheck, the optional-import probe, fixture lint/build, and functional, report and
credential suites. The floor versions were AdonisJS Core `7.0.0`, Auth `10.0.0`, Bouncer `4.0.0`,
Lucid `22.4.2`, Session `8.1.0` and TypeScript `5.9.3`. The latest versions resolved during the
run were Core `7.6.0`, Auth `10.1.0`, Bouncer `4.0.1`, Lucid `22.4.2`, Session `8.3.0` and
TypeScript `6.0.3`.

Consumer command output and `results.json` are preserved beside the tarball under
`tmp/alpha-baselines/alpha-1/consumer-results/` in the local checkout. These ignored artifacts are
not committed or uploaded.

The candidate covers the native session integration only. The tarball is for local self-testing;
there is no registry package, GitHub Release, release asset or production-readiness claim. Do not
create its tag until the fresh-host browser walkthrough passes and the selected commit is on main.
