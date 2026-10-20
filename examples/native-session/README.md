# Native session integration fixture

This AdonisJS 7 hypermedia fixture is based on the official starter kit at commit
[`449d77c`](https://github.com/adonisjs/starter-kits/commit/449d77cc25dd08e036f442d2d39b760d43ccfbd3).
It consumes the built package tarball through native session authentication, Bouncer, Edge,
controllers, middleware and a real Lucid store on SQLite or PostgreSQL. Accounts and application
keys are fictional test data.

The authenticated dashboard renders its native logout form. The functional suite covers the
dashboard response and logout redirect. Production-mode browser captures show the
[previous render failure](../../docs/assets/review/dashboard_render_before.png) and the
[working dashboard](../../docs/assets/review/dashboard_render_after.png), using fictional data.
Both production error templates also render through the registered marketing layout; a functional
regression test rejects unprocessed layout tags in their HTML. Error layouts also support requests
that have not run the router auth/session middleware: unknown URLs retain HTTP 404 and render the
normal not-found page. The functional suite exercises this real HTTP path with production status
rendering enabled, alongside direct rendering of both error templates without auth/session data.

Flash alerts reveal after 80 ms and dismiss after five seconds by default. Set `autoDismiss: false`
on `@alert.root` to keep an alert visible until its dismiss action is called.

Use Node 24 and pnpm. From the repository root:

```sh
pnpm build
pnpm pack:fixture
pnpm test:consumer
```

The consumer harness installs the actual tarball into isolated applications outside the checkout.
It runs the declared peer floors and the newest registry versions compatible with those peer
ranges, each against SQLite and PostgreSQL 16. It prints the results JSON path, containing the
package SHA-256, resolved dependencies/tooling, peer checks and suite counts. PostgreSQL uses the
repository's local server scripts; only a server started by the harness is stopped by it. To use
an already managed external server, set `CONSUMER_PG_EXTERNAL=1` and the `DB_HOST`, `DB_PORT`,
`DB_USER`, `DB_PASSWORD` and `DB_DATABASE` variables.

Useful focused runs:

```sh
pnpm test:consumer --profile=floor --database=sqlite
pnpm test:consumer --profile=latest --database=pg
pnpm test:consumer --package=tmp/native-session-package.tgz
```

Each profile validates the packed root exports and optional-import boundary in a fresh process,
executes the native configure command in a host copy, typechecks all generated files against the
real conventional User model, then runs fixture lint/build and database-specific typechecks and
HTTP suites. Installed package peer manifests are checked independently of overrides. The floor
profile pins `@adonisjs/vite` to 6.0.1 because 6.0.2 requires Core 7.5; package peer floors remain
unchanged.

To run the working fixture directly after packing:

```sh
cd examples/native-session
cp .env.example .env
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
SESSION_DRIVER=memory pnpm test functional
SESSION_DRIVER=memory pnpm test:report
pnpm test:credentials
```

The functional suite contains the four original identity proofs, ten context/action cases and
two alternate-identifier cases. The original numeric User integration exercises the complete
provider/effective-guard facade, raw actor, lazy Bouncer, global silent authentication and real
HTTP controls. `Member` uses `support_accounts.account_key` with application-assigned string and
UUID identifiers and no `id` property. Its separate host routes prove native provider canonical
IDs through start/status/resolve/stop and SQL persistence; they do not configure a second global
effective facade.

Functional/report tests use native memory-backed session storage, matching the Japa session
plugin at the supported floor; the real HTTP cookie-jar cases still prove session transport,
credential isolation and logout. The separate credential suite uses the native cookie store,
remember-me tokens and an actual one-second cookie age. It compares raw and effective routes
before expiry and after remember-me recovery, checks an expired session without remember-me is
rejected, and verifies starting a mode neither rotates the actor session nor creates a target
remember token. The short age is enabled only by `NATIVE_CREDENTIALS_SESSION=true` through
`test:credentials`.

For PostgreSQL direct runs, set `DB_CLIENT=pg` plus the connection variables above. `DB_SCHEMA`
optionally isolates fixture tables. SQLite remains the normal local default.

Route-report warnings for intentionally raw, alternate-guard and mixed-guard routes belong to the
test-only suites; they are adversarial cases, not recommended host wiring. Report mode runs in a
separate process so it cannot weaken the enforce-mode cases.

The example keeps ordinary host wiring in `config/masquerade.ts`,
`start/masquerade_control_routes.ts` and `start/routes.ts`: Lucid storage, native auth routes,
and the raw-guard start/status/stop controls. The form and deliberate identity, alternate-guard,
mutation and concurrency probes live in `start/test_routes.ts` and `start/member_routes.ts`;
AdonisJS preloads them only when `NODE_ENV=test`, where the original test URLs remain available.
Set `NODE_ENV=test` when running `node ace masquerade:routes` to include those routes in the
coverage report. `app/services/masquerade_test_boundary.ts` and
`app/services/fixture_control_store.ts` hold test-only failure injection and diagnostics. The
admitted-stop-form endpoint is a concurrency probe and is not registered for an interactive app.
