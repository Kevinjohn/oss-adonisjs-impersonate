import { Bouncer } from '@adonisjs/bouncer'
import { allowMutation, sensitive, shareMasquerade } from 'adonisjs-masquerade/http'
import { middleware } from '#start/kernel'
import Session from '#controllers/session_controller'
import NewAccount from '#controllers/new_account_controller'
import Masquerade from '#controllers/masquerade_controller'
const controllers = { Session, NewAccount, Masquerade }
import router from '@adonisjs/core/services/router'
import type User from '#models/user'

router.on('/').render('pages/home').as('home')

router
  .group(() => {
    router.get('signup', [controllers.NewAccount, 'create'])
    router.post('signup', [controllers.NewAccount, 'store'])
    router.get('login', [controllers.Session, 'create'])
    router.post('login', [controllers.Session, 'store'])
  })
  .use(middleware.guest())

router
  .on('/dashboard')
  .render('pages/dashboard')
  .as('dashboard')
  .use(middleware.auth({ guards: ['web_effective'] }))

router
  .post('/logout', [controllers.Session, 'destroy'])
  .as('logout')
  .use(middleware.auth({ guards: ['web'] }))

router
  .group(() => {
    router.get('/', [controllers.Masquerade, 'status']).as('masquerade.status')
    router.post('/start', [controllers.Masquerade, 'start']).as('masquerade.start')
    router.post('/stop', [controllers.Masquerade, 'stop']).as('masquerade.stop')
  })
  .prefix('/masquerade')
  .use(middleware.auth({ guards: ['web'] }))

router
  .get('/business', async (ctx) => {
    const { auth } = ctx
    const actor = auth.use('web').user!
    const target = auth.user as User
    const bouncer = new Bouncer<User>(() => (auth.user as User | undefined) ?? null)
    const seesTarget = await bouncer.allows(Bouncer.ability((user: User) => user.id === target.id))
    return {
      actorId: actor.id,
      effectiveId: (auth.user as User).id,
      getUserOrFailId: (auth.getUserOrFail() as User).id,
      authenticatedViaGuard: auth.authenticatedViaGuard,
      rawActorId: auth.use('web').user!.id,
      bouncerUserId: seesTarget ? (auth.user as User).id : null,
      actorAllowed: await bouncer.allows(Bouncer.ability((user: User) => user.id === actor.id)),
      silentAuthSnapshot: (
        ctx as typeof ctx & {
          silentAuthSnapshot?: { guard?: string; userId?: number }
        }
      ).silentAuthSnapshot,
    }
  })
  .use(allowMutation())
  .use(middleware.auth({ guards: ['web_effective'] }))

router
  .post('/business/mixed-raw-first', async () => ({ ran: true }))
  .use(middleware.auth({ guards: ['web'] }))
  .use(middleware.auth({ guards: ['web_effective'] }))

router
  .post('/business/mixed-effective-first', async () => ({ ran: true }))
  .use(middleware.auth({ guards: ['web_effective'] }))
  .use(middleware.auth({ guards: ['web'] }))

router
  .get('/raw-business', async ({ auth }) => ({ actorId: auth.use('web').user!.id }))
  .use(middleware.auth({ guards: ['web'] }))

router
  .get('/business/form', async (ctx) => {
    await shareMasquerade(ctx)
    return ctx.view.render('pages/masquerade_form')
  })
  .use(middleware.auth({ guards: ['web_effective'] }))

router
  .get('/business/admitted-stop-form', async (ctx) => {
    const runtime = await ctx.containerResolver.make('masquerade.runtime')
    const admitted = await runtime.admit(ctx)
    await runtime.service.stop(ctx, { expectedContext: admitted.view.contextToken })
    await shareMasquerade(ctx)
    return ctx.view.render('pages/masquerade_form')
  })
  .use(middleware.auth({ guards: ['web_effective'] }))

router
  .post('/business/mutate', async ({ auth }) => {
    const bouncer = new Bouncer<User>(() => (auth.user as User | undefined) ?? null)
    await bouncer.authorize(Bouncer.ability((user: User) => Boolean(user.canMutate)))
    return {
      ran: true,
      effectiveId: (auth.user as User).id,
      rawActorId: auth.use('web').user!.id,
    }
  })
  .use(allowMutation())
  .use(middleware.auth({ guards: ['web_effective'] }))

router
  .post('/business/report-probe', async ({ auth }) => ({ rawActorId: auth.use('web').user!.id }))
  .use(allowMutation())
  .use(middleware.auth({ guards: ['web_effective'] }))

router
  .group(() => {
    router.post('/group-marked', async ({ auth }) => ({
      effectiveId: (auth.user as User).id,
      rawActorId: auth.use('web').user!.id,
    }))
  })
  .prefix('/business')
  .use(allowMutation())
  .use(middleware.auth({ guards: ['web_effective'] }))

router
  .post('/business/actor-only', async ({ auth }) => {
    const actor = auth.use('web').user!
    const bouncer = new Bouncer<User>(() => (auth.user as User | undefined) ?? null)
    await bouncer.authorize(Bouncer.ability((user: User) => user.id === actor.id))
    return { ran: true, effectiveId: (auth.user as User).id }
  })
  .use(allowMutation())
  .use(middleware.auth({ guards: ['web_effective'] }))

router
  .post('/business/denied-mutation', async () => ({ ran: true }))
  .use(middleware.auth({ guards: ['web_effective'] }))

router
  .post('/business/read-marked-mutation', async () => ({ ran: true }))
  .use(async (_ctx, next) => next())
  .use(middleware.auth({ guards: ['web_effective'] }))

router
  .post('/business/sensitive', async () => ({ ran: true }))
  .use(allowMutation())
  .use(sensitive())
  .use(middleware.auth({ guards: ['web_effective'] }))

router
  .post('/business/billing', async () => ({ ran: true }))
  .use(allowMutation())
  .use(sensitive())
  .use(middleware.auth({ guards: ['web_effective'] }))
