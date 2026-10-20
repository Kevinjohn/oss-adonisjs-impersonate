import { defineConfig } from '@adonisjs/auth'
import { effectiveGuard } from '#services/effective_guard'
import { webGuard } from '#services/web_guard'
import type { InferAuthenticators, InferAuthEvents, Authenticators } from '@adonisjs/auth/types'

/**
 * Authentication configuration.
 * Defines guards and user providers for session-based authentication.
 */
const authConfig = defineConfig({
  /**
   * The default guard to use for authentication.
   * This guard will be used when no specific guard is mentioned.
   */
  default: 'web_effective',

  guards: {
    /**
     * Web guard uses session-based authentication for web requests.
     */
    web: webGuard,
    web_effective: {
      resolver: async (_name, app) => {
        const rawFactory = await webGuard.resolver('web', app)
        return (ctx) => effectiveGuard(ctx, rawFactory)
      },
    },
  },
})

export default authConfig

/**
 * Inferring types from the configured auth
 * guards.
 */
declare module '@adonisjs/auth/types' {
  export interface Authenticators extends InferAuthenticators<typeof authConfig> {}
}
declare module '@adonisjs/core/types' {
  interface EventsList extends InferAuthEvents<Authenticators> {}
}
