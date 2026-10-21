import type User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class SilentAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    await ctx.auth.use('web').check()
    const context = ctx as HttpContext & {
      silentAuthSnapshot?: { guard?: string; userId?: number }
    }
    context.silentAuthSnapshot = {
      guard: ctx.auth.authenticatedViaGuard,
      userId: (ctx.auth.user as User | undefined)?.id,
    }
    return next()
  }
}
