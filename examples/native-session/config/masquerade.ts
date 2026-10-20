import { defineConfig } from 'adonisjs-masquerade'
import { sessionAuthority } from 'adonisjs-masquerade/native'
import { LucidControlStore } from 'adonisjs-masquerade/stores/lucid'
import type { ControlStore } from 'adonisjs-masquerade/types'
import app from '@adonisjs/core/services/app'
import { Database } from '@adonisjs/lucid/database'
import type User from '#models/user'
import { userProvider } from '#services/web_guard'

const native = sessionAuthority({
  namespace: 'native-session-fixture',
  guard: 'web',
  provider: userProvider,
  incarnation: 'id',
  securityStamp: (user: User) => user.securityStamp,
  isActive: (user: User) => Boolean(user.active),
})

let modeReads = 0
let storeUnavailable = false

class FixtureControlStore implements ControlStore {
  constructor(private readonly store: LucidControlStore) {}

  async read(owner: Parameters<ControlStore['read']>[0]) {
    modeReads += 1
    if (storeUnavailable) throw new Error('fixture store unavailable')
    return this.store.read(owner)
  }

  async compareAndSet(input: Parameters<ControlStore['compareAndSet']>[0]) {
    if (storeUnavailable) throw new Error('fixture store unavailable')
    return this.store.compareAndSet(input)
  }

  async recordControlOutcome(event: Parameters<ControlStore['recordControlOutcome']>[0]) {
    if (storeUnavailable) throw new Error('fixture store unavailable')
    return this.store.recordControlOutcome(event)
  }

  async expiredBatch(input: Parameters<ControlStore['expiredBatch']>[0]) {
    if (storeUnavailable) throw new Error('fixture store unavailable')
    return this.store.expiredBatch(input)
  }

  async pruneEvents(input: Parameters<ControlStore['pruneEvents']>[0]) {
    if (storeUnavailable) throw new Error('fixture store unavailable')
    return this.store.pruneEvents(input)
  }
}

export function resetMasqueradeFixtureDiagnostics() {
  modeReads = 0
  storeUnavailable = false
}

export function resetMasqueradeReadCount() {
  modeReads = 0
}

export function masqueradeFixtureDiagnostics() {
  return { modeReads, storeUnavailable }
}

export function setMasqueradeStoreUnavailable(value: boolean) {
  storeUnavailable = value
}

const config = defineConfig({
  authority: native.authority,
  policy: {
    canMasquerade: ({ actor, target }) =>
      Boolean(actor.user.masqueradeOperator) && Boolean(target.user.active),
    canUseRequest: ({ actor, target }) => Boolean(actor.user.active) && Boolean(target.user.active),
  },
  store: async () => {
    const database = await app.container.make(Database)
    return new FixtureControlStore(new LucidControlStore(database.connection()))
  },
  contextEnforcement:
    process.env.MASQUERADE_CONTEXT_ENFORCEMENT === 'report' ? 'report' : 'enforce',
  retention: 'host-managed',
})

export const nativeAdapter = native
export default config
