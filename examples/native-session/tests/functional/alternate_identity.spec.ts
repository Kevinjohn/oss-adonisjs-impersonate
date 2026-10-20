import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Member from '#models/member'

test.group('alternate native user table and primary key', (group) => {
  group.setup(() => testUtils.db().migrate())
  group.each.teardown(async () => {
    await db.from('masquerade_events').where('authority_namespace', 'alternate-members').delete()
    await db.from('masquerade_modes').where('authority_namespace', 'alternate-members').delete()
    await Member.query().delete()
  })
  for (const format of ['string', 'uuid'] as const) {
    test(`native session provider retains canonical ${format} IDs without an id column`, async ({
      client,
      assert,
    }) => {
      const key = () => (format === 'uuid' ? randomUUID() : `support:${randomUUID()}`)
      const actor = await Member.create({
        accountKey: key(),
        active: true,
        securityStamp: 'actor-v1',
      })
      const target = await Member.create({
        accountKey: key(),
        active: true,
        securityStamp: 'target-v1',
      })
      assert.isFalse('id' in actor)
      const status = await client.get('/members/status').withGuard('members').loginAs(actor)
      status.assertStatus(200)
      const started = await client
        .post('/members/start')
        .withGuard('members')
        .loginAs(actor)
        .withCsrfToken()
        .json({
          targetId: target.accountKey,
          reason: 'Alternate account support',
          expectedContext: status.body().contextToken,
        })
      started.assertStatus(200)
      assert.equal(started.body().targetId, target.accountKey)
      const active = await client.get('/members/identity').withGuard('members').loginAs(actor)
      active.assertStatus(200)
      active.assertBodyContains({
        actorId: actor.accountKey,
        effectiveId: target.accountKey,
        rawKey: actor.accountKey,
        isMasquerading: true,
      })
      const [row] = await db
        .from('masquerade_modes')
        .where('authority_namespace', 'alternate-members')
        .where('actor_id', actor.accountKey)
      assert.equal(row.target_id, target.accountKey)
      const stop = await client
        .post('/members/stop')
        .withGuard('members')
        .loginAs(actor)
        .withCsrfToken()
        .json({ expectedContext: started.body().contextToken })
      stop.assertStatus(200)
      const idle = await client.get('/members/identity').withGuard('members').loginAs(actor)
      idle.assertBodyContains({
        actorId: actor.accountKey,
        effectiveId: actor.accountKey,
        isMasquerading: false,
      })
    })
  }
})
