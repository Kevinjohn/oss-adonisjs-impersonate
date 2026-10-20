import { cleanUsers, createUsers } from '#tests/helpers/users'
import User from '#models/user'
import {
  assertDemoEnvironmentAllowed,
  resetDemoAccounts,
  seedDemoAccounts,
} from '#services/demo_accounts'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

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
    await db
      .table('remember_me_tokens')
      .insert([rememberMeToken(demoOperator.id), rememberMeToken(actor.id)])
    await db
      .table('masquerade_events')
      .insert([masqueradeEvent(demoOperator.id), masqueradeEvent(actor.id)])

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
    assert.equal(
      Number(
        await db
          .from('remember_me_tokens')
          .where('tokenable_id', demoOperator.id)
          .count('* as total')
          .first()
          .then((row) => row?.total)
      ),
      0
    )
    assert.equal(
      Number(
        await db
          .from('remember_me_tokens')
          .where('tokenable_id', actor.id)
          .count('* as total')
          .first()
          .then((row) => row?.total)
      ),
      1
    )
    assert.equal(
      Number(
        await db
          .from('masquerade_events')
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
          .from('masquerade_events')
          .where('actor_id', String(actor.id))
          .count('* as total')
          .first()
          .then((row) => row?.total)
      ),
      1
    )
  })

  test('runs reset through Ace using NODE_ENV instead of the console execution environment', async ({
    assert,
  }) => {
    await seedDemoAccounts()
    assert.equal(runDemoReset('development').exitCode, 0)
    assert.isNull(await User.findBy('email', 'operator@example.test'))

    await seedDemoAccounts()
    const productionReset = runDemoReset('production')
    assert.notEqual(productionReset.exitCode, 0)
    assert.include(productionReset.output, 'Demo commands are allowed only in development or test')
    assert.isNotNull(await User.findBy('email', 'operator@example.test'))
  })

  test('refuses reset in production or against PostgreSQL', ({ assert }) => {
    assert.throws(
      () => assertDemoEnvironmentAllowed({ nodeEnv: 'production', dbClient: 'sqlite' }),
      /development or test/
    )
    assert.throws(
      () => assertDemoEnvironmentAllowed({ nodeEnv: 'development', dbClient: 'pg' }),
      /local SQLite/
    )
  })
})

function runDemoReset(nodeEnv: 'development' | 'production'): {
  exitCode: number
  output: string
} {
  const appRoot = fileURLToPath(new URL('../../', import.meta.url))
  try {
    const output = execFileSync(process.execPath, ['ace', 'demo:reset'], {
      cwd: appRoot,
      env: {
        ...process.env,
        NODE_ENV: nodeEnv,
        PORT: '3333',
        HOST: 'localhost',
        LOG_LEVEL: 'error',
        APP_KEY: 'development-command-fixture-key-012345',
        APP_URL: 'http://localhost:3333',
        SESSION_DRIVER: 'memory',
        DB_CLIENT: 'sqlite',
      },
      encoding: 'utf8',
      stdio: 'pipe',
    })
    return { exitCode: 0, output }
  } catch (error) {
    const commandError = error as {
      status?: number
      stderr?: string | Buffer
      stdout?: string | Buffer
    }
    return {
      exitCode: commandError.status ?? 1,
      output: `${commandError.stdout?.toString() ?? ''}${commandError.stderr?.toString() ?? ''}`,
    }
  }
}

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

function rememberMeToken(tokenableId: number) {
  const timestamp = new Date()
  return {
    tokenable_id: tokenableId,
    hash: crypto.randomUUID(),
    created_at: timestamp,
    updated_at: timestamp,
    expires_at: new Date(timestamp.getTime() + 60_000),
  }
}

function masqueradeEvent(actorId: number) {
  return {
    id: crypto.randomUUID(),
    mode_id: null,
    authority_namespace: 'native-session-fixture',
    actor_id: String(actorId),
    actor_incarnation: '1',
    target_id: null,
    target_incarnation: null,
    at: new Date().toISOString(),
    kind: 'start_denied',
    outcome_code: 'E_MASQUERADE_DENIED',
    revision: 1,
    reason: null,
  }
}
