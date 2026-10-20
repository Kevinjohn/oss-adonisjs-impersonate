import { BaseModel, column } from '@adonisjs/lucid/orm'

/** An alternate host model with no id property and application-assigned identifiers.
 * https://lucid.adonisjs.com/docs/models#model-configuration
 */
export default class Member extends BaseModel {
  static table = 'support_accounts'
  static primaryKey = 'accountKey'
  static selfAssignPrimaryKey = true

  @column({ isPrimary: true, columnName: 'account_key' })
  declare accountKey: string

  @column()
  declare active: boolean

  @column()
  declare securityStamp: string
}
