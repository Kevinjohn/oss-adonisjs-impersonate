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
