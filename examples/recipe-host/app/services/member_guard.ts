import { sessionGuard, sessionUserProvider } from '@adonisjs/auth/session'

const memberProvider = sessionUserProvider({ model: () => import('#models/member') })
export const memberGuard = sessionGuard({ useRememberMeTokens: false, provider: memberProvider })
