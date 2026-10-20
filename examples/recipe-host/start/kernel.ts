import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

server.use([])
router.use([
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('@adonisjs/session/session_middleware'),
  () => import('@adonisjs/shield/shield_middleware'),
  () => import('@adonisjs/auth/initialize_auth_middleware'),
  () => import('#middleware/silent_auth_middleware'),
])

export const middleware = router.named({
  auth: () => import('#middleware/auth_middleware'),
})
