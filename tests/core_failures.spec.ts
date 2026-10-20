import { test } from '@japa/runner'
import { fixture, errorCode } from './helpers/core.js'

test('indeterminate committed start logs correlation only and never emits or records a false denial', async ({
  assert,
}) => {
  const f = fixture()
  const service = await f.create()
  const idle = await service.status({})
  const cas = f.store.compareAndSet.bind(f.store)
  f.store.compareAndSet = async (input) => {
    await cas(input)
    return { status: 'indeterminate', transitionId: input.event.id }
  }
  assert.equal(
    await errorCode(() =>
      service.start(
        {},
        { targetId: 'b', reason: 'private case', expectedContext: idle.contextToken }
      )
    ),
    'E_MASQUERADE_UNAVAILABLE'
  )
  assert.deepEqual(
    f.store.events.map((event) => event.kind),
    ['started']
  )
  const observedResult1 = await service.status({})
  assert.isTrue(observedResult1.isMasquerading)
  assert.deepEqual(f.observed, [
    { code: 'E_MASQUERADE_UNAVAILABLE', transitionId: f.store.events[0].id },
  ])
  assert.notInclude(JSON.stringify(f.observed), 'private case')
})

test('indeterminate committed stop does not emit success or record a false denial', async ({
  assert,
}) => {
  const f = fixture()
  const service = await f.create()
  const active = await f.start(service)
  f.observed.length = 0
  const cas = f.store.compareAndSet.bind(f.store)
  f.store.compareAndSet = async (input) => {
    await cas(input)
    return { status: 'indeterminate', transitionId: input.event.id }
  }
  assert.equal(
    await errorCode(() => service.stop({}, { expectedContext: active.contextToken })),
    'E_MASQUERADE_UNAVAILABLE'
  )
  assert.deepEqual(
    f.store.events.map((event) => event.kind),
    ['started', 'stopped']
  )
  const observedResult2 = await service.status({})
  assert.isFalse(observedResult2.isMasquerading)
  assert.lengthOf(f.observed, 1)
})

test('CAS write and required outcome failures return503 and leave authoritative state unchanged', async ({
  assert,
}) => {
  const f = fixture()
  const service = await f.create()
  const idle = await service.status({})
  f.store.compareAndSet = async () => {
    throw new Error('write failed')
  }
  assert.equal(await errorCode(() => f.start(service)), 'E_MASQUERADE_UNAVAILABLE')
  assert.isNull(await f.store.read(f.owner))
  assert.equal(f.store.events[0].kind, 'start_denied')
  f.store.recordControlOutcome = async () => {
    throw new Error('audit failed')
  }
  assert.equal(
    await errorCode(() =>
      service.start({}, { targetId: 'a', reason: 'case', expectedContext: idle.contextToken })
    ),
    'E_MASQUERADE_UNAVAILABLE'
  )
  assert.equal(
    await errorCode(() => service.stop({}, { expectedContext: idle.contextToken })),
    'E_MASQUERADE_UNAVAILABLE'
  )
  assert.isNull(await f.store.read(f.owner))
})

test('observer sync throws, rejected promises and rejected reporter cannot alter a committed result', async ({
  assert,
}) => {
  const f = fixture()
  const failure = new Error('listener failed')
  f.dependencies.emitter = {
    emit: () => {
      throw failure
    },
  }
  f.dependencies.logger = {
    info: () => Promise.reject(failure),
    error: () => Promise.reject(failure),
  }
  f.dependencies.observerErrorHandler = (error) => {
    f.failures.push(error)
    return Promise.reject(new Error('reporter failed'))
  }
  const service = await f.create()
  const observedResult3 = await f.start(service)
  assert.isTrue(observedResult3.isMasquerading)
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(f.failures, [failure, failure])
  assert.lengthOf(f.store.events, 1)
})

test('never-settling observers are not awaited', async ({ assert }) => {
  const f = fixture()
  f.dependencies.emitter = { emit: () => new Promise(() => {}) }
  f.dependencies.logger = { info: () => new Promise(() => {}), error: () => new Promise(() => {}) }
  const observedResult4 = await f.start(await f.create())
  assert.isTrue(observedResult4.isMasquerading)
})

test('authority and local-policy throws preserve mode without admitting or logging secrets', async ({
  assert,
}) => {
  for (const failure of ['local', 'stamp', 'incarnation'] as const) {
    const f = fixture()
    const service = await f.create()
    await f.start(service)
    const before = await f.store.read(f.owner)
    if (failure === 'local')
      f.config.policy.canUseRequest = async () => {
        throw new Error('private failure')
      }
    if (failure === 'stamp') f.users.get('a')!.stamp = 's'.repeat(513)
    if (failure === 'incarnation')
      f.config.authority.incarnation = () => {
        throw new Error('private failure')
      }
    const next = await f.create()
    assert.equal(await errorCode(() => next.resolve({})), 'E_MASQUERADE_UNAVAILABLE')
    assert.deepEqual(await f.store.read(f.owner), before)
    assert.lengthOf(f.store.events, 1)
  }
})

