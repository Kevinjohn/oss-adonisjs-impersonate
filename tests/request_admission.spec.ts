import { test } from '@japa/runner'
import { admission } from '../src/request_admission.js'
import type { RequestAdmission } from '../src/request_admission.js'
import { fixture } from './helpers/core.js'
import type { User } from './helpers/core.js'

test('internal admission preserves Subject properties exposed by prototype getters', async ({
  assert,
}) => {
  class SubjectView {
    constructor(private model: User) {}
    get id() {
      return this.model.id
    }
    get incarnation() {
      return this.model.incarnation
    }
    get user() {
      return this.model
    }
  }
  const f = fixture()
  f.dependencies.authenticateActor = async () => new SubjectView(f.users.get('a')!)
  const inspectAccount = f.config.authority.inspectAccount
  f.config.authority.inspectAccount = async (id) => {
    const account = await inspectAccount(id)
    return account ? { ...account, subject: new SubjectView(account.subject.user) } : null
  }
  const service = await f.create()
  await f.start(service)
  const internal = service as unknown as {
    [admission](request: object): Promise<RequestAdmission<User>>
  }
  const snapshot = await internal[admission]({})
  for (const [subject, id] of [
    [snapshot.actor, 'a'],
    [snapshot.effective, 'b'],
  ] as const) {
    assert.equal(subject.id, id)
    assert.equal(subject.incarnation, id)
    assert.strictEqual(subject.user, f.users.get(id))
    assert.isTrue(Object.isFrozen(subject))
    assert.deepEqual(Object.keys(subject).sort(), ['id', 'incarnation', 'user'])
  }
})

test('internal admission freezes copied Subject shells and preserves native model references', async ({
  assert,
}) => {
  const f = fixture()
  const actor = { id: 'a', incarnation: 'a', user: f.users.get('a')! }
  f.dependencies.authenticateActor = async () => actor
  const service = await f.create()
  await f.start(service)
  const internal = service as unknown as {
    [admission](request: object): Promise<RequestAdmission<User>>
  }
  const snapshot = await internal[admission]({})
  assert.isTrue(Object.isFrozen(snapshot))
  for (const subject of [snapshot.actor, snapshot.effective]) {
    assert.isTrue(Object.isFrozen(subject))
    assert.isFalse(Reflect.set(subject, 'id', 'different'))
    assert.isFalse(Reflect.set(subject, 'incarnation', 'different'))
    assert.isFalse(Reflect.set(subject, 'user', {}))
    assert.isFalse(Object.isFrozen(subject.user))
  }
  assert.isFalse(Object.isFrozen(actor))
  assert.strictEqual(snapshot.actor.user, f.users.get('a'))
  assert.strictEqual(snapshot.effective.user, f.users.get('b'))
  snapshot.effective.user.privateData = 'mutable native model'
  assert.equal(f.users.get('b')!.privateData, 'mutable native model')
  assert.equal(snapshot.context.actorId, 'a')
  assert.equal(snapshot.context.effectiveId, 'b')
})
