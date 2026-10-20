# Repository conventions

Masquerade follows open-source AdonisJS conventions. The host application owns language, UI,
roles, permissions, tenant rules, route sensitivity, limiter policy and audit retention. The accepted
[development plan](../../DEVELOPMENT-PLAN.md) controls v1 scope; this repository does not target
AdonisJS Plus compatibility.

## Architecture and boundaries

- Core depends on explicit ports: `ControlStore`, `NativeAuthority` and `MasqueradePolicy`.
- Framework and database integrations use narrow subpaths. Root import does not resolve Lucid or
  Account Kit. Lucid supports SQLite and PostgreSQL; Account Kit integration is deferred to v1.2.
- The raw native session guard authenticates the actor. The effective guard is used on business
  routes. The package never issues target credentials or unions permissions.
- Routes stay host-mounted. The host wires `masqueradeContext` after auth initialization and before
  `silent_auth`, mounts controls behind Shield and separate start/stop limiter budgets, and reviews
  `masquerade:routes` as a release gate.
- Billing and other sensitive routes must use `sensitive()`. URL or route-name heuristics are not
  allowed. A sensitive marker overrides `allowMutation()`.
- Files have one responsibility and names describe it. Tests follow source modules; shared fixtures
  live in `tests/helpers/`.
- Use the [source map](source-map.md) to locate the owner and focused tests for a change. Separate
  independent reasons to change when that reduces unrelated reading context; file length and a
  second caller are not prerequisites. Preserve ordered orchestration and atomic transitions.

## Toolchain and checks

Use Node 24 and pnpm. Run repository scripts rather than bare tools. The standard checks are
`pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm quick:test`, `pnpm test:built-exports`, and
`pnpm test:pg`. The packed native-session fixture has its own lint, typecheck, test and report-mode
commands. `pnpm test:consumer` records floor/latest dependency versions
from actual package resolution and exercise SQLite/PostgreSQL consumers.

Use the bundled scripts to preserve flags and runtime setup. Do not add Docker support or use npm,
npx, yarn, or yarn dlx. `better-sqlite3` requires the pinned Node 24 runtime.

## External PostgreSQL

Use Node 24 (`nvm use`) and a disposable PostgreSQL 16 database when the managed local
binaries are unavailable. Provide all connection settings explicitly; the tests create and
remove their own tables, so never point them at a production or shared application database.

```sh
DB_CLIENT=pg DB_HOST=127.0.0.1 DB_PORT=5432 DB_USER=masquerade_test \
  DB_PASSWORD=local_test_password DB_DATABASE=masquerade_test pnpm quick:test
```

Replace these local example credentials with those of your disposable test database. This runs
the same suite directly against your server; it does not start or stop that server.

## Verification and release evidence

- A test counts as evidence only when it names and asserts the required behavior. Cite the exact
  test file and case, not only a T-family label.
- `tests/docs_links.spec.ts` checks relative paths and anchors. It does not prove the user guide
  content is complete; the M4 ledger maps each docs obligation to a page section.
- Keep the [requirement ledger](requirement-ledger.md) current for every retained FR, NFR and AC.
  Separate implemented, verified and shipped status. A test name is not a pass result; record the
  command/matrix outcome separately.
- M4's packed consumer evidence includes native session at floor/latest on SQLite and PostgreSQL,
  root optional-import isolation, canonical numeric/string/UUID identifiers and an alternate users
  table.
- The release workflow runs the packed native-session consumer matrix at floor/latest on SQLite and
  PostgreSQL before publishing. Private-repository push and pull-request checks remain gated, while
  manual and release-triggered checks run.
- Do not publish, tag, merge, or rename as part of a release-candidate implementation task unless
  separately authorized by the owner.

## Public contribution privacy

Use neutral task-focused public content. Do not include private planning metadata, assistant or
provider attribution, tool traces, credentials, or the forbidden standalone word in any GitHub-visible
text. Review complete outgoing content before publication. No publication is part of the current
release-candidate scope.
