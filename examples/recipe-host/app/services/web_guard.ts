import { sessionGuard, sessionUserProvider } from '@adonisjs/auth/session'

const provider = sessionUserProvider({ model: () => import('#models/user') })
export const webGuard = sessionGuard({ useRememberMeTokens: true, provider })
