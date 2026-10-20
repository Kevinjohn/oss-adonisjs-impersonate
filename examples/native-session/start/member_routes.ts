import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { memberMasquerade } from '#services/member_masquerade'

router
  .group(() => {
    router.get('/status', async (ctx) => {
      const service = await memberMasquerade()
      return service.status(ctx)
    })
    router.post('/start', async (ctx) => {
      const service = await memberMasquerade()
      return service.start(ctx, {
        targetId: ctx.request.input('targetId'),
        reason: ctx.request.input('reason'),
        expectedContext: ctx.request.input('expectedContext'),
      })
    })
    router.get('/identity', async (ctx) => {
      const service = await memberMasquerade()
      return {
        ...(await service.resolve(ctx)),
        rawKey: ctx.auth.use('members').getUserOrFail().accountKey,
      }
    })
    router.post('/stop', async (ctx) => {
      const service = await memberMasquerade()
      return service.stop(ctx, { expectedContext: ctx.request.input('expectedContext') })
    })
  })
  .prefix('/members')
  .use(middleware.auth({ guards: ['members'] }))
