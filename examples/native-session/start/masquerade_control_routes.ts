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
