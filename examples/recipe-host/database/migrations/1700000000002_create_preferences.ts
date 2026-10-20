import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('recipe_preferences', (table) => {
      table.increments('id').notNullable()
      table.integer('user_id').notNullable().references('id').inTable('users')
      table.boolean('enabled').notNullable()
    })
  }

  async down() {
    this.schema.dropTable('recipe_preferences')
  }
}
