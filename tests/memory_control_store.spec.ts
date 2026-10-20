import { test } from '@japa/runner'
import { assertControlStoreConformance, MemoryControlStore } from '../testing/main.js'
import { fixture } from './helpers/core.js'

test('memory store satisfies exported isolated ControlStore conformance', async () => {
  await assertControlStoreConformance(async () => new MemoryControlStore())
})

test('memory CAS clones inputs/outputs, commits one event and preserves row on event serialization failure', async ({
  assert,
}) => {
  const f = fixture()
  const service = await f.create()
  await f.start(service)
  const row = (await f.store.read(f.owner))!
  const event = f.store.events[0]
  const next = { ...row, revision: 2 }
  await assert.rejects(() =>
    f.store.compareAndSet({
      owner: f.owner,
      expected: 1,
      next,
      event: { ...event, invalid: () => {} } as never,
    })
  )
  assert.deepEqual(await f.store.read(f.owner), row)
  assert.lengthOf(f.store.events, 1)
  row.revision = 20
  event.revision = 20
  assert.equal((await f.store.read(f.owner))!.revision, 1)
  assert.equal(f.store.events[0].revision, 1)
})

test('expiry batches are bounded snapshots and event pruning never deletes mode rows', async ({
  assert,
}) => {
  const f = fixture()
  const service = await f.create()
  const active = await f.start(service)
  if (!active.isMasquerading) throw new Error('Expected active')
  assert.deepEqual(await f.store.expiredBatch({ now: active.startedAt, limit: 10 }), [])
  const batch = await f.store.expiredBatch({ now: active.expiresAt, limit: 1 })
  assert.lengthOf(batch, 1)
  batch[0].revision = 42
  assert.equal((await f.store.read(f.owner))!.revision, 1)
  assert.equal(await f.store.pruneEvents({ before: '2027-01-01T00:00:00.000Z', limit: 1 }), 1)
  assert.equal((await f.store.read(f.owner))!.revision, 1)
})
