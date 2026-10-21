import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('demo_preferences', (table) => {
      table.integer('user_id').primary().references('users.id').onDelete('CASCADE')
      table.boolean('email_updates').notNullable().defaultTo(false)
    })
  }
  async down() {
    this.schema.dropTable('demo_preferences')
  }
}
