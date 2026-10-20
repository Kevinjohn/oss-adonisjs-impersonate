import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { cleanUsers, createUsers } from '#tests/helpers/users'
import { takeMasqueradeWarnings } from '#middleware/masquerade_context_middleware'

if (process.env.MASQUERADE_CONTEXT_ENFORCEMENT === 'report') {
  test.group('report-mode HTTP context rollout', (group) => {
    group.setup(() => testUtils.db().migrate())
    group.each.teardown(() => cleanUsers())

    test('logs a missing owner context and continues the idle business request', async ({
      client,
      assert,
    }) => {
      const { actor } = await createUsers()
      takeMasqueradeWarnings()
      const response = await client
        .post('/business/report-probe')
        .withCsrfToken()
        .header('Accept', 'application/json')
        .json({})
        .loginAs(actor)
      response.assertStatus(200)
      assert.equal(response.body().rawActorId, actor.id)
      response.assertHeader('cache-control', 'no-store')
      response.assertHeader('vary', 'Accept, X-Masquerade-Context')
      assert.deepEqual(takeMasqueradeWarnings()[0], {
        code: 'E_MASQUERADE_CONTEXT_REQUIRED',
        route: '/business/report-probe',
        actorId: String(actor.id),
      })
    })
  })
}
