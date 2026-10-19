import { test } from '@japa/runner'
import { createMasqueradeService, defineConfig } from '../index.js'
import { fixture } from './helpers/core.js'

test('validates config synchronously and freezes copied configuration', ({ assert }) => {
  const f = fixture()
  const config = defineConfig(f.config)
  assert.equal(config.durationSeconds, 900)
  assert.equal(config.maxDurationSeconds, 3600)
  assert.isTrue(Object.isFrozen(config))
  assert.isTrue(Object.isFrozen(config.authority))
  assert.isTrue(Object.isFrozen(config.policy))
  f.config.authority.namespace = 'changed'
  assert.equal(config.authority.namespace, 'test')
})

for (const [name, patch] of Object.entries({
  unknown: { extra: true },
  policy: { policy: undefined },
  incarnation: { authority: { ...fixture().config.authority, incarnation: undefined } },
  namespace: { authority: { ...fixture().config.authority, namespace: '../bad' } },
  namespaceBound: { authority: { ...fixture().config.authority, namespace: 'x'.repeat(129) } },
  duration: { durationSeconds: Number.NaN },
  infinite: { durationSeconds: Infinity },
  fractional: { durationSeconds: 60.5 },
  small: { durationSeconds: 59 },
  large: { maxDurationSeconds: 3601 },
  narrow: { maxDurationSeconds: 600 },
  retention: { retention: { days: 0 } },
  context: { contextEnforcement: 'ignore' },
  unknownPolicy: { policy: { ...fixture().config.policy, onEvent: () => {} } },
  unknownAuthority: { authority: { ...fixture().config.authority, extra: true } },
  unknownRetention: { retention: { days: 7, extra: true } },
}))
  test(`rejects invalid configuration: ${name}`, ({ assert }) => {
    assert.throws(
      () => defineConfig({ ...fixture().config, ...patch } as never),
      'Invalid masquerade configuration'
    )
  })

test('rejects test store outside explicit test environment even when store factory is asynchronous', async ({
  assert,
}) => {
  const f = fixture()
  await assert.rejects(
    () => createMasqueradeService(f.config, { ...f.dependencies, environment: 'production' }),
    'Invalid masquerade store for environment'
  )
  const narrowed = defineConfig({
    ...f.config,
    durationSeconds: 60,
    maxDurationSeconds: 120,
    retention: { days: 30 },
  })
  assert.equal(narrowed.maxDurationSeconds, 120)
})

test('requires observer and diagnostic ports at service creation', async ({ assert }) => {
  const f = fixture()
  for (const key of ['logger', 'emitter', 'observerErrorHandler']) {
    await assert.rejects(
      () => createMasqueradeService(f.config, { ...f.dependencies, [key]: undefined } as never),
      'Observer and diagnostic ports required'
    )
  }
})

test('explicit null configuration durations are rejected instead of defaulted', ({ assert }) => {
  for (const key of ['durationSeconds', 'maxDurationSeconds']) {
    assert.throws(
      () => defineConfig({ ...fixture().config, [key]: null } as never),
      'Invalid masquerade configuration'
    )
  }
})

import type { NativeAuthority, MasqueradePolicy } from '../src/types.js'
import type { Request, User } from './helpers/core.js'

test('preserves inherited contract methods and their class receivers when copying config', async ({
  assert,
}) => {
  const f = fixture()
  class Authority implements NativeAuthority<User> {
    namespace = 'test'
    guard = 'web'
    #users = f.users
    incarnation(user: User): string {
      return this.#users.get(user.id)!.incarnation
    }
    securityStamp(user: User): string {
      return this.#users.get(user.id)!.stamp
    }
    async inspectAccount(id: string) {
      const user = this.#users.get(id)
      return user
        ? {
            subject: { id, incarnation: this.incarnation(user), user },
            active: true,
            securityStamp: this.securityStamp(user),
          }
        : null
    }
  }
  class Policy implements MasqueradePolicy<User, Request> {
    #approved = true
    async canMasquerade(): Promise<boolean> {
      return this.#approved
    }
    async canUseRequest(): Promise<boolean> {
      return this.#approved
    }
  }
  class Configuration {
    authority = new Authority()
    policy = new Policy()
    contextEnforcement = 'enforce' as const
    retention = 'host-managed' as const
    #store = f.store
    async store() {
      return this.#store
    }
  }
  const service = await createMasqueradeService(defineConfig(new Configuration()), f.dependencies)
  const idle = await service.status({})
  const active = await service.start(
    {},
    { targetId: 'b', reason: 'case', expectedContext: idle.contextToken }
  )
  assert.isTrue(active.isMasquerading)
  const resolved = await service.resolve({})
  assert.equal(resolved.effectiveId, 'b')
})