test('conflicting expiry cannot clear a newer committed selection', async ({ assert }) => {
  const f = fixture()
  const service = await f.create()
  const active = await f.start(service)
  if (!active.isMasquerading) throw new Error('Expected active')
  f.state.now = Date.parse(active.expiresAt)
  const cas = f.store.compareAndSet.bind(f.store)
  f.store.compareAndSet = async (input) => {
    if (input.event.kind === 'expired') {
      f.store.compareAndSet = cas
      const stop = await service.stop({}, { expectedContext: active.contextToken })
      await service.start(
        {},
        { targetId: 'c', reason: 'new case', expectedContext: stop.contextToken }
      )
    }
    return cas(input)
  }
  const request = {}
  assert.equal(await errorCode(() => service.resolve(request)), 'E_MASQUERADE_CONTEXT_CHANGED')
  assert.equal(await errorCode(() => service.resolve(request)), 'E_MASQUERADE_CONTEXT_CHANGED')
  const observedResult5 = await service.resolve({})
  assert.equal(observedResult5.effectiveId, 'c')
  assert.lengthOf(
    f.store.events.filter((event) => event.kind === 'expired'),
    0
  )
})

test('status and stop fail closed on store read failure without account or policy reads', async ({
  assert,
}) => {
  const f = fixture()
  const service = await f.create()
  f.store.read = async () => {
    throw new Error('offline')
  }
  assert.equal(await errorCode(() => service.status({})), 'E_MASQUERADE_UNAVAILABLE')
  assert.equal(
    await errorCode(() => service.stop({}, { expectedContext: '0.' + 'a'.repeat(64) })),
    'E_MASQUERADE_UNAVAILABLE'
  )
  assert.equal(f.state.inspectCount, 0)
  assert.equal(f.state.policyCount, 0)
})

test('idle stop does not record a denial when its noop outcome acknowledgement fails', async ({
  assert,
}) => {
  const f = fixture()
  const service = await f.create()
  const idle = await service.status({})
  const record = f.store.recordControlOutcome.bind(f.store)
  f.store.recordControlOutcome = async (event) => {
    await record(event)
    throw new Error('outcome acknowledgement lost')
  }

  assert.equal(
    await errorCode(() => service.stop({}, { expectedContext: idle.contextToken })),
    'E_MASQUERADE_UNAVAILABLE'
  )
  assert.deepEqual(
    f.store.events.map((event) => event.kind),
    ['control_noop']
  )
})

test('simultaneous stop and start with one context cannot replace the active mode', async ({
  assert,
}) => {
  const f = fixture()
  const service = await f.create()
  const active = await f.start(service)
  const outcomes = await Promise.allSettled([
    service.stop({}, { expectedContext: active.contextToken }),
    service.start({}, { targetId: 'c', reason: 'case', expectedContext: active.contextToken }),
  ])
  assert.equal(outcomes[0].status, 'fulfilled')
  assert.equal(outcomes[1].status, 'rejected')
  assert.equal((await f.store.read(f.owner))!.state, 'idle')
  assert.deepEqual(
    f.store.events.map((event) => event.kind),
    ['started', 'stopped', 'start_denied']
  )
})

test('expired start first clears and rejects stale intent rather than selecting another target', async ({
  assert,
}) => {
  const f = fixture()
  const service = await f.create()
  const active = await f.start(service)
  if (!active.isMasquerading) throw new Error('Expected active')
  f.state.now = Date.parse(active.expiresAt)
  assert.equal(
    await errorCode(() =>
      service.start({}, { targetId: 'c', reason: 'case', expectedContext: active.contextToken })
    ),
    'E_MASQUERADE_CONTEXT_CHANGED'
  )
  assert.equal((await f.store.read(f.owner))!.state, 'idle')
  assert.deepEqual(
    f.store.events.map((event) => event.kind),
    ['started', 'expired', 'start_denied']
  )
})

for (const missingOutcome of [null, undefined]) {
  for (const operation of ['start', 'stop'] as const) {
    test(`committed ${operation} with ${missingOutcome} outcome is unknown without false denial`, async ({
      assert,
    }) => {
      const f = fixture()
      const service = await f.create()
      const initial = operation === 'stop' ? await f.start(service) : await service.status({})
      f.observed.length = 0
      const cas = f.store.compareAndSet.bind(f.store)
      f.store.compareAndSet = async (input) => {
        await cas(input)
        return missingOutcome as never
      }
      const invoke =
        operation === 'start'
          ? () =>
              service.start(
                {},
                { targetId: 'b', reason: 'private case', expectedContext: initial.contextToken }
              )
          : () => service.stop({}, { expectedContext: initial.contextToken })
      assert.equal(await errorCode(invoke), 'E_MASQUERADE_UNAVAILABLE')
      const last = f.store.events.at(-1)!
      assert.equal(last.kind, operation === 'start' ? 'started' : 'stopped')
      assert.deepEqual(f.observed, [{ code: 'E_MASQUERADE_UNAVAILABLE', transitionId: last.id }])
      assert.lengthOf(f.store.events, operation === 'start' ? 1 : 2)
    })
  }
}

test('failed expired-start denial audit preserves committed expiry and returns503 without compensation', async ({
  assert,
}) => {
  const f = fixture()
  const service = await f.create()
  const active = await f.start(service)
  if (!active.isMasquerading) throw new Error('Expected active')
  f.state.now = Date.parse(active.expiresAt)
  f.store.recordControlOutcome = async () => {
    throw new Error('audit failed')
  }
  assert.equal(
    await errorCode(() =>
      service.start({}, { targetId: 'c', reason: 'case', expectedContext: active.contextToken })
    ),
    'E_MASQUERADE_UNAVAILABLE'
  )
  assert.equal((await f.store.read(f.owner))!.state, 'idle')
  assert.deepEqual(
    f.store.events.map((event) => event.kind),
    ['started', 'expired']
  )
  const fresh = await service.resolve({})
  assert.equal(fresh.effectiveId, 'a')
})
