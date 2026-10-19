import { test } from '@japa/runner'
import { createMasqueradeService, defineConfig } from '../index.js'
import { MemoryControlStore } from '../testing/main.js'

test('starts, rejects nesting, stops and preserves idle revisions', async ({ assert }) => {
  const store = new MemoryControlStore()
  const actor = { id: 'a', incarnation: 'a', user: { id: 'a' } }
  const service = await createMasqueradeService(
    defineConfig({
      authority: {
        namespace: 'test',
        guard: 'web',
        incarnation: 'id',
        securityStamp: () => 'stamp',
        inspectAccount: async (id: string) => ({
          subject: { id, incarnation: id, user: { id } },
          active: true,
          securityStamp: 'stamp',
        }),
      },
      policy: { canMasquerade: async () => true },
      store: async () => store,
      retention: 'host-managed',
      contextEnforcement: 'enforce',
    }),
    {
      environment: 'test',
      authenticateActor: async () => actor,
      emitter: { emit() {} },
      logger: { info() {}, error() {} },
      observerErrorHandler() {},
    }
  )
  const idle = await service.status({})
  const active = await service.start(
    {},
    { targetId: 'b', reason: ' support ', expectedContext: idle.contextToken }
  )
  assert.isTrue(active.isMasquerading)
  await assert.rejects(
    () =>
      service.start({}, { targetId: 'b', reason: 'support', expectedContext: active.contextToken }),
    'Masquerade is already active'
  )
  const stopped = await service.stop({}, { expectedContext: active.contextToken })
  assert.isFalse(stopped.isMasquerading)
  assert.notEqual(stopped.contextToken, idle.contextToken)
  assert.deepEqual(await service.stop({}, { expectedContext: stopped.contextToken }), stopped)
  assert.deepEqual(
    store.events.map((event) => event.kind),
    ['started', 'start_denied', 'stopped', 'control_noop']
  )
})

import { fixture, errorCode } from './helpers/core.js'

test('start persists bounded reason and hashes; projections and observers expose only safe fields', async ({
  assert,
}) => {
  const f = fixture()
  const service = await f.create()
  const view = await f.start(service)
  const row = await f.store.read(f.owner)
  assert.equal(row?.reason, 'support\ncase\t42')
  assert.match(row!.actorStampHash!, /^[a-f0-9]{64}$/)
  assert.notEqual(row!.actorStampHash, 'secret-a')
  assert.equal(f.store.events[0].reason, 'support\ncase\t42')
  const resolved = await service.resolve({})
  assert.equal(resolved.effectiveId, 'b')
  assert.isTrue(Object.isFrozen(resolved))
  assert.isTrue(Object.isFrozen(view))
  const safe = JSON.stringify([view, resolved, f.observed])
  for (const secret of ['secret-', 'private-model', 'support', 'stampHash', '"user"'])
    assert.notInclude(safe, secret)
})

test('matching idle stop records a noop and never rotates the context', async ({ assert }) => {
  const f = fixture()
  const service = await f.create()
  const view = await service.status({})
  assert.deepEqual(await service.stop({}, { expectedContext: view.contextToken }), view)
  assert.isNull(await f.store.read(f.owner))
  assert.deepEqual(
    f.store.events.map((event) => event.kind),
    ['control_noop']
  )
})

test('stale start and stop cannot overwrite or clear the current winner', async ({ assert }) => {
  const f = fixture()
  const service = await f.create()
  const idle = await service.status({})
  await f.start(service)
  const before = await f.store.read(f.owner)
  for (const operation of [
    () => service.start({}, { targetId: 'c', reason: 'case', expectedContext: idle.contextToken }),
    () => service.stop({}, { expectedContext: idle.contextToken }),
  ])
    assert.equal(await errorCode(operation), 'E_MASQUERADE_CONTEXT_CHANGED')
  assert.deepEqual(await f.store.read(f.owner), before)
  assert.deepEqual(
    f.store.events.map((event) => event.kind),
    ['started', 'start_denied', 'stop_denied']
  )
})

test('two devices starting at the same context produce one winner and no fallback', async ({
  assert,
}) => {
  const f = fixture()
  const service = await f.create()
  const idle = await service.status({})
  const results = await Promise.allSettled(
    ['b', 'c'].map((targetId) =>
      service.start({}, { targetId, reason: 'case', expectedContext: idle.contextToken })
    )
  )
  assert.lengthOf(
    results.filter((result) => result.status === 'fulfilled'),
    1
  )
  const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult
  assert.equal(rejected.reason.code, 'E_MASQUERADE_CONTEXT_CHANGED')
  assert.lengthOf(
    f.store.events.filter((event) => event.kind === 'started'),
    1
  )
  const observedResult1 = await service.resolve({})
  assert.equal(observedResult1.effectiveId, (await f.store.read(f.owner))!.targetId)
})

