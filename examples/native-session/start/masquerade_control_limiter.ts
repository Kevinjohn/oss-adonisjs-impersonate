import limiter from '@adonisjs/limiter/services/main'
import env from '#start/env'
import type User from '#models/user'

const duration = '1 minute'

const startLimit = () =>
  limiter.allowRequests(env.get('MASQUERADE_START_REQUESTS') ?? 10).every(duration)
const stopLimit = () =>
  limiter.allowRequests(env.get('MASQUERADE_STOP_REQUESTS') ?? 10).every(duration)

export const startMasqueradeLimiter = limiter.define('masquerade_start', (ctx) => {
  const actor = ctx.auth.use('web').getUserOrFail() as User
  return startLimit().usingKey(String(actor.id))
})

export const stopMasqueradeLimiter = limiter.define('masquerade_stop', (ctx) => {
  const actor = ctx.auth.use('web').getUserOrFail() as User
  return stopLimit().usingKey(String(actor.id))
})

export const startTokenMasqueradeLimiter = limiter.define('token_masquerade_start', (ctx) => {
  const actor = ctx.auth.use('api').getUserOrFail() as User
  return startLimit().usingKey(String(actor.id))
})

export const stopTokenMasqueradeLimiter = limiter.define('token_masquerade_stop', (ctx) => {
  const actor = ctx.auth.use('api').getUserOrFail() as User
  return stopLimit().usingKey(String(actor.id))
})
