import { sessionGuard, sessionUserProvider } from '@adonisjs/auth/session'

export const userProvider = sessionUserProvider({ model: () => import('#models/user') })

export const webGuard = sessionGuard({
  useRememberMeTokens: true,
  provider: userProvider,
})
