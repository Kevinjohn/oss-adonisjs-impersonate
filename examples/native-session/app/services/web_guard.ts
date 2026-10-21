import { sessionGuard, sessionUserProvider } from '@adonisjs/auth/session'
import { tokensGuard, tokensUserProvider } from '@adonisjs/auth/access_tokens'

export const userProvider = sessionUserProvider({ model: () => import('#models/user') })

export const accessTokenUserProvider = tokensUserProvider({
  model: () => import('#models/user'),
  tokens: 'accessTokens',
})

export const webGuard = sessionGuard({
  useRememberMeTokens: true,
  provider: userProvider,
})

export const apiGuard = tokensGuard({ provider: accessTokenUserProvider })
