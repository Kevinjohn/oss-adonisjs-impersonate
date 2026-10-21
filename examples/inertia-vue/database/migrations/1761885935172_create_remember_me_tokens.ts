import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('remember_me_tokens', (table) => {
      table.increments('id').notNullable()
      table.integer('tokenable_id').notNullable().references('users.id').onDelete('CASCADE')
      table.string('hash').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.timestamp('expires_at').notNullable()
    })
  }
  async down() {
    this.schema.dropTable('remember_me_tokens')
  }
}
