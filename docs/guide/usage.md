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

The [same-origin JSON client](./clients/json.md) runs this workflow in the native-session example.

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

Submit `POST /masquerade/start` with `targetId`, an optional `reason`, optional numeric
`durationSeconds`, optional `access` (`'view'` or `'edit'`), and the token captured with this form. Send the token as
`X-Masquerade-Context` or `_masqueradeContext`; if both are sent they must agree. For a
cookie-authenticated request, also send the host's Shield CSRF token. A JSON request body can look
like this:

```json
{
  "targetId": 42,
  "reason": "Investigating a reported invoice display issue",
  "durationSeconds": 900,
  "access": "view"
}
```

Omitting `access` selects view. Choose **Can edit** deliberately in the start form and send
`access: 'edit'` when the host's `canEdit` policy permits it. The level stays fixed until stop;
restart to choose another level. See the [access contract](https://github.com/Kevinjohn/oss-adonisjs-masquerade/blob/main/SPEC-masquerade.md#14-view-only-default-and-per-start-edit-access-accepted-22-october-2026).

The default duration is 900 seconds and the default maximum is 3600 seconds. A host can configure
a shorter duration and maximum. When duration is omitted, the configured default is used;
otherwise it must be an integer from 60 seconds through the configured maximum. The package does
not extend a deadline on later requests.

A reason is optional by default: an absent or blank reason starts the mode and the audit stores
none, so a start form can be a single button. Set `reason: 'required'` in `config/masquerade.ts`
when every start must be justified; a start without a reason is then rejected. A supplied reason
is trimmed and CRLF line endings are normalized to LF. LF and TAB are the only control characters
permitted inside the normalized reason. It must contain 1–500 Unicode code points and no more than
2,000 UTF-8 bytes. Invalid input is rejected, never truncated. Keep secrets and unnecessary
personal information out of the reason.

A successful start returns an active `ModeView` with a fresh token:

```json
{
  "isMasquerading": true,
  "contextToken": "1.<new-owner-specific-nonce>",
  "targetId": "42",
  "access": "view",
  "startedAt": "2026-10-20T10:15:00.000Z",
  "expiresAt": "2026-10-20T10:30:00.000Z"
}
```

The request accepts a string target ID or a safe integer; the response uses its canonical string
form. Only these fields are returned: the state, token, target ID, access level, start time, and fixed deadline. The
view does not contain the reason, actor or target model, stamps, or raw revision. Treat the token
as a hidden concurrency value, not something to display. A persisted active row is usable only
while `expiresAt` is strictly later than the current time. Status is read-only; an expired row can
still appear active until business admission or cleanup handles it. See
[Security and operations](security.md#duration-transition-and-recovery-behavior) for that boundary.

## Use the effective customer identity

Attach the route markers from the public HTTP entry point and the effective guard to business
routes. Reads remain available under the effective identity. With edit access, `allowMutation()`
permits an ordinary, non-sensitive mutation through route classification; the customer's normal Bouncer
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

The handler authorizes the effective customer, never the raw actor. The complete controller recipe
below includes the `Bouncer<User>` helper and a customer-owned reversible preference mutation. The
customer's normal business ability still applies; edit access and `allowMutation()` are both
required for a non-sensitive mutation. The sensitive route is rejected before its handler runs. Do not
offer a bypass for it during support mode.

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

Keep the raw actor guard, separate limiter, Shield CSRF, and captured context token on the Edge
POSTs too. The following complete fixture files show the boundary end to end. Copy each fence to
the named file in the native-session example, or adapt its account query and view names to the host.
The public `MasqueradeRuntime` type import brings the container-binding declaration into scope for
TypeScript.

<!-- host-recipe:demo-control-input -->

[`demo_control_input.ts`](https://github.com/Kevinjohn/oss-adonisjs-masquerade/blob/main/examples/native-session/app/services/demo_control_input.ts):

```ts
import type { HttpContext } from '@adonisjs/core/http'
import type { StartInput, StopInput } from 'adonisjs-masquerade/types'

const bodyLimit = 8 * 1024
const startKeys = new Set(['targetId', 'reason', 'access', '_masqueradeContext', '_csrf'])
const stopKeys = new Set(['_masqueradeContext', '_csrf'])

/** Keep the HTML forms within the canonical control input and audit boundary. */
export function demoStartInput(ctx: HttpContext): StartInput {
  const body = formBody(ctx, startKeys)
  if (!body) return invalidStartInput()
  return {
    targetId: body.targetId as StartInput['targetId'],
    reason: body.reason as StartInput['reason'],
    access: body.access as StartInput['access'],
    expectedContext: controlToken(ctx, body),
  }
}

export function demoStopInput(ctx: HttpContext): StopInput {
  const body = formBody(ctx, stopKeys)
  if (!body) return invalidStopInput()
  return { expectedContext: controlToken(ctx, body) }
}

function formBody(ctx: HttpContext, allowed: Set<string>): Record<string, unknown> | null {
  const contentType = ctx.request.header('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  const raw = ctx.request.raw()
  const body = ctx.request.body()
  if (contentType !== 'application/x-www-form-urlencoded') return null
  if (raw === null || Buffer.byteLength(raw, 'utf8') > bodyLimit) return null
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  if (Object.keys(body).some((key) => !allowed.has(key))) return null
  return body
}

function controlToken(ctx: HttpContext, body: Record<string, unknown>): string {
  const header = ctx.request.header('X-Masquerade-Context')
  const hidden = body._masqueradeContext
  if (header !== undefined && hidden !== undefined && header !== hidden) {
    return `0.${'0'.repeat(32)}`
  }
  const token = header ?? hidden
  return typeof token === 'string' ? token : ''
}

function invalidStartInput(): StartInput {
  return { __invalidHttpInput: true } as unknown as StartInput
}

function invalidStopInput(): StopInput {
  return { __invalidHttpInput: true } as unknown as StopInput
}
```

The demo form intentionally omits the optional duration control. If the host adds one, allow the
field in the host parser and convert only canonical, safe integer strings before passing it to the
service; core validation still enforces the configured 60-second minimum and maximum. The
controller calls `noStore(ctx)` for the rendered status page and both transitions so its overrides
retain `Cache-Control: private, no-store` and `Vary: Accept, X-Masquerade-Context`.

<!-- host-recipe:demo-controller -->

[`demo_controller.ts`](https://github.com/Kevinjohn/oss-adonisjs-masquerade/blob/main/examples/native-session/app/controllers/demo_controller.ts):

```ts
import User from '#models/user'
import { demoAccounts } from '#services/demo_accounts'
import { demoStartInput, demoStopInput } from '#services/demo_control_input'
import { Bouncer } from '@adonisjs/bouncer'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { MasqueradeController, shareMasquerade } from 'adonisjs-masquerade/http'

/** Browser-only adapter around the same service used by the JSON control routes. */
export default class DemoController extends MasqueradeController {
  override async status(ctx: HttpContext): Promise<void> {
    noStore(ctx)
    const actor = ctx.auth.use('web').getUserOrFail() as User
    const runtime = await ctx.containerResolver.make('masquerade.runtime')
    const mode = await runtime.service.status(ctx)
    const customerEmails = demoAccounts
      .filter((account) => !account.masqueradeOperator)
      .map((account) => account.email)
    const customers = actor.masqueradeOperator
      ? await User.query().whereIn('email', customerEmails).where('active', true)
      : []
    const target = mode.isMasquerading ? await User.find(mode.targetId) : null
    ctx.response.send(
      await ctx.view.render('pages/demo_workspace', {
        actor,
        operator: actor.masqueradeOperator,
        mode,
        customers,
        target,
        beforeDeadline: mode.isMasquerading && Date.parse(mode.expiresAt) > Date.now(),
        targetAvailable: Boolean(target?.active),
        expiresText: mode.isMasquerading ? formatDeadline(mode.expiresAt) : undefined,
      })
    )
  }

  override async start(ctx: HttpContext): Promise<void> {
    noStore(ctx)
    const runtime = await ctx.containerResolver.make('masquerade.runtime')
    await runtime.service.start(ctx, demoStartInput(ctx))
    ctx.response.redirect().toPath('/support/customer')
  }

  override async stop(ctx: HttpContext): Promise<void> {
    noStore(ctx)
    const runtime = await ctx.containerResolver.make('masquerade.runtime')
    await runtime.service.stop(ctx, demoStopInput(ctx))
    ctx.response.redirect().toPath('/support')
  }

  async customer(ctx: HttpContext) {
    noStore(ctx)
    const mode = await shareMasquerade(ctx)
    if (!mode.isMasquerading || Date.parse(mode.expiresAt) <= Date.now()) {
      return ctx.response.redirect().toPath('/support')
    }
    const actor = ctx.auth.use('web').getUserOrFail() as User
    const customer = ctx.auth.user as User
    await customerBouncer(ctx).authorize(
      Bouncer.ability((user: User) => user.active && user.id === customer.id)
    )
    const preference = await db.from('demo_preferences').where('user_id', customer.id).first()
    return ctx.view.render('pages/demo_customer', {
      actor,
      customer,
      mode,
      expiresText: formatDeadline(mode.expiresAt),
      emailUpdates: Boolean(preference?.email_updates),
      canEdit: await customerBouncer(ctx).allows(
        Bouncer.ability((user: User) => user.active && user.canMutate && user.id === customer.id)
      ),
    })
  }

  async preference(ctx: HttpContext) {
    noStore(ctx)
    const mode = await shareMasquerade(ctx)
    if (!mode.isMasquerading || Date.parse(mode.expiresAt) <= Date.now()) {
      return ctx.response.redirect().toPath('/support')
    }
    const customer = ctx.auth.user as User
    await customerBouncer(ctx).authorize(
      Bouncer.ability((user: User) => user.active && user.canMutate && user.id === customer.id)
    )
    const value = ctx.request.input('emailUpdates')
    if (value !== '0' && value !== '1') {
      return ctx.response.badRequest('Choose on or off for email updates.')
    }
    await db
      .table('demo_preferences')
      .insert({ user_id: customer.id, email_updates: value === '1' })
      .onConflict('user_id')
      .merge()
    ctx.session.flash('success', 'Customer email preference saved.')
    return ctx.response.redirect().toPath('/support/customer')
  }

  async sensitive(ctx: HttpContext) {
    // The sensitive marker rejects an active mode before this handler runs.
    return ctx.response.forbidden('Sensitive account actions are unavailable in support mode.')
  }
}

function customerBouncer(ctx: HttpContext) {
  return new Bouncer<User>(() => (ctx.auth.user as User | undefined) ?? null)
}

function noStore(ctx: HttpContext) {
  ctx.response.header('Cache-Control', 'private, no-store')
  ctx.response.vary(['Accept', 'X-Masquerade-Context'])
}

function formatDeadline(value: string): string {
  return `${new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))} UTC`
}
```

These are the concrete demo adapters, not additional package hooks. They use the typed public
provider binding and `MasqueradeRuntime` declaration; the host owns the eligible-account query,
flash messages, redirects, and rendered error recovery. Service errors reach the host exception
handler, which can render the appropriate recovery page without replaying the form.

The status action renders a start form only when the host query returned eligible customers. The
form component supplies Shield CSRF, and the hidden field keeps the context token from that status
response with this start intent. This excerpt is copied from the
[demo workspace Edge template](https://github.com/Kevinjohn/oss-adonisjs-masquerade/blob/main/examples/native-session/resources/views/pages/demo_workspace.edge):

<!-- host-recipe:start-form -->

```edge
@if(customers.length)
  @form({ route: 'demo.start', method: 'POST', class: 'support-form' })
    <input type="hidden" name="_masqueradeContext" value="{{ mode.contextToken }}" />
    <div class="field">
      <label class="field__label" for="targetId">Customer</label>
      <select
        class="field__input"
        id="targetId"
        name="targetId"
        required
        aria-describedby="customer-hint"
      >
        <option value="">Select a customer</option>
        @each(customer in customers)
          <option value="{{ customer.id }}">
            {{ customer.fullName || customer.email }}
            —
            {{ customer.email }}
          </option>
        @end
      </select>
      <p class="field__hint" id="customer-hint">
        Only active seeded customer accounts appear here.
      </p>
    </div>
    <div class="field">
      <label class="field__label" for="reason">Reason for access</label>
      <textarea
        class="field__input support-reason"
        id="reason"
        name="reason"
        required
        minlength="1"
        maxlength="500"
        aria-describedby="reason-hint"
      ></textarea>
      <p class="field__hint" id="reason-hint">
        Required for the audit record. Up to 500 characters; do not enter secrets.
      </p>
    </div>
    <fieldset class="field">
      <legend class="field__label">Access level</legend>
      <label class="field__choice">
        <input type="radio" name="access" value="view" checked />

        View only

      </label>
      <label class="field__choice">
        <input type="radio" name="access" value="edit" />

        Can edit

      </label>
    </fieldset>
    <button class="btn btn--primary" type="submit">Start support mode</button>
  @end
@else
  <p role="status" class="support-copy">
    No eligible seeded customers are available. Run the local demo seed command, then refresh this page.
  </p>
@end
```

For the effective business route, edit access and `allowMutation()` are both required; the
controller's Bouncer ability still checks the effective customer's ordinary permission before the
write. The `@form` component adds Shield's CSRF field, and the hidden field supplies the context
token captured with this page. This is the form in the
[customer workspace Edge template](https://github.com/Kevinjohn/oss-adonisjs-masquerade/blob/main/examples/native-session/resources/views/pages/demo_customer.edge):

<!-- host-recipe:business-preference-form -->

```edge
@if(canEdit)
  @form({
    route: 'demo.preference',
    method: 'POST',
    class: 'support-form',
    'data-support-intent': true,
  })
    <input type="hidden" name="_masqueradeContext" value="{{ mode.contextToken }}" />
    <div class="field">
      <label class="field__label" for="emailUpdates">Setting</label>
      <select class="field__input" id="emailUpdates" name="emailUpdates" required>
        <option value="1" {{ emailUpdates ? 'selected' : '' }}>On</option>
        <option value="0" {{ !emailUpdates ? 'selected' : '' }}>Off</option>
      </select>
    </div>
    <button class="btn btn--primary" type="submit">Save preference</button>
  @end
@else
  <p role="status" class="support-copy">This customer cannot change the preference.</p>
@end
```

The form submits the original token with the user's choice. A stale-context response requires a
refresh and deliberate rebuild; the host must not replace the token and automatically resend the
old selection.

Use the active view's latest token on its stop form too. The demo renders the stop control on both
the raw status page and the customer workspace; the forms are in the same
[workspace templates](https://github.com/Kevinjohn/oss-adonisjs-masquerade/tree/main/examples/native-session/resources/views/pages):

<!-- host-recipe:stop-form -->

```edge
@form({ route: 'demo.stop', method: 'POST' })
  <input type="hidden" name="_masqueradeContext" value="{{ mode.contextToken }}" />
  <button class="btn btn--primary" type="submit">Stop support mode</button>
@end
```

## Recover from errors

The default JSON error item carries `code` and `message`, plus `blockedBy` exactly for
`E_MASQUERADE_ACTION_BLOCKED`; package messages are
English. A host exception handler may choose how to present errors, but this guide does not assume
that it translates them. For HTML, render a message and recovery link rather than retrying behind
the operator's back.

| Situation                                                         | Response                            | Recovery                                                                                                        |
| ----------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Missing control or business context                               | `428 E_MASQUERADE_CONTEXT_REQUIRED` | Read status and rebuild the action using its current token.                                                     |
| Stale token, expired mode, or another tab/device changed the mode | `409 E_MASQUERADE_CONTEXT_CHANGED`  | Refresh status; require deliberate resubmission of rebuilt input. Never refresh a token and replay old intent.  |
| Start submitted while a mode is active                            | `409 E_MASQUERADE_ALREADY_ACTIVE`   | Read current status and stop before starting another mode.                                                      |
| View-mode mutation, unmarked edit mutation, or sensitive route    | `403 E_MASQUERADE_ACTION_BLOCKED`   | Use `blockedBy` to explain the denial. Edit and a mutation marker do not grant customer permission.             |
| Store or service unavailable                                      | `503 E_MASQUERADE_UNAVAILABLE`      | After an uncertain control response, GET status before deciding what to do. Do not blindly retry the old start. |
| Invalid fields, duration, or reason                               | `422 E_MASQUERADE_INVALID_INPUT`    | Show the validation problem and ask the operator to submit corrected data with the current token.               |

The host can branch on `blockedBy` before its normal exception handling. This helper shows
three presentation paths: JSON passes to the standard handler, HTML renders a host page, and
a host workflow can choose a flash-and-redirect response. Supply your own `errors/blocked_action`
Edge template (or use `ctx.inertia.render` for a host Inertia page). The template receives only
the host's explanation and should offer a link to status or stop.

```ts
import { MasqueradeError } from 'adonisjs-masquerade'
import type { HttpContext } from '@adonisjs/core/http'

export async function handleBlockedAction(
  error: unknown,
  ctx: HttpContext,
  presentation: 'page' | 'redirect' = 'page'
): Promise<boolean> {
  if (!(error instanceof MasqueradeError) || error.code !== 'E_MASQUERADE_ACTION_BLOCKED')
    return false
  if (ctx.request.accepts(['html', 'json']) !== 'html') return false
  const explanations = {
    sensitive: 'This action is unavailable during support mode. Stop and use your own account.',
    view_only: 'This session is view only. Stop and choose Can edit if your role permits it.',
    mutation_not_allowed:
      'This action is unavailable during support mode. Return to the customer page.',
  }
  const explanation = explanations[error.blockedBy ?? 'sensitive']
  if (presentation === 'redirect') {
    ctx.session.flash('error', explanation)
    ctx.response.redirect().back()
  } else {
    ctx.response.status(403).send(await ctx.view.render('errors/blocked_action', { explanation }))
  }
  return true
}
```

In the host exception handler, call `if (await handleBlockedAction(error, ctx)) return` before
`super.handle(error, ctx)`. The default path preserves the package JSON response. The host owns
its wording, flash rendering, redirect destination and templates; no package translation is used.

The native-session browser fixture keeps status and stop on the raw actor guard so an operator can
inspect or end a recorded mode if the target, actor eligibility, or start permission changes. A
control denial is not evidence that an earlier request did not commit: after a lost or uncertain
response, status is the source of current state.

## Audit business work and observe transitions

The package's durable control audit records committed starts, stops, expiry/invalidations, and
admitted control denials/no-ops. Keep that ledger distinct from the host's business audit, which
should describe the actual customer operation and outcome. After the customer's authorization
check and successful business write, resolve the safe identity projection and attach it to the host
audit record. Include it in the host transaction when that audit must commit atomically with the
business change:

```ts
import { masqueradeAuditFields } from 'adonisjs-masquerade/http'

await businessAudit.record({
  action: 'customer.preference.updated',
  outcome: 'success',
  ...(await masqueradeAuditFields(ctx)),
})
```

`masqueradeAuditFields(ctx)` always returns the same keys: `actorId`, `actorIncarnation`,
`effectiveId`, `effectiveIncarnation`, `isMasquerading`, `modeId` and `access`. While idle, the
effective identity is the actor and `modeId` and `access` are `null`, so one audit table shape
covers every request. `businessAudit.record` is the host's own audit writer. Do not infer the actor
from `ctx.auth.user` on an effective route or persist model objects, stamps, raw context tokens, or
request bodies as identity metadata.

### Review masquerade history

The package's control ledger is the `masquerade_events` table created by the generated migration.
The package ships no history page; a host can list the ledger with its own query and its own admin
authorization. Keep the route behind the raw `web` guard so an active mode never changes who is
reviewing:

```ts
// app/controllers/masquerade_history_controller.ts
import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'

export default class MasqueradeHistoryController {
  async index({ request, view, bouncer }: HttpContext) {
    await bouncer.authorize('viewMasqueradeHistory')
    const { actorId, targetId, from, to, page = 1 } = request.qs()
    const events = await db
      .from('masquerade_events')
      .where('authority_namespace', 'my_app')
      .if(actorId, (query) => query.where('actor_id', String(actorId)))
      .if(targetId, (query) => query.where('target_id', String(targetId)))
      // `at` is a UTC ISO 8601 string, so string comparison orders by time.
      .if(from, (query) => query.where('at', '>=', new Date(from).toISOString()))
      .if(to, (query) => query.where('at', '<', new Date(to).toISOString()))
      .select('at', 'kind', 'outcome_code', 'actor_id', 'target_id', 'access', 'reason')
      .orderBy([
        { column: 'at', order: 'desc' },
        { column: 'id', order: 'desc' },
      ])
      .paginate(Number(page) || 1, 50)
    return view.render('admin/masquerade_history', { events })
  }
}
```

```ts
// start/routes.ts
router
  .get('/admin/masquerade-history', [
    () => import('#controllers/masquerade_history_controller'),
    'index',
  ])
  .as('admin.masquerade_history')
  .use(middleware.auth({ guards: ['web'] }))
```

Each row is one control event: `kind` is `started`, `stopped`, `expired`, `invalidated`,
`start_denied`, `stop_denied` or `control_noop`, and `outcome_code` says why (for example
`edit_denied` for an invalidation). `reason` is set only on `started` rows, and is null when the
host's reason policy is optional and none was given. Join `actor_id` and `target_id` to the host's
users table to show names; the ledger stores IDs only. The ledger keeps events for the configured
[retention](operations.md#event-retention-and-store-scope); choose `retention: { days: n }` or
`'host-managed'` to match the host's compliance period.

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
