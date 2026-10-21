import User from '#models/user'
import db from '@adonisjs/lucid/services/db'

const createdIds = new Set<number>()

export async function createUsers() {
  const suffix = crypto.randomUUID()
  const actor = await User.create({
    email: `operator-${suffix}@example.test`,
    password: 'correct-horse',
    fullName: 'Support Operator',
    active: true,
    canMutate: false,
    masqueradeOperator: true,
    securityStamp: 'operator-v1',
  })
  createdIds.add(actor.id)
  const target = await User.create({
    email: `customer-${suffix}@example.test`,
    password: 'correct-horse',
    fullName: 'Example Customer',
    active: true,
    canMutate: true,
    masqueradeOperator: false,
    securityStamp: 'customer-v1',
  })
  createdIds.add(target.id)
  return { actor, target }
}

export async function cleanUsers() {
  const ids = [...createdIds]
  if (!ids.length) return
  const ownerIds = ids.map(String)
  await db.from('demo_preferences').whereIn('user_id', ids).delete()
  await db.from('masquerade_events').whereIn('actor_id', ownerIds).delete()
  await db.from('masquerade_modes').whereIn('actor_id', ownerIds).delete()
  await User.query().whereIn('id', ids).delete()
  createdIds.clear()
}