test('stop ignores target deletion, denied policies and failing stamp access', async ({
  assert,
}) => {
  const f = fixture()
  const service = await f.create()
  const active = await f.start(service)
  f.users.delete('b')
  f.state.policyThrows = true
  f.state.local = false
  f.state.stampThrows = true
  f.state.inspectThrows = true
  const counts = [f.state.inspectCount, f.state.policyCount, f.state.stampCount]
  const idle = await service.stop({}, { expectedContext: active.contextToken })
  assert.isFalse(idle.isMasquerading)
  assert.deepEqual([f.state.inspectCount, f.state.policyCount, f.state.stampCount], counts)
  const row = await f.store.read(f.owner)
  for (const key of [
    'targetId',
    'targetIncarnation',
    'actorStampHash',
    'targetStampHash',
    'reason',
    'startedAt',
    'expiresAt',
  ] as const)
    assert.isNull(row![key])
  assert.equal(row!.revision, 2)
  assert.notEqual(row!.revisionNonce, active.contextToken.split('.')[1])
})

test('exact expiry clears durably without stamp access and rejects the triggering request', async ({
  assert,
}) => {
  const f = fixture()
  const service = await f.create()
  const active = await f.start(service)
  if (!active.isMasquerading) throw new Error('Expected active view')
  f.state.now = Date.parse(active.expiresAt) - 1
  const observedResult2 = await service.resolve({})
  assert.equal(observedResult2.effectiveId, 'b')
  const observedResult3 = await service.status({})
  assert.equal(observedResult3.contextToken, active.contextToken)
  f.state.now++
  f.state.stampThrows = true
  f.state.inspectThrows = true
  assert.equal(await errorCode(() => service.resolve({})), 'E_MASQUERADE_CONTEXT_CHANGED')
  assert.equal(f.store.events.at(-1)!.kind, 'expired')
  f.state.now -= 1000000
  const observedResult4 = await service.resolve({})
  assert.equal(observedResult4.effectiveId, 'a')
  const observedResult5 = await service.status({})
  assert.isFalse(observedResult5.isMasquerading)
})

for (const invalidation of [
  'actor_stamp',
  'target_stamp',
  'actor_ineligible',
  'target_ineligible',
  'policy_denied',
  'target_incarnation',
] as const) {
  test(`global invalidity ${invalidation} clears once and never admits the triggering request`, async ({
    assert,
  }) => {
    const f = fixture()
    const service = await f.create()
    await f.start(service)
    if (invalidation === 'actor_stamp') f.users.get('a')!.stamp = 'changed'
    if (invalidation === 'target_stamp') f.users.get('b')!.stamp = 'changed'
    if (invalidation === 'actor_ineligible' || invalidation === 'target_ineligible') {
      const inspect = f.config.authority.inspectAccount
      f.config.authority.inspectAccount = async (id) => {
        const result = await inspect(id)
        if (result && id === (invalidation === 'actor_ineligible' ? 'a' : 'b'))
          result.active = false
        return result
      }
      // The configuration snapshot is immutable; construct a fresh service sharing authoritative state.
    }
    if (invalidation === 'policy_denied') f.state.policy = false
    if (invalidation === 'target_incarnation') f.users.get('b')!.incarnation = 'new-b'
    const next = await f.create()
    assert.equal(await errorCode(() => next.resolve({})), 'E_MASQUERADE_CONTEXT_CHANGED')
    assert.equal((await f.store.read(f.owner))!.state, 'idle')
    assert.equal(f.store.events.at(-1)!.kind, 'invalidated')
    assert.equal(
      f.store.events.at(-1)!.outcomeCode,
      invalidation === 'target_incarnation' ? 'target_ineligible' : invalidation
    )
    const observedResult6 = await next.resolve({})
    assert.equal(observedResult6.effectiveId, 'a')
  })
}

