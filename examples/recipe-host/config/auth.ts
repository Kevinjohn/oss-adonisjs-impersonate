import { defineConfig } from '@adonisjs/auth'
import { memberGuard } from '#services/member_guard'
import { webGuard } from '#services/web_guard'
import type { InferAuthenticators, InferAuthEvents, Authenticators } from '@adonisjs/auth/types'

const authConfig = defineConfig({
  default: 'web',
  guards: { web: webGuard, members: memberGuard },
})

export default authConfig

declare module '@adonisjs/auth/types' {
  export interface Authenticators extends InferAuthenticators<typeof authConfig> {}
}
declare module '@adonisjs/core/types' {
  interface EventsList extends InferAuthEvents<Authenticators> {}
}
