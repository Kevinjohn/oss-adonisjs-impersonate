# M0 effective guard result

**Status: pass.** The SQLite fixture is based on the official AdonisJS 7 hypermedia starter at
commit `449d77cc25dd08e036f442d2d39b760d43ccfbd3`. On Node 24, fixture `pnpm typecheck`,
`pnpm lint`, and `pnpm test` pass; Japa reports **7 passed (7)**. Run these commands from
`examples/native-session` after `pnpm install --frozen-lockfile`.

## Seven identity proofs

| Item | Evidence |
| --- | --- |
| Facade identity | `auth.user`, `getUserOrFail()` and `authenticatedViaGuard` report actor while idle, target while active, and actor after clear. [Test: effective_guard.spec.ts:10](examples/native-session/tests/functional/effective_guard.spec.ts#L10); [implementation: effective_guard.ts:17](examples/native-session/app/services/effective_guard.ts#L17). |
| Raw actor identity | The raw `web` guard reports the operator while idle, active and after clear. [Test: effective_guard.spec.ts:126](examples/native-session/tests/functional/effective_guard.spec.ts#L126); [route: routes.ts:53](examples/native-session/start/routes.ts#L53). |
| Bouncer | Its lazy resolver observes the exact actor/target/actor IDs across idle, active and clear states. [Test: effective_guard.spec.ts:58](examples/native-session/tests/functional/effective_guard.spec.ts#L58); [route: routes.ts:56](examples/native-session/start/routes.ts#L56). |
| `silent_auth` | A fixture-only snapshot immediately after `ctx.auth.check()` confirms the default effective guard and target are resolved before business-route authentication. [Test: effective_guard.spec.ts:84](examples/native-session/tests/functional/effective_guard.spec.ts#L84); [middleware: silent_auth_middleware.ts:10](examples/native-session/app/middleware/silent_auth_middleware.ts#L10); [registration: kernel.ts:40](examples/native-session/start/kernel.ts#L40). |
| Session error rendering and `driverName` | Unauthenticated HTML redirects to `/login`; JSON returns 401 with JSON content type and the stock unauthorized message. The wrapper copies the raw session guard's `driverName`. [Test: effective_guard.spec.ts:102](examples/native-session/tests/functional/effective_guard.spec.ts#L102); [wrapper: effective_guard.ts:24](examples/native-session/app/services/effective_guard.ts#L24). |
| Japa `loginAs(user)` and default guard | The stock test-client setup authenticates a `web_effective` route; a no-guard `auth.authenticate()` route also resolves `web_effective`. [Test: effective_guard.spec.ts:112](examples/native-session/tests/functional/effective_guard.spec.ts#L112); [default route: routes.ts:78](examples/native-session/start/routes.ts#L78). |
| Isolation | Two simultaneously active operators each resolve only their own target. Shared user teardown clears every created actor's map entry. [Test: effective_guard.spec.ts:149](examples/native-session/tests/functional/effective_guard.spec.ts#L149); [helpers: users.ts:1](examples/native-session/tests/helpers/users.ts#L1). |

## Mutation checks

Each mutation below was temporary, then restored before the final passing run.

- Replacing effective target lookup with no lookup caused **4 of 7 tests to fail**: facade identity,
  Bouncer, `silent_auth` target visibility and operator isolation.
- Changing `driverName` to `api` caused the rendering test to fail: HTML returned 401 instead of
  the expected session redirect.
- Changing the configured default guard to `web` caused the silent-auth and default-guard tests
  to fail; their snapshots reported `web` and the actor.
- Replacing raw `authenticateAsClient` delegation with an error caused **6 of 7 tests to fail**
  through Japa's unchanged `loginAs(user)` setup.
- Omitting `ctx.auth.check()` in `silent_auth` caused its snapshot assertion to fail.
- Resolving Bouncer from the raw actor instead of `auth.user` caused the exact active target ID
  assertion to fail.
- Reporting the effective user in place of the raw actor caused facade/raw-actor and dedicated raw-identity
  assertions to fail in the active state.

## Auth behavior and limits

- The `web_effective` provider wraps the resolved `web` factory. Its actor-authentication path
  calls only `ctx.auth.use('web').authenticate()`; client authentication setup delegates separately
  to the raw guard's `authenticateAsClient`.
- Authenticator authentication records the selected guard as `authenticatedViaGuard` and exposes
  that guard's `user` through `auth.user` and `auth.getUserOrFail()`. The fixture observes that
  `ctx.auth.check()` resolves the configured default guard and that the stock Japa auth plugin
  uses `authenticateAsClient` for `loginAs(user)`.
- `auth.use()` caches each guard without changing the facade's selected guard. The last facade
  authentication attempt selects its user, so authenticating the raw guard directly inside the
  wrapper preserves effective facade ownership. Japa creates a synthetic client context to
  resolve its guard; client setup therefore delegates through the raw factory independently of
  request actor authentication.
- Auth uses the session guard's `driverName` to select missing-auth rendering. This fixture checks
  HTML redirect and standard JSON 401 behavior; it does not claim JSON:API error formatting.
- Bouncer invokes its user resolver when evaluating the ability, so the fixture's resolver sees
  the effective facade identity.
- The copied global `silent_auth` middleware runs on control and public routes as well as the
  protected business route. M0 verifies its identity behavior; business-only middleware scoping
  remains a later concern. Repeated effective-guard resolution is also not evidence for request
  snapshot semantics.
- The stock textarea component was adjusted to HTML-escape its old-value output. No M1 core code
  or root dependency changes were made; the fixture owns its Bouncer and Japa API-client deps.
