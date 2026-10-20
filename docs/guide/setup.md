# Install and configure

Masquerade v1 integrates with AdonisJS's native session guard. The signed-in account remains the
actor; on covered business routes, the selected account becomes the effective principal. The
package does not create a target login or credential. See [security](security.md) for the identity
boundary and [custom authorities](custom-authorities.md) for the native authority contract.

## Generate the starter files

Use Node 24 and pnpm. The configure command requires the AdonisJS assembler and Lucid. Install any
missing dependency with the printed command, then rerun configure; the command does not install
packages or run the generated migration:

```sh
pnpm add -D @adonisjs/assembler
pnpm add @adonisjs/lucid
node ace configure adonisjs-masquerade --namespace=my_app --guard=web
```

Choose a stable namespace for this identity domain and the name of the raw session guard. Configure
checks the namespace and guard syntax, that `config/auth.ts` exists, and that the assembler code
transformer and Lucid can be imported. It does not inspect the contents of `config/auth.ts`, check
the selected guard's driver or provider, or prove that the guard is a native session guard. It adds
the package provider, native binding provider, and command loader to `adonisrc.ts`, and creates
starter files and a migration. It does not edit `config/auth.ts`, routes, or the HTTP kernel.

Generated files fail closed. Review the output and replace every placeholder described below before
mounting routes. If a generated destination already exists, configure leaves files unchanged and
reports the conflicts; use `--force` only when you intend to replace those destinations.

## Reuse the session user provider

The raw session guard and `sessionAuthority` must share the same provider object. The generated
`app/services/masquerade_user_provider.ts` exports one provider instance. Import it into the raw
guard factory and use that same export in the generated `config/masquerade.ts`:

```ts
// app/services/web_guard.ts
import { sessionGuard } from '@adonisjs/auth/session'
import { userProvider } from '#services/masquerade_user_provider'

export const webGuard = sessionGuard({
  useRememberMeTokens: true,
  provider: userProvider,
})
```

This is a wiring fragment: keep your existing session options, including your current
`useRememberMeTokens` value, and any custom provider behavior. If your application already has a
provider, export and reuse that exact instance instead of creating a second provider. The
`userProvider` imported by `sessionAuthority` below must be the same object used by `webGuard`.

Add an effective wrapper beside the raw guard in your existing `config/auth.ts`:

```ts
import { defineConfig } from '@adonisjs/auth'
import { effectiveSessionGuard } from 'adonisjs-masquerade/auth'
import { webGuard } from '#services/web_guard'

// Keep your existing default choice, guards, imports, and type declarations.
// Add web_effective and choose it as the default for business routes.
const authConfig = defineConfig({
  default: 'web_effective',
  guards: {
    // Keep every existing guard and its options.
    web: webGuard,
    web_effective: effectiveSessionGuard(webGuard),
  },
})

export default authConfig
```

The example shows only the changed portion of an existing auth config. Preserve its other guards,
provider declarations, remember-me settings, session options, and module augmentation for
`Authenticators` and auth events. Keep the raw guard for login, signup, logout, and package control
routes; use the effective guard for ordinary business routes. Do not combine raw and effective
guards on one business route.

## Configure persistent identity and policy

The generated `config/masquerade.ts` imports `userProvider` from
`#services/masquerade_user_provider`, the same module used by `web_guard.ts` above. Keep that import
and provider unchanged; do not create a second `sessionUserProvider`. Adapt the callbacks to
persistent fields owned by your User model. This example assumes the host model has a
non-reused numeric `id`, an immutable `accountIncarnation` string, a boolean `active`, a boolean
`masqueradeOperator`, and a persisted string `securityEpoch` that the host advances when
account-wide revocation is required:

```ts
// Relevant part of config/masquerade.ts
import type User from '#models/user'
import { userProvider } from '#services/masquerade_user_provider'
import { sessionAuthority } from 'adonisjs-masquerade/native'

const nativeAdapter = sessionAuthority<User>({
  namespace: 'my_app',
  guard: 'web',
  provider: userProvider,
  incarnation: (user) => user.accountIncarnation,
  securityStamp: (user) => user.securityEpoch,
  isActive: (user) => user.active,
})

export default defineConfig<User, HttpContext>({
  authority: nativeAdapter.authority,
  policy: {
    canMasquerade: ({ actor, target }) =>
      actor.user.masqueradeOperator && target.user.active && actor.id !== target.id,
    // Add canUseRequest only when the application needs a request-local rule.
  },
  // Keep the generated store, contextEnforcement, and retention settings,
  // or change them deliberately for this host.
})
```

This is a configuration fragment; retain the generated imports and other options such as `store`,
`contextEnforcement`, and `retention`. Replace the sample model fields and policy with your own. If
you choose a store other than the generated Lucid store, see [custom stores](custom-stores.md).
`incarnation` must be stable for one account's lifetime and different if a deleted ID can be
reused. Use `incarnation: 'id'` only if the host guarantees account IDs are never reused. The
incarnation must not change during ordinary security updates.

`securityStamp` is a persisted security epoch, not a constant, timestamp, or partial security
fingerprint. Advance it transactionally whenever the host wants all active modes for that account
revoked: typically after password changes or resets, privilege changes, suspension or reactivation,
and account-wide logout/revocation. Make the epoch visible to the provider's current user lookup.
Ordinary logout of one session remains the host session credential flow; advance the epoch as part
of logout-all when that action should also revoke every active mode. The host owns which events
advance it. `isActive` must return the current account eligibility as a boolean; a deleted or
ineligible account must not be treated as active.

`canMasquerade` is required and must explicitly authorize the actor-target pair. It runs when a mode
starts with `reason` and `request` available, and again on each active admission without either
value. A `false` result at start denies the start. A `false` result during active admission is a
global denial: Masquerade invalidates the mode and rejects that request with context-changed (409).
A thrown callback fails the request with unavailable (503) and leaves the mode unchanged.

`canUseRequest` is optional. Add it only for request-local rules such as tenant or route access. It
runs on each request admission with the request; `false` rejects only that request (403) and leaves
the mode unchanged, so access may still work on another eligible route. A throw returns unavailable
(503) and leaves the mode unchanged. If no request-local rule is needed, remove the generated
`canUseRequest` property entirely; its generated `false` placeholder denies every request.

## Wire auth middleware and routes

Add the generated context middleware to `router.use` after Auth initialization and before
`silent_auth` or any later middleware that calls `auth.check()`. Preserve all other host middleware
and their order:

```ts
// start/kernel.ts: router middleware excerpt
router.use([
  // Existing body parser, session, Shield, and other middleware.
  () => import('@adonisjs/auth/initialize_auth_middleware'),
  () => import('#middleware/masquerade_context_middleware'),
  () => import('#middleware/silent_auth_middleware'),
])
```

Keep the supported named `auth` middleware on route groups. Package control routes authenticate
with the raw guard so an active effective identity cannot replace the actor used to stop a mode:

```ts
// Route-group fragment; keep your existing router, controller, and kernel imports.
router
  .group(() => {
    router.get('/', [MasqueradeController, 'status'])
    router.post('/start', [MasqueradeController, 'start'])
    router.post('/stop', [MasqueradeController, 'stop'])
  })
  .prefix('/masquerade')
  .use(middleware.auth({ guards: ['web'] }))
```

Apply your host's CSRF protection and separate start and stop rate limits. Put business route
groups behind `middleware.auth({ guards: ['web_effective'] })`. See [route coverage review](route-report.md)
for report labels and release checks. The package's controls, routes, CSRF, and rate limits remain
host-wired.

Review the generated migration and your database backup plan, then apply it with the host's normal
migration process, for example `node ace migration:run`. Follow [pruning and retention
operations](operations.md) for scheduling and retention; this setup guide does not duplicate that
operational recipe.

After wiring is complete, run the application checks and test with separate actor sessions. Begin
with `contextEnforcement: 'report'` while covered forms and clients are being updated to send the
current context token; switch to `'enforce'` after that migration is complete. See [security](security.md)
for token handling and the actor/effective identity boundary.
