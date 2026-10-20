import { test } from '@japa/runner'
import { fixture, errorCode } from './helpers/core.js'

test('start preserves input-shape, context and active-mode error precedence', async ({
  assert,
}) => {
  const f = fixture()
  const service = await f.create()
  const idle = await service.status({})
  const selection = { targetId: 'b', reason: '', durationSeconds: 0 }
  assert.equal(
    await errorCode(() => service.start({}, { ...selection, expectedContext: '' })),
    'E_MASQUERADE_CONTEXT_REQUIRED'
  )
  assert.equal(
    await errorCode(() =>
      service.start({}, { ...selection, expectedContext: '', extra: true } as never)
    ),
    'E_MASQUERADE_INVALID_INPUT'
  )
  const active = await f.start(service)
  assert.equal(
    await errorCode(() => service.start({}, { ...selection, expectedContext: idle.contextToken })),
    'E_MASQUERADE_CONTEXT_CHANGED'
  )
  assert.equal(
    await errorCode(() =>
      service.start({}, { ...selection, expectedContext: active.contextToken })
    ),
    'E_MASQUERADE_ALREADY_ACTIVE'
  )
  assert.deepEqual(
    f.store.events.map((event) => event.kind),
    ['start_denied', 'start_denied', 'started', 'start_denied', 'start_denied']
  )
  const row = await f.store.read(f.owner)
  assert.equal(row?.revision, 1)
})

test('start denies false and truthy nonboolean policy; policy throws unavailable; no revision change', async ({
  assert,
}) => {
  for (const value of [false, 1, undefined, 'true', 'throw']) {
    const f = fixture()
    f.config.policy.canMasquerade = async () => {
      if (value === 'throw') throw new Error('policy')
      return value as boolean
    }
    const service = await f.create()
    assert.equal(
      await errorCode(() => f.start(service)),
      value === 'throw' ? 'E_MASQUERADE_UNAVAILABLE' : 'E_MASQUERADE_NOT_ALLOWED'
    )
    assert.isNull(await f.store.read(f.owner))
    assert.equal(f.store.events[0].kind, 'start_denied')
    assert.notProperty(f.store.events[0], 'reason')
  }
})

test('self-targeting, missing and ineligible targets are denied without target enumeration', async ({
  assert,
}) => {
  for (const kind of ['self', 'missing', 'ineligible']) {
    const f = fixture()
    if (kind === 'missing') f.users.delete('b')
    if (kind === 'ineligible') {
      const inspect = f.config.authority.inspectAccount
      f.config.authority.inspectAccount = async (id) => {
        const result = await inspect(id)
        if (id === 'b' && result) result.active = false
        return result
      }
    }
    const service = await f.create()
    const idle = await service.status({})
    assert.equal(
      await errorCode(() =>
        service.start(
          {},
          {
            targetId: kind === 'self' ? 'a' : 'b',
            reason: 'case',
            expectedContext: idle.contextToken,
          }
        )
      ),
      kind === 'self' ? 'E_MASQUERADE_INVALID_INPUT' : 'E_MASQUERADE_NOT_ALLOWED'
    )
    assert.isNull(await f.store.read(f.owner))
    assert.notProperty(f.store.events[0], 'targetId')
  }
})

test('incarnation and namespace isolate rows and no-row contexts; client actor substitution rejected', async ({
  assert,
}) => {
  const f = fixture()
  const service = await f.create()
  const active = await f.start(service)
  f.config.authority.namespace = 'other'
  const other = await f.create()
  const observedResult1 = await other.status({})
  assert.isFalse(observedResult1.isMasquerading)
  assert.equal(
    await errorCode(() => other.stop({}, { expectedContext: active.contextToken })),
    'E_MASQUERADE_CONTEXT_CHANGED'
  )
  f.config.authority.namespace = 'test'
  f.users.get('a')!.incarnation = 'new-a'
  const replacement = await f.create()
  const idle = await replacement.status({})
  assert.isFalse(idle.isMasquerading)
  assert.equal(
    await errorCode(() => replacement.stop({}, { expectedContext: active.contextToken })),
    'E_MASQUERADE_CONTEXT_CHANGED'
  )
  assert.equal(
    await errorCode(() =>
      replacement.start({}, {
        targetId: 'b',
        reason: 'case',
        expectedContext: idle.contextToken,
        actorId: 'c',
      } as never)
    ),
    'E_MASQUERADE_INVALID_INPUT'
  )
  assert.equal((await f.store.read(f.owner))!.state, 'active')
})

