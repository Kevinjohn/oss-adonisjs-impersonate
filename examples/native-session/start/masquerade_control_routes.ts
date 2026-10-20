import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

router
  .group(() => {
    router
      .get('/', [() => import('#controllers/masquerade_controller'), 'status'])
      .as('masquerade.status')
    router
      .post('/start', [() => import('#controllers/masquerade_controller'), 'start'])
      .as('masquerade.start')
    router
      .post('/stop', [() => import('#controllers/masquerade_controller'), 'stop'])
      .as('masquerade.stop')
  })
  .prefix('/masquerade')
  .use(middleware.auth({ guards: ['web'] }))
