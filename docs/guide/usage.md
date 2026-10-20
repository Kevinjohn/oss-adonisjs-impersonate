# Use a support mode

This guide follows one browser session from a raw operator session to a customer-specific business
page and back. It uses the native-session integration: the operator remains authenticated by the
`web` guard while the `web_effective` guard resolves the customer as the effective account. The
customer never signs in, and the operator's permissions are never added to the customer's.

Install and configure the provider, raw and effective guards, policy, session, and Shield first as
described in [Install and configure](setup.md). Keep login, logout, and support controls on the raw
actor guard. Keep customer business routes on the effective guard. See the
[API entry-point map](../api-reference.md#supported-package-imports) for the HTTP entry point,
`MasqueradeController`, `masqueradeContext`, and the route markers used below.

## Mount the JSON controls

`MasqueradeController` implements JSON status, start, and stop responses. The package controller
does not render Edge or redirect. Its control responses are `no-store` and vary on `Accept` and
`X-Masquerade-Context`. The native-session example mounts the controls with raw session
authentication and independent host-owned start and stop limiters. Keep Shield's CSRF middleware
enabled for cookie-authenticated POST requests.

<!-- host-recipe:control-routes -->

```ts
import { middleware } from '#start/kernel'
import { startMasqueradeLimiter, stopMasqueradeLimiter } from '#start/masquerade_control_limiter'
import router from '@adonisjs/core/services/router'

router
  .group(() => {
    router
      .get('/', [() => import('#controllers/masquerade_controller'), 'status'])
      .as('masquerade.status')
    router
      .post('/start', [() => import('#controllers/masquerade_controller'), 'start'])
      .as('masquerade.start')
      .use(startMasqueradeLimiter)
    router
      .post('/stop', [() => import('#controllers/masquerade_controller'), 'stop'])
      .as('masquerade.stop')
      .use(stopMasqueradeLimiter)
  })
  .prefix('/masquerade')
  .use(middleware.auth({ guards: ['web'] }))
```

Define separate budgets keyed by the authenticated raw actor. Tune these limits to the host's
support workflow and infrastructure; the package does not install or configure a limiter.

<!-- host-recipe:control-limiters -->

```ts
import limiter from '@adonisjs/limiter/services/main'
import env from '#start/env'
import type User from '#models/user'

const duration = '1 minute'

export const startMasqueradeLimiter = limiter.define('masquerade_start', (ctx) => {
  const actor = ctx.auth.use('web').getUserOrFail() as User
  return limiter
    .allowRequests(env.get('MASQUERADE_START_REQUESTS') ?? 10)
    .every(duration)
    .usingKey(String(actor.id))
})

export const stopMasqueradeLimiter = limiter.define('masquerade_stop', (ctx) => {
  const actor = ctx.auth.use('web').getUserOrFail() as User
  return limiter
    .allowRequests(env.get('MASQUERADE_STOP_REQUESTS') ?? 10)
    .every(duration)
    .usingKey(String(actor.id))
})
```

The actor-owned target chooser is a host query over accounts eligible for support. Do not expose
all account IDs and rely on the submitted ID alone: start policy checks eligibility again. For
example, the checked-in native-session demo filters active seeded customers for operator accounts.
Display a host-owned label (such as a name and email), not an internal identifier as the choice
label.

## Read status and start

Read `GET /masquerade` before rendering a control. An idle response is:

```json
{
  "isMasquerading": false,
  "contextToken": "0.<owner-specific-nonce>"
}
```

Render that context token with the form and Shield's CSRF field. The token is bound to the raw actor
and changes after committed transitions. It prevents stale/replayed context; it is not an
authentication credential and does not replace CSRF.

Submit `POST /masquerade/start` with `targetId`, a required `reason`, optional numeric
`durationSeconds`, and the token captured with this form. Send the token as
`X-Masquerade-Context` or `_masqueradeContext`; if both are sent they must agree. For a
cookie-authenticated request, also send the host's Shield CSRF token. A JSON request body can look
like this:

```json
{
  "targetId": 42,
  "reason": "Investigating a reported invoice display issue",
  "durationSeconds": 900
}
```

The default duration is 900 seconds and the default maximum is 3600 seconds. A host can configure
a shorter maximum. When duration is omitted, the configured default is used. The package does not
extend a deadline on later requests. The reason is trimmed, line endings are normalized, and it
must contain 1–500 Unicode code points and no more than 2,000 UTF-8 bytes. Invalid input is
rejected, never truncated. Keep secrets and unnecessary personal information out of the reason.

A successful start returns an active `ModeView` with a fresh token:

```json
{
  "isMasquerading": true,
  "contextToken": "1.<new-owner-specific-nonce>",
  "targetId": 42,
  "startedAt": "2026-10-20T10:15:00.000Z",
  "expiresAt": "2026-10-20T10:30:00.000Z"
}
```

Only these fields are returned: the state, token, target ID, start time, and fixed deadline. The
view does not contain the reason, actor or target model, stamps, or raw revision. Treat the token
as a hidden concurrency value, not something to display. A persisted active row is usable only
while `expiresAt` is strictly later than the current time. Status is read-only; an expired row can
still appear active until business admission or cleanup handles it. See
[Security and operations](security.md#expiry-and-status) for that boundary.

## Use the effective customer identity

Attach the route markers from the public HTTP entry point and the effective guard to business
routes. Reads remain available under the effective identity. `allowMutation()` permits an
ordinary, non-sensitive mutation through route classification; the customer's normal Bouncer
policy still decides whether the handler may act. `sensitive()` always blocks an active support
mode, even if a route also has `allowMutation()`.

<!-- host-recipe:business-routes -->

```ts
import { allowMutation, sensitive } from 'adonisjs-masquerade/http'
import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

router
  .get('/support/customer', [() => import('#controllers/demo_controller'), 'customer'])
  .as('demo.customer')
  .use(middleware.auth({ guards: ['web_effective'] }))

router
  .post('/support/customer/preference', [
    () => import('#controllers/demo_controller'),
    'preference',
  ])
  .as('demo.preference')
  .use(allowMutation())
  .use(middleware.auth({ guards: ['web_effective'] }))

router
  .post('/support/customer/sensitive', [() => import('#controllers/demo_controller'), 'sensitive'])
  .as('demo.sensitive')
  .use(sensitive())
  .use(middleware.auth({ guards: ['web_effective'] }))
```

The handler authorizes the effective customer, never the raw actor. This excerpt follows the demo's
normal Bouncer pattern; replace the ability with the host's existing policy:

```ts
const customer = ctx.auth.user as User
await customerBouncer(ctx).authorize(
  Bouncer.ability((user: User) => user.active && user.canMutate && user.id === customer.id)
)
// Apply the requested customer-owned change only after authorization.
```

The sensitive route is rejected before its handler runs. Do not offer a bypass for it during
support mode.

## Stop with the refreshed token

Every rendered stop form uses the current `contextToken`, including a stop form shown on a customer
page. Send it to `POST /masquerade/stop` with CSRF. A successful stop returns an idle view and
another fresh token:

```json
{
  "isMasquerading": false,
  "contextToken": "2.<new-owner-specific-nonce>"
}
```

Use this returned token for the next control or business form. Each form/action must retain the
token that was rendered with its original user intent. If another tab changes the mode while a
form is open, refresh status and have the operator deliberately rebuild and submit the action.
Never fetch a fresh token in an interceptor and automatically replay an old request.

## Edge forms and host redirects

The package controller's status/start/stop routes return JSON. To use Edge, the host can adapt the
same public runtime service: validate the host form, call the service, then redirect only after a
successful transition. The provider registers the typed `masquerade.runtime` binding; the type is
exported from the provider entry point. For a host-rendered status page, call
`runtime.service.status(ctx)`, load eligible target choices with the host's account query, and
render the result. Keep that page behind the raw `web` guard so recovery remains available when
the effective account or operator eligibility changes. Attach the same independent start/stop
limiters to the host form routes:

<!-- host-recipe:html-control-routes -->

```ts
import { middleware } from '#start/kernel'
import { startMasqueradeLimiter, stopMasqueradeLimiter } from '#start/masquerade_control_limiter'
import router from '@adonisjs/core/services/router'

router
  .group(() => {
    router.get('/', [() => import('#controllers/demo_controller'), 'status']).as('demo.workspace')
    router
      .post('/start', [() => import('#controllers/demo_controller'), 'start'])
      .as('demo.start')
      .use(startMasqueradeLimiter)
    router
      .post('/stop', [() => import('#controllers/demo_controller'), 'stop'])
      .as('demo.stop')
      .use(stopMasqueradeLimiter)
  })
  .prefix('/support')
  .use(middleware.auth({ guards: ['web'] }))
```

The native-session fixture's
`examples/native-session/app/controllers/demo_controller.ts` and
`examples/native-session/app/services/demo_control_input.ts` are complete working examples of this
host-owned adapter and bounded URL-encoded form validation. In particular, preserve the input
size/shape checks, reject conflicting header and hidden tokens, and pass the captured token to the
service. The public `MasqueradeRuntime` type import brings the container-binding declaration into
scope for TypeScript.

```ts
import type { MasqueradeRuntime } from 'adonisjs-masquerade/providers/masquerade_provider'
import type { HttpContext } from '@adonisjs/core/http'
import { MasqueradeController } from 'adonisjs-masquerade/http'

export default class SupportController extends MasqueradeController {
  override async start(ctx: HttpContext): Promise<void> {
    const runtime: MasqueradeRuntime = await ctx.containerResolver.make('masquerade.runtime')
    await runtime.service.start(ctx, validatedStartInput(ctx))
    ctx.session.flash('success', 'Support mode started.')
    ctx.response.redirect().toPath('/support/customer')
  }

  override async stop(ctx: HttpContext): Promise<void> {
    const runtime: MasqueradeRuntime = await ctx.containerResolver.make('masquerade.runtime')
    await runtime.service.stop(ctx, validatedStopInput(ctx))
    ctx.session.flash('success', 'Support mode stopped.')
    ctx.response.redirect().toPath('/support')
  }
}
```

`validatedStartInput` and `validatedStopInput` above represent host-owned parsing and validation;
they are not package helpers. See the complete parser and controller linked above before using a
similar adapter. Keep the raw actor guard, separate limiter, Shield CSRF, and captured context
token on these HTML POSTs too. Let service errors reach the host exception handler, which owns
HTML feedback and redirects for error cases. The fixture's
`examples/native-session/app/exceptions/handler.ts` demonstrates that rendering path, including preserving rate-limit response headers. A redirect happens only after a
successful service transition.

An Edge form can use the host's CSRF-aware form component and include the context token explicitly:

```edge
@form({ route: 'demo.start', method: 'POST' })
  <input type="hidden" name="_masqueradeContext" value="{{ mode.contextToken }}" />
  <select name="targetId" required>
    @each(customer in customers)
      <option value="{{ customer.id }}">{{ customer.fullName || customer.email }}</option>
    @end
  </select>
  <textarea name="reason" required minlength="1" maxlength="500"></textarea>
  <button type="submit">Start support mode</button>
@end
```

## Recover from errors

The default JSON error body is `{ "errors": [{ "code", "message" }] }`; package messages are
English. A host exception handler may choose how to present errors, but this guide does not assume
that it translates them. For HTML, render a message and recovery link rather than retrying behind
the operator's back.

| Situation                                                         | Response                            | Recovery                                                                                                        |
| ----------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Missing control or business context                               | `428 E_MASQUERADE_CONTEXT_REQUIRED` | Read status and rebuild the action using its current token.                                                     |
| Stale token, expired mode, or another tab/device changed the mode | `409 E_MASQUERADE_CONTEXT_CHANGED`  | Refresh status; require deliberate resubmission of rebuilt input. Never refresh a token and replay old intent.  |
| Start submitted while a mode is active                            | `409 E_MASQUERADE_ALREADY_ACTIVE`   | Read current status and stop before starting another mode.                                                      |
| Active-mode mutation is not marked, or route is sensitive         | `403 E_MASQUERADE_ACTION_BLOCKED`   | Keep the sensitive action unavailable. A mutation marker does not grant customer permission.                    |
| Store or service unavailable                                      | `503 E_MASQUERADE_UNAVAILABLE`      | After an uncertain control response, GET status before deciding what to do. Do not blindly retry the old start. |
| Invalid fields, duration, or reason                               | `422 E_MASQUERADE_INVALID_INPUT`    | Show the validation problem and ask the operator to submit corrected data with the current token.               |

The native-session browser fixture keeps status and stop on the raw actor guard so an operator can
inspect or end a recorded mode if the target, actor eligibility, or start permission changes. A
control denial is not evidence that an earlier request did not commit: after a lost or uncertain
response, status is the source of current state.

## Audit business work and observe transitions

The package's durable control audit records committed starts, stops, expiry/invalidations, and
admitted control denials/no-ops. Keep that ledger distinct from the host's business audit, which
should describe the actual customer operation and outcome. After effective admission, resolve the
safe identity projection and attach it to the host's audit record:

```ts
const runtime = await ctx.containerResolver.make('masquerade.runtime')
const identity = await runtime.service.resolve(ctx)
await businessAudit.record({
  action: 'customer.preference.updated',
  actorId: identity.actorId,
  effectiveId: identity.effectiveId,
  actorIncarnation: identity.actorIncarnation,
  effectiveIncarnation: identity.effectiveIncarnation,
  modeId: identity.modeId,
  isMasquerading: identity.isMasquerading,
  outcome: 'success',
})
```

`businessAudit.record` is the host's own audit writer. Do not infer the actor from `ctx.auth.user`
on an effective route or persist model objects, stamps, raw context tokens, or request bodies as
identity metadata.

For notifications or cache invalidation, a host may also subscribe to transition events through
AdonisJS's emitter:

<!-- host-recipe:transition-observer -->

```ts
import type { ObserverEvent } from 'adonisjs-masquerade/types'
import emitter from '@adonisjs/core/services/emitter'
import logger from '@adonisjs/core/services/logger'

declare module '@adonisjs/core/types' {
  interface EventsList {
    'masquerade:started': ObserverEvent
    'masquerade:stopped': ObserverEvent
    'masquerade:expired': ObserverEvent
    'masquerade:invalidated': ObserverEvent
  }
}

emitter.on('masquerade:started', (event) => {
  logger.info({ action: 'support_mode_started', eventId: event.id })
})
```

Observers run after commit and are best effort. Their event omits the reason, and they do not
report denied starts/stops. Do not use observer delivery as the durable control ledger or the
host's business audit. The public payload type is added to the host's Adonis event list in the
listener module so TypeScript can type these event names.
