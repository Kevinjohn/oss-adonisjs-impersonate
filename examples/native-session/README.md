# Native session demo

This AdonisJS 7 hypermedia fixture is based on the official starter kit at commit
[`449d77c`](https://github.com/adonisjs/starter-kits/commit/449d77cc25dd08e036f442d2d39b760d43ccfbd3).
It consumes the built package tarball through native session authentication, Bouncer, Edge,
controllers, middleware and a real Lucid store on SQLite or PostgreSQL. Its demo accounts and test
credentials are fictional.

## Run the local demo

Prerequisites: Node.js 24 and pnpm. From a clean repository checkout, prepare the package tarball
from this checkout before installing the example, then set up and start the SQLite app:

```sh
nvm use
pnpm install
pnpm build
pnpm pack:fixture

cd examples/native-session
cp .env.example .env
pnpm install --no-frozen-lockfile
node ace generate:key
node ace migration:run
node ace demo:seed
pnpm dev
```

The example installs the package tarball packed from this checkout. Its local integrity entry
changes when the tarball is rebuilt, so this install refreshes that entry while keeping the locked
dependency versions unchanged.

Open <http://localhost:3333>, then sign in with one of these local-only credentials:

| Account      | Email                       | Password                 | Demo capability                                   |
| ------------ | --------------------------- | ------------------------ | ------------------------------------------------- |
| Operator     | `operator@example.test`     | `demo-operator-2026`     | Can start masquerade; cannot mutate customer data |
| Customer one | `customer-one@example.test` | `demo-customer-one-2026` | Active customer; can mutate demo data             |
| Customer two | `customer-two@example.test` | `demo-customer-two-2026` | Active customer; can mutate demo data             |

These reserved accounts are for local demonstration only. Signup creates ordinary non-operator
accounts. `node ace demo:seed` can be run again safely: it refreshes these three addresses and does
not remove other accounts. To remove only these accounts, their remember-me tokens and their
masquerade rows, run `node ace demo:reset`. Both commands require `NODE_ENV` to be `development`
or `test` and the local SQLite database; they refuse production and PostgreSQL. Reset does not
drop tables or wipe unrelated accounts. Stop the server with Ctrl+C.

`node ace generate:key` creates a unique application key in your local `.env`. The fixed keys in
`.env.test` belong only to repeatable tests and are not suitable for an interactive app.

The authenticated dashboard links to `/support`. Sign in as the seeded operator, choose a customer,
enter a reason and start support mode. The workspace keeps the signed-in operator distinct from the
effective customer, shows the fixed deadline and account-wide scope, and offers a stop control.
The customer page reads that customer's email and demo email-update preference. Changing the
preference is reversible and uses the customer's Bouncer permission; the operator's own permission
does not carry over. The sensitive-action example is blocked during support mode. Ordinary signup
accounts can view the support entry but cannot start mode. The functional suite covers the
dashboard response, logout redirect, full support journey and recovery paths.

Forms include Shield CSRF and the context token captured when they were rendered. If another tab
or session changes mode, an old form returns a context-changed page; return to `/support` and
build a fresh action from the current page. A 503 after a control attempt may mean the outcome is
unknown: check `/support` status before acting again. The raw operator workspace remains available
if customer admission fails, so a valid operator can still inspect and stop mode. JSON clients
continue to use the canonical `/masquerade` status/start/stop API and its normal error responses.

Production-mode browser captures show the
[previous render failure](../../docs/assets/review/dashboard_render_before.png) and the
[working dashboard](../../docs/assets/review/dashboard_render_after.png), using fictional data.
Both production error templates also render through the registered marketing layout; a functional
regression test rejects unprocessed layout tags in their HTML. Error layouts also support requests
that have not run the router auth/session middleware: unknown URLs retain HTTP 404 and render the
normal not-found page. The functional suite exercises this real HTTP path with production status
rendering enabled, alongside direct rendering of both error templates without auth/session data.

Flash alerts reveal after 80 ms and dismiss after five seconds by default. Set `autoDismiss: false`
on `@alert.root` to keep an alert visible until its dismiss action is called.

## Validate the packed consumer

After building and packing the package from the repository root as shown above, the consumer
harness installs that tarball into isolated applications outside the checkout. It runs the declared
peer floors and newest compatible versions against SQLite and PostgreSQL 16, and reports the
package SHA-256, resolved dependencies and suite counts. It stops only a PostgreSQL server it
started. To use an already managed server, set `CONSUMER_PG_EXTERNAL=1` and `DB_HOST`, `DB_PORT`,
`DB_USER`, `DB_PASSWORD` and `DB_DATABASE`.

Useful runs from the repository root:

```sh
pnpm test:consumer
```

Each profile validates the packed root exports and optional-import boundary in a fresh process,
executes the native configure command in a host copy, typechecks all generated files against the
real conventional User model, then runs fixture lint/build and database-specific typechecks and
HTTP suites. Installed package peer manifests are checked independently of overrides. The floor
profile pins `@adonisjs/vite` to 6.0.1 because 6.0.2 requires Core 7.5; package peer floors remain
unchanged.

To run the app tests after installing the example dependencies as shown above:

```sh
cd examples/native-session
pnpm lint
pnpm typecheck
SESSION_DRIVER=memory pnpm test functional
SESSION_DRIVER=memory pnpm test:report
pnpm test:credentials
```

Useful focused consumer runs from the repository root:

```sh
pnpm test:consumer --profile=floor --database=sqlite
pnpm test:consumer --profile=latest --database=pg
pnpm test:consumer --package=tmp/native-session-package.tgz
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
`start/masquerade_control_routes.ts`, `start/demo_routes.ts` and `start/routes.ts`: Lucid storage,
native auth routes, raw-guard start/status/stop controls and the browser adapter. HTML start/stop
forms use the same service and actor-keyed limiter definitions as the canonical JSON routes. The
form and deliberate identity, alternate-guard,
mutation and concurrency probes live in `start/test_routes.ts` and `start/member_routes.ts`;
AdonisJS preloads them only when `NODE_ENV=test`, where the original test URLs remain available.
Set `NODE_ENV=test` when running `node ace masquerade:routes` to include those routes in the
coverage report. `app/services/masquerade_test_boundary.ts` and
`app/services/fixture_control_store.ts` hold test-only failure injection and diagnostics. The
admitted-stop-form endpoint is a concurrency probe and is not registered for an interactive app.

The start and stop controls each use a separate `@adonisjs/limiter` budget keyed by the raw actor.
Both allow 10 requests per minute by default; `MASQUERADE_START_REQUESTS` and
`MASQUERADE_STOP_REQUESTS` override those counts. The fixture uses AdonisJS's process-local
memory store, so counters reset on restart and are not shared between app processes. Use a shared
store for a multi-process deployment. Tests select the memory store, lower the start budget to two,
and clear limiter state between cases. Authentication and Shield CSRF middleware still run before
the route limiters. See the [official rate-limiting guide](https://docs.adonisjs.com/guides/security/rate-limiting)
for supported stores and middleware behavior.
