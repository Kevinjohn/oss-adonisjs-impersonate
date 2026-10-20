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
    if (!actor.masqueradeOperator) {
      ctx.response.send(await ctx.view.render('pages/demo_workspace', { actor, operator: false }))
      return
    }

    const runtime = await ctx.containerResolver.make('masquerade.runtime')
    const mode = await runtime.service.status(ctx)
    const customerEmails = demoAccounts
      .filter((account) => !account.masqueradeOperator)
      .map((account) => account.email)
    const customers = await User.query().whereIn('email', customerEmails).where('active', true)
    const target = mode.isMasquerading ? await User.find(mode.targetId) : null
    ctx.response.send(
      await ctx.view.render('pages/demo_workspace', {
        actor,
        operator: true,
        mode,
        customers,
        target,
        usable: mode.isMasquerading && Date.parse(mode.expiresAt) > Date.now(),
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
