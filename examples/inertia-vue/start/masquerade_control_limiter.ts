import limiter from '@adonisjs/limiter/services/main'
import type { HttpLimiter } from '@adonisjs/limiter'
import type User from '#models/user'

export const startMasqueradeLimiter = limiter.define('masquerade_start', (ctx) => {
  const actor = ctx.auth.use('web').getUserOrFail() as User
  return limiter
    .allowRequests(10)
    .every('1 minute')
    .usingKey(String(actor.id)) as unknown as HttpLimiter<any>
})

export const stopMasqueradeLimiter = limiter.define('masquerade_stop', (ctx) => {
  const actor = ctx.auth.use('web').getUserOrFail() as User
  return limiter
    .allowRequests(10)
    .every('1 minute')
    .usingKey(String(actor.id)) as unknown as HttpLimiter<any>
})
