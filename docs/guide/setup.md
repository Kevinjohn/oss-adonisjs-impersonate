# Install and configure

Masquerade v1 supports the AdonisJS native session guard. It keeps the authenticated operator as
the actor and resolves the target as the effective principal on covered business routes. It does
not create a target session or token. Access-token support is planned for v1.1; the Account Kit
adapter is v1.2.

## Generate the starter files

Use Node 24 and pnpm. Configure requires both the AdonisJS assembler and Lucid. Install a missing
dependency with the printed command, then rerun configure; it does not install packages for you.
Configure creates the Lucid migration but does not run it. Review the generated files before
editing the application:

```sh
pnpm add -D @adonisjs/assembler
pnpm add @adonisjs/lucid
```

```sh
node ace configure adonisjs-masquerade --namespace=my_app --guard=web
```

The command adds the native binding provider, package provider, and command loader to
`adonisrc.ts` automatically. It does not edit `config/auth.ts`, the HTTP kernel, or routes. It
preflights the conventional auth config, assembler/code transformer, and Lucid before writing
files; if one is unavailable, it prints the required install/setup command and stops. It also
prints the remaining manual wiring steps. The generated callbacks fail closed: choose an immutable incarnation policy, a
security stamp that changes on account-wide revocation, and account-eligibility checks before
enabling the package. The default context mode is `report`; move
to `enforce` after every covered form/client sends a current context token.

If any generated destination already exists, the command leaves all files unchanged and reports
the conflicting paths. Use `--force` only when you intend to replace those generated destinations.
The command does not install packages, run migrations, mount routes, change middleware order, or
invent a user model's security fields.

## Connect the same session user provider

The raw session guard and `sessionAuthority` must use the same provider object. For a conventional
User model, the generated `app/services/masquerade_user_provider.ts` exports that object. Keep the
raw guard factory in `app/services/web_guard.ts` so the application can share it with the effective
guard:

```ts
// app/services/web_guard.ts
import { sessionGuard } from '@adonisjs/auth/session'
import { userProvider } from '#services/masquerade_user_provider'

export const webGuard = sessionGuard({
  useRememberMeTokens: false,
  provider: userProvider,
})
```

Preserve your application's current `useRememberMeTokens` setting and other guard options. If it
already has a custom provider, export and reuse that same provider instance instead. Then wrap the
raw guard in `config/auth.ts` and make the effective guard the business default:

```ts
import { defineConfig } from '@adonisjs/auth'
import { effectiveSessionGuard } from 'adonisjs-masquerade/auth'
import { webGuard } from '#services/web_guard'

export default defineConfig({
  default: 'web_effective',
  guards: {
    web: webGuard,
    web_effective: effectiveSessionGuard(webGuard),
  },
})
```

In `config/masquerade.ts`, set raw guard name `web`; the generated `sessionAuthority` uses the
same `userProvider`. For a custom model, update the generated type import and provider model
loader to your application's paths. Set `incarnation: 'id'` only when the application guarantees
IDs will never be reused. Otherwise return a persisted immutable account incarnation. The security stamp must
change when password, privilege, suspension, or logout-all should invalidate every device's mode;
do not use a constant or current timestamp.

`canMasquerade` is required and must explicitly allow the actor-target pair. It is checked at start
and during active admission. Optional `canUseRequest` applies tenant/route-local access; a local
deny rejects that request without clearing a mode that is valid elsewhere. Global actor or target
ineligibility clears the mode. A thrown callback fails closed. Replace generated deny/throw
placeholders with application-owned checks before enabling routes.

## Wire authentication and middleware

Configure the effective guard as the default for ordinary business surfaces, and keep the raw
session guard for login, signup, logout, and package controls. Install `masqueradeContext` after
`initialize_auth` and before any `silent_auth` middleware. The configure command creates
`app/middleware/masquerade_context_middleware.ts`; add its lazy import to the router middleware in
`start/kernel.ts`, preserving the host's other middleware:

```ts
// start/kernel.ts
import router from '@adonisjs/core/services/router'

router.use([
  // body parser, session, Shield, and other existing middleware
  () => import('@adonisjs/auth/initialize_auth_middleware'),
  () => import('#middleware/masquerade_context_middleware'),
  () => import('#middleware/silent_auth_middleware'),
])
```

Keep the context middleware before `silent_auth` or any later middleware that calls `auth.check()`.
Configure registers the native binding provider, package provider, and command loader in
`adonisrc.ts` automatically. Apply its printed manual steps for host-specific auth and middleware
wiring.

The effective facade must satisfy all of these on business routes: `auth.user` and
`auth.getUserOrFail()` are the effective user; `auth.authenticatedViaGuard` identifies the
effective guard; and `auth.use('web').user` remains the actor. Do not mix raw or token guards into
an effective route. The middleware rejects mixed effective/raw/token coverage with 503 before
admission because either guard ordering could bypass enforcement.

## Mount routes behind host protections

Routes remain unmounted until the host chooses their prefix and protection. This example mounts
the package controller behind the raw session guard; keep Shield CSRF enabled globally and add
your host limiter middleware with separate start and stop budgets:

```ts
import { MasqueradeController } from 'adonisjs-masquerade/http'
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

router
  .group(() => {
    router.get('/', [MasqueradeController, 'status'])
    router.post('/start', [MasqueradeController, 'start']) // apply start limiter
    router.post('/stop', [MasqueradeController, 'stop']) // apply stop limiter
  })
  .prefix('/masquerade')
  .use(middleware.auth({ guards: ['web'] }))
```

Status is read-only; the two POST routes are state-changing. Separate budgets preserve stop as a
recovery action if start attempts are exhausted. Keep business routes behind the effective guard
and review the output of:

```sh
node ace masquerade:routes
```

This report groups routes by matched auth guard and marker and flags raw-guard business routes.
Review it as a release gate; it is not a boot-time registry. The package cannot infer arbitrary
middleware semantics, so keep control routes on the raw guard and business routes on the effective
guard. A route report does not replace application review.

Apply the migration after reviewing it and your database backup plan:

```sh
node ace migration:run
```

Then run the host's checks and exercise the real application with two independent session cookies.
