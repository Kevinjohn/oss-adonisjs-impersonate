import { cleanUsers, createUsers } from '#tests/helpers/users'
import User from '#models/user'
import {
  assertDemoResetAllowed,
  resetDemoAccounts,
  seedDemoAccounts,
} from '#services/demo_accounts'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'

const demoEmails = [
  'operator@example.test',
  'customer-one@example.test',
  'customer-two@example.test',
]

test.group('demo accounts', (group) => {
  group.setup(() => testUtils.db().migrate())
  group.each.teardown(async () => {
    await resetDemoAccounts({ nodeEnv: 'test', dbClient: 'sqlite' })
    await cleanUsers()
  })

  test('seeds one operator and two customers idempotently without changing unrelated accounts', async ({
    assert,
  }) => {
    const unrelated = await createUsers()

    await seedDemoAccounts()
    await seedDemoAccounts()

    const demoUsers = await User.query().whereIn('email', demoEmails).orderBy('email')
    assert.lengthOf(demoUsers, 3)
    assert.deepEqual(
      demoUsers.map((user) => [
        user.email,
        Boolean(user.masqueradeOperator),
        Boolean(user.canMutate),
      ]),
      [
        ['customer-one@example.test', false, true],
        ['customer-two@example.test', false, true],
        ['operator@example.test', true, false],
      ]
    )
    assert.equal(
      await User.query()
        .count('* as total')
        .first()
        .then((row) => row?.$extras.total),
      5
    )
    assert.isNotNull(await User.find(unrelated.actor.id))
    const verifiedOperator = await User.verifyCredentials(
      'operator@example.test',
      'demo-operator-2026'
    )
    const seededOperator = await User.findByOrFail('email', 'operator@example.test')
    assert.equal(verifiedOperator.id, seededOperator.id)
  })

  test('resets only the named demo accounts and their masquerade data', async ({ assert }) => {
    const { actor } = await createUsers()
    await seedDemoAccounts()
    const demoOperator = await User.findByOrFail('email', 'operator@example.test')
    await db.table('masquerade_modes').insert([idleMode(demoOperator.id), idleMode(actor.id)])

    await resetDemoAccounts({ nodeEnv: 'test', dbClient: 'sqlite' })

    assert.isNull(await User.findBy('email', 'operator@example.test'))
    assert.isNull(await User.findBy('email', 'customer-one@example.test'))
    assert.isNotNull(await User.find(actor.id))
    assert.equal(
      Number(
        await db
          .from('masquerade_modes')
          .where('actor_id', String(demoOperator.id))
          .count('* as total')
          .first()
          .then((row) => row?.total)
      ),
      0
    )
    assert.equal(
      Number(
        await db
          .from('masquerade_modes')
          .where('actor_id', String(actor.id))
          .count('* as total')
          .first()
          .then((row) => row?.total)
      ),
      1
    )
  })

  test('refuses reset in production or against PostgreSQL', ({ assert }) => {
    assert.throws(
      () => assertDemoResetAllowed({ nodeEnv: 'production', dbClient: 'sqlite' }),
      /development or test/
    )
    assert.throws(
      () => assertDemoResetAllowed({ nodeEnv: 'development', dbClient: 'pg' }),
      /local SQLite/
    )
  })
})

function idleMode(actorId: number) {
  return {
    authority_namespace: 'native-session-fixture',
    actor_id: String(actorId),
    actor_incarnation: '1',
    revision: 1,
    revision_nonce: 'fixture-nonce',
    state: 'idle',
    mode_id: crypto.randomUUID(),
    last_transition_id: crypto.randomUUID(),
    target_id: null,
    target_incarnation: null,
    actor_stamp_hash: null,
    target_stamp_hash: null,
    reason: null,
    started_at: null,
    expires_at: null,
    updated_at: new Date().toISOString(),
  }
}