test('credential and local denial preserve mode; native rejection writes no package event', async ({
  assert,
}) => {
  const f = fixture()
  const service = await f.create()
  await f.start(service)
  const before = await f.store.read(f.owner)
  for (const operation of [
    () => service.start({ credentialInvalid: true }, {} as never),
    () => service.stop({ credentialInvalid: true }, {} as never),
    () => service.status({ credentialInvalid: true }),
    () => service.resolve({ credentialInvalid: true }),
  ])
    assert.equal(await errorCode(operation), 'native authentication failed')
  assert.equal(await errorCode(() => service.resolve({ denied: true })), 'E_MASQUERADE_NOT_ALLOWED')
  assert.deepEqual(await f.store.read(f.owner), before)
  assert.lengthOf(f.store.events, 1)
})

for (const failure of ['policy', 'inspect', 'read'] as const) {
  test(`${failure} failure rejects admission as unavailable with mode unchanged`, async ({
    assert,
  }) => {
    const f = fixture()
    const service = await f.create()
    await f.start(service)
    const before = await f.store.read(f.owner)
    if (failure === 'policy') f.state.policyThrows = true
    if (failure === 'inspect') f.state.inspectThrows = true
    const read = f.store.read.bind(f.store)
    if (failure === 'read')
      f.store.read = async () => {
        throw new Error('offline')
      }
    assert.equal(await errorCode(() => service.resolve({})), 'E_MASQUERADE_UNAVAILABLE')
    f.store.read = read
    assert.deepEqual(await f.store.read(f.owner), before)
    assert.lengthOf(f.store.events, 1)
  })
}

test('memoizes admission outcomes and freezes safe identity across later mode changes', async ({
  assert,
}) => {
  const f = fixture()
  const service = await f.create()
  const active = await f.start(service)
  const request = {}
  const first = await service.resolve(request)
  const count = f.state.authenticateCount
  await service.stop({}, { expectedContext: active.contextToken })
  assert.strictEqual(await service.resolve(request), first)
  assert.equal(f.state.authenticateCount, count + 1)
  const observedResult7 = await service.resolve({})
  assert.equal(observedResult7.effectiveId, 'a')
  const denied = { denied: true }
  await f.start(service)
  assert.equal(await errorCode(() => service.resolve(denied)), 'E_MASQUERADE_NOT_ALLOWED')
  denied.denied = false
  assert.equal(await errorCode(() => service.resolve(denied)), 'E_MASQUERADE_NOT_ALLOWED')
  const observedResult8 = await service.resolve({})
  assert.equal(observedResult8.effectiveId, 'b')
})

test('revision exhaustion fails closed without wrapping or transitions', async ({ assert }) => {
  const f = fixture()
  const service = await f.create()
  await f.start(service)
  const row = (await f.store.read(f.owner))!
  const original = f.store.read.bind(f.store)
  f.store.read = async (owner) => {
    const result = await original(owner)
    return result ? { ...result, revision: Number.MAX_SAFE_INTEGER } : null
  }
  const view = { contextToken: `${Number.MAX_SAFE_INTEGER}.${row.revisionNonce}` }
  for (const operation of [
    () => service.status({}),
    () => service.resolve({}),
    () => service.stop({}, { expectedContext: view.contextToken }),
    () => service.start({}, { targetId: 'c', reason: 'case', expectedContext: view.contextToken }),
  ])
    assert.equal(await errorCode(operation), 'E_MASQUERADE_UNAVAILABLE')
  assert.equal((await original(f.owner))!.revision, row.revision)
})

for (const invalidation of ['expiry', 'stamp', 'policy'] as const) {
  test(`repeated admission retains ${invalidation} rejection after durable clearing`, async ({
    assert,
  }) => {
    const f = fixture()
    const service = await f.create()
    const active = await f.start(service)
    if (!active.isMasquerading) throw new Error('Expected active')
    if (invalidation === 'expiry') f.state.now = Date.parse(active.expiresAt)
    if (invalidation === 'stamp') f.users.get('b')!.stamp = 'changed'
    if (invalidation === 'policy') f.state.policy = false
    const request = {}
    assert.equal(await errorCode(() => service.resolve(request)), 'E_MASQUERADE_CONTEXT_CHANGED')
    const count = f.state.authenticateCount
    assert.equal(await errorCode(() => service.resolve(request)), 'E_MASQUERADE_CONTEXT_CHANGED')
    assert.equal(f.state.authenticateCount, count)
    const fresh = await service.resolve({})
    assert.equal(fresh.effectiveId, 'a')
    assert.equal(
      f.store.events.filter((event) => event.kind === 'expired' || event.kind === 'invalidated')
        .length,
      1
    )
  })
}
