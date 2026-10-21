import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('active').notNullable().defaultTo(true)
      table.boolean('masquerade_operator').notNullable().defaultTo(false)
      table.boolean('can_mutate').notNullable().defaultTo(false)
      table.string('security_stamp', 128).notNullable().defaultTo('initial')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('active')
      table.dropColumn('masquerade_operator')
      table.dropColumn('can_mutate')
      table.dropColumn('security_stamp')
    })
  }
}
