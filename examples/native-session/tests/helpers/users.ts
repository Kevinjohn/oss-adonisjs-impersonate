import User from '#models/user'
import { setTarget } from '#services/effective_guard'

const actorIds = new Set<string>()

export async function createUsers() {
  const suffix = crypto.randomUUID()
  const actor = await User.create({
    email: `actor-${suffix}@example.test`,
    password: 'secret',
    fullName: 'Actor',
  })
  const target = await User.create({
    email: `target-${suffix}@example.test`,
    password: 'secret',
    fullName: 'Target',
  })
  actorIds.add(String(actor.id))
  return { actor, target }
}

export function clearUserTargets() {
  for (const actorId of actorIds) setTarget(actorId)
  actorIds.clear()
}