test('start policy receives reason/request and admission policy gets neither; local tenant denial preserves revision', async ({
  assert,
}) => {
  const f = fixture()
  const calls: unknown[] = []
  f.config.policy.canMasquerade = async (input) => {
    calls.push(input)
    return true
  }
  const service = await f.create()
  const active = await f.start(service)
  assert.equal(await errorCode(() => service.resolve({ denied: true })), 'E_MASQUERADE_NOT_ALLOWED')
  const inputs = calls as { reason?: string; request?: unknown }[]
  assert.equal(inputs[0].reason, 'support\ncase\t42')
  assert.property(inputs[0], 'request')
  assert.notProperty(inputs[1], 'reason')
  assert.notProperty(inputs[1], 'request')
  const observedResult2 = await service.status({})
  assert.equal(observedResult2.contextToken, active.contextToken)
  const observedResult3 = await service.resolve({})
  assert.equal(observedResult3.effectiveId, 'b')
})

test('duration boundaries, host narrowing and invalid input audit do not leak rejected reason', async ({
  assert,
}) => {
  const f = fixture()
  f.config.durationSeconds = 60
  f.config.maxDurationSeconds = 120
  const service = await f.create()
  for (const durationSeconds of [59, 121, Number.NaN, Infinity, 60.5]) {
    const idle = await service.status({})
    assert.equal(
      await errorCode(() =>
        service.start(
          {},
          {
            targetId: 'b',
            reason: 'private case',
            durationSeconds,
            expectedContext: idle.contextToken,
          }
        )
      ),
      'E_MASQUERADE_INVALID_INPUT'
    )
    assert.notProperty(f.store.events.at(-1)!, 'reason')
  }
  const active = await f.start(service)
  if (!active.isMasquerading) throw new Error('Expected active')
  assert.equal(Date.parse(active.expiresAt) - Date.parse(active.startedAt), 60000)
})

test('concurrent admission of one request authenticates and reads authoritative state once', async ({
  assert,
}) => {
  const f = fixture()
  const service = await f.create()
  await f.start(service)
  let reads = 0
  const read = f.store.read.bind(f.store)
  f.store.read = async (owner) => {
    reads++
    return read(owner)
  }
  const count = f.state.authenticateCount
  const request = {}
  const contexts = await Promise.all([
    service.resolve(request),
    service.resolve(request),
    service.resolve(request),
  ])
  assert.strictEqual(contexts[0], contexts[1])
  assert.strictEqual(contexts[0], contexts[2])
  assert.equal(reads, 1)
  assert.equal(f.state.authenticateCount, count + 1)
})

test('canonical provider self-target is invalid input without core ID coercion', async ({
  assert,
}) => {
  const f = fixture()
  const inspect = f.config.authority.inspectAccount
  f.config.authority.inspectAccount = (id) => inspect(id === 'alias' ? 'a' : id)
  const service = await f.create()
  const idle = await service.status({})
  assert.equal(
    await errorCode(() =>
      service.start({}, { targetId: 'alias', reason: 'case', expectedContext: idle.contextToken })
    ),
    'E_MASQUERADE_INVALID_INPUT'
  )
})

test('accepts canonical numeric/string/UUID identifiers without merging distinct spellings', async ({
  assert,
}) => {
  for (const targetId of [1, '001', '6a3c8137-3b2a-43a3-8124-c9b0ebc15a43']) {
    const f = fixture()
    const id = String(targetId)
    f.users.set(id, { id, incarnation: id, stamp: 'opaque', privateData: 'private-model' })
    const service = await f.create()
    const idle = await service.status({})
    const active = await service.start(
      {},
      { targetId, reason: 'case', durationSeconds: 3600, expectedContext: idle.contextToken }
    )
    assert.propertyVal(active, 'targetId', id)
    assert.equal((await f.store.read(f.owner))!.targetId, id)
  }
})

test('actor and target deletion invalidate an admitted native actor without target fallback', async ({
  assert,
}) => {
  for (const id of ['a', 'b']) {
    const f = fixture()
    const service = await f.create()
    await f.start(service)
    const actor = f.users.get('a')!
    f.dependencies.authenticateActor = async () => ({
      id: actor.id,
      incarnation: actor.incarnation,
      user: actor,
    })
    f.users.delete(id)
    const next = await f.create()
    assert.equal(await errorCode(() => next.resolve({})), 'E_MASQUERADE_CONTEXT_CHANGED')
    assert.equal((await f.store.read(f.owner))!.state, 'idle')
    assert.equal(
      f.store.events.at(-1)!.outcomeCode,
      id === 'a' ? 'actor_ineligible' : 'target_ineligible'
    )
  }
})

test('explicit null start duration is rejected and audited instead of defaulted', async ({
  assert,
}) => {
  const f = fixture()
  const service = await f.create()
  const idle = await service.status({})
  assert.equal(
    await errorCode(() =>
      service.start({}, {
        targetId: 'b',
        reason: 'case',
        expectedContext: idle.contextToken,
        durationSeconds: null,
      } as never)
    ),
    'E_MASQUERADE_INVALID_INPUT'
  )
  assert.isNull(await f.store.read(f.owner))
  assert.equal(f.store.events[0].kind, 'start_denied')
})
