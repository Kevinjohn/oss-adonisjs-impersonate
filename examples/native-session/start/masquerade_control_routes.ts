import { middleware } from '#start/kernel'
import { startMasqueradeLimiter, stopMasqueradeLimiter } from '#start/masquerade_control_limiter'
import router from '@adonisjs/core/services/router'
import { masqueradeRoutes } from 'adonisjs-masquerade/http'

masqueradeRoutes(router, {
  auth: middleware.auth,
  guard: 'web',
  startLimiter: startMasqueradeLimiter,
  stopLimiter: stopMasqueradeLimiter,
})
