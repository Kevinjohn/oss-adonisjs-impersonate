import { sessionGuard, sessionUserProvider } from '@adonisjs/auth/session'

export const webGuard = sessionGuard({
  useRememberMeTokens: false,
  provider: sessionUserProvider({ model: () => import('#models/user') }),
})
