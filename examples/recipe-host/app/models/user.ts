import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DbRememberMeTokensProvider } from '@adonisjs/auth/session'

export default class User extends BaseModel {
  static rememberMeTokens = DbRememberMeTokensProvider.forModel(User)
  @column({ isPrimary: true }) declare id: number
  @column() declare email: string
  @column() declare accountIncarnation: string
  @column() declare securityEpoch: string
  @column({ consume: (value) => Boolean(value) }) declare active: boolean
  @column({ consume: (value) => Boolean(value) }) declare masqueradeOperator: boolean
  @column({ consume: (value) => Boolean(value) }) declare canMutate: boolean
}
