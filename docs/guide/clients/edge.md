# Edge forms and host redirects

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
