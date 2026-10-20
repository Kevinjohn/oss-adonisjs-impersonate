import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

router.get('/', async () => ({ ready: true }))
router
  .get('/member', async ({ auth }) => ({ memberId: auth.use('members').getUserOrFail().id }))
  .use(middleware.auth({ guards: ['members'] }))
