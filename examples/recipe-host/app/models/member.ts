import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Member extends BaseModel {
  @column({ isPrimary: true }) declare id: number
  @column() declare email: string
}
