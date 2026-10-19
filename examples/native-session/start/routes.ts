/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'
import { setTarget } from '#services/effective_guard'
import { Bouncer } from '@adonisjs/bouncer'
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
  .group(() => {
    router.on('/dashboard').render('pages/dashboard').as('dashboard')
    router.post('logout', [controllers.Session, 'destroy'])
  })
  .use(middleware.auth())

router
  .post('/control/clear', async ({ auth }) => {
    const actor = await auth.use('web').authenticate()
    setTarget(String(actor.id))
    return { actorId: actor.id, cleared: true }
  })
  .use(middleware.auth({ guards: ['web'] }))

router
  .post('/control/:targetId', async ({ auth, params }) => {
    const actor = await auth.use('web').authenticate()
    setTarget(String(actor.id), String(params.targetId))
    return { actorId: actor.id, targetId: String(params.targetId) }
  })
  .use(middleware.auth({ guards: ['web'] }))

router
  .get('/business', async (ctx) => {
    const auth = ctx.auth
    const actor = auth.use('web').user!
    let bouncerUserId: number | undefined
    const effectiveIsTarget = Bouncer.ability((user: User) => {
      bouncerUserId = user.id
      return user.id !== actor.id
    })
    const bouncer = new Bouncer<User>(() => auth.user ?? null)
    return {
      userId: auth.user!.id,
      getUserOrFailId: auth.getUserOrFail().id,
      authenticatedViaGuard: auth.authenticatedViaGuard,
      rawActorId: auth.use('web').user!.id,
      bouncerSeesTarget: await bouncer.allows(effectiveIsTarget),
      bouncerUserId,
      silentAuthSnapshot: (
        ctx as typeof ctx & {
          silentAuthSnapshot?: { guard?: string; userId?: number }
        }
      ).silentAuthSnapshot,
    }
  })
  .use(middleware.effectiveAuth())

router.get('/default-auth', async ({ auth }) => {
  const user = await auth.authenticate()
  return { userId: user.id, authenticatedViaGuard: auth.authenticatedViaGuard }
})

router.get('/api/business', async () => ({ error: 'unauthorized' })).use(middleware.effectiveAuth())
