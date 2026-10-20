import { symbols } from '@adonisjs/auth'
import type { GuardContract } from '@adonisjs/auth/types'
import type { HttpContext } from '@adonisjs/core/http'
import type User from '#models/user'

const targets = new Map<string, string>()

export function setTarget(actorId: string, targetId?: string) {
  if (targetId) targets.set(actorId, targetId)
  else targets.delete(actorId)
}

export function getTargetId(actorId: string) {
  return targets.get(actorId)
}

export function effectiveGuard(
  ctx: HttpContext,
  rawFactory: (context: HttpContext) => GuardContract<User>
): GuardContract<User> {
  const raw = rawFactory(ctx)
  const guard: GuardContract<User> = {
    [symbols.GUARD_KNOWN_EVENTS]: undefined,
    driverName: raw.driverName,
    user: undefined,
    isAuthenticated: false,
    authenticationAttempted: false,
    getUserOrFail(this: GuardContract<User>) {
      if (!this.user) throw new Error('No effective user is authenticated')
      return this.user
    },
    async authenticate(this: GuardContract<User>) {
      this.authenticationAttempted = true
      const actor = await ctx.auth.use('web').authenticate()
      const targetId = targets.get(String(actor.id))
      const { default: User } = await import('#models/user')
      this.user = targetId ? await User.findOrFail(targetId) : actor
      this.isAuthenticated = true
      return this.user
    },
    async check(this: GuardContract<User>) {
      try {
        await this.authenticate()
        return true
      } catch (error) {
        if ((error as { code?: string }).code === 'E_UNAUTHORIZED_ACCESS') {
          this.isAuthenticated = false
          return false
        }
        throw error
      }
    },
    authenticateAsClient(user: User) {
      return raw.authenticateAsClient(user)
    },
  }
  return guard
}
