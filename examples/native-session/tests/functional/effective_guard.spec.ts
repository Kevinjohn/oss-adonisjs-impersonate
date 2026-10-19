import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { clearUserTargets, createUsers } from '#tests/helpers/users'

test.group('effective session guard', (group) => {
  group.setup(() => testUtils.db().migrate())
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => clearUserTargets())

  test('facade identity follows the effective guard while raw web retains the actor', async ({
    client,
    assert,
  }) => {
    const { actor, target } = await createUsers()
    const idle = await client.get('/business').loginAs(actor)
    idle.assertStatus(200)
    idle.assertBodyContains({
      userId: actor.id,
      getUserOrFailId: actor.id,
      authenticatedViaGuard: 'web_effective',
      rawActorId: actor.id,
    })

    const active = await client
      .post(`/control/${target.id}`)
      .withCsrfToken()
      .header('Accept', 'application/json')
      .loginAs(actor)
    active.assertStatus(200)
    active.assertBodyContains({ actorId: actor.id, targetId: String(target.id) })
    const response = await client.get('/business').loginAs(actor)
    response.assertStatus(200)
    response.assertBodyContains({
      userId: target.id,
      getUserOrFailId: target.id,
      authenticatedViaGuard: 'web_effective',
      rawActorId: actor.id,
    })
    assert.isTrue(response.body().bouncerSeesTarget)

    const cleared = await client
      .post('/control/clear')
      .withCsrfToken()
      .header('Accept', 'application/json')
      .loginAs(actor)
    cleared.assertStatus(200)
    cleared.assertBodyContains({ actorId: actor.id, cleared: true })
    const after = await client.get('/business').loginAs(actor)
    after.assertBodyContains({
      userId: actor.id,
      getUserOrFailId: actor.id,
      authenticatedViaGuard: 'web_effective',
      rawActorId: actor.id,
    })
    assert.equal(after.body().bouncerUserId, actor.id)
  })

  test('Bouncer lazily resolves the target while active and actor while idle', async ({
    client,
    assert,
  }) => {
    const { actor, target } = await createUsers()
    const idle = await client.get('/business').loginAs(actor)
    assert.equal(idle.body().bouncerUserId, actor.id)
    const changed = await client
      .post(`/control/${target.id}`)
      .withCsrfToken()
      .header('Accept', 'application/json')
      .loginAs(actor)
    changed.assertBodyContains({ actorId: actor.id, targetId: String(target.id) })
    const active = await client.get('/business').loginAs(actor)
    assert.equal(active.body().bouncerUserId, target.id)
    const cleared = await client
      .post('/control/clear')
      .withCsrfToken()
      .header('Accept', 'application/json')
      .loginAs(actor)
    cleared.assertStatus(200)
    cleared.assertBodyContains({ actorId: actor.id, cleared: true })
    const after = await client.get('/business').loginAs(actor)
    assert.equal(after.body().bouncerUserId, actor.id)
  })

  test('silent_auth resolves the effective guard before business authentication', async ({
    client,
  }) => {
    const { actor, target } = await createUsers()
    const changed = await client
      .post(`/control/${target.id}`)
      .withCsrfToken()
      .header('Accept', 'application/json')
      .loginAs(actor)
    changed.assertBodyContains({ actorId: actor.id, targetId: String(target.id) })
    const response = await client.get('/business').loginAs(actor)
    response.assertBodyContains({
      authenticatedViaGuard: 'web_effective',
      userId: target.id,
      silentAuthSnapshot: { guard: 'web_effective', userId: target.id },
    })
  })

  test('unauthenticated HTML and API requests use session driver rendering', async ({ client }) => {
    const html = await client.get('/business').redirects(0).header('Accept', 'text/html')
    html.assertStatus(302)
    html.assertHeader('location', '/login')
    const api = await client.get('/api/business').header('Accept', 'application/json')
    api.assertStatus(401)
    api.assertHeader('content-type', 'application/json; charset=utf-8')
    api.assertBodyContains({ errors: [{ message: 'Unauthorized access' }] })
  })

  test('Japa loginAs works unchanged for routes protected by web_effective', async ({ client }) => {
    const { actor } = await createUsers()
    const response = await client.get('/business').loginAs(actor)
    response.assertStatus(200)
    response.assertBodyContains({ userId: actor.id, authenticatedViaGuard: 'web_effective' })

    const defaultGuard = await client.get('/default-auth').loginAs(actor)
    defaultGuard.assertStatus(200)
    defaultGuard.assertBodyContains({
      userId: actor.id,
      authenticatedViaGuard: 'web_effective',
    })
  })

  test('raw web identity remains the operator while mode is active', async ({ client }) => {
    const { actor, target } = await createUsers()
    const idle = await client.get('/business').loginAs(actor)
    idle.assertBodyContains({ rawActorId: actor.id, authenticatedViaGuard: 'web_effective' })
    const changed = await client
      .post(`/control/${target.id}`)
      .withCsrfToken()
      .header('Accept', 'application/json')
      .loginAs(actor)
    changed.assertBodyContains({ actorId: actor.id, targetId: String(target.id) })
    const response = await client.get('/business').loginAs(actor)
    response.assertBodyContains({ rawActorId: actor.id, authenticatedViaGuard: 'web_effective' })
    const cleared = await client
      .post('/control/clear')
      .withCsrfToken()
      .header('Accept', 'application/json')
      .loginAs(actor)
    cleared.assertStatus(200)
    cleared.assertBodyContains({ actorId: actor.id, cleared: true })
    const after = await client.get('/business').loginAs(actor)
    after.assertBodyContains({ rawActorId: actor.id, authenticatedViaGuard: 'web_effective' })
  })

  test('concurrent operators see only their own targets', async ({ client, assert }) => {
    const first = await createUsers()
    const second = await createUsers()
    await client
      .post(`/control/${first.target.id}`)
      .withCsrfToken()
      .header('Accept', 'application/json')
      .loginAs(first.actor)
    await client
      .post(`/control/${second.target.id}`)
      .withCsrfToken()
      .header('Accept', 'application/json')
      .loginAs(second.actor)
    const firstResponse = await client.get('/business').loginAs(first.actor)
    const secondResponse = await client.get('/business').loginAs(second.actor)
    assert.equal(firstResponse.body().userId, first.target.id)
    assert.equal(secondResponse.body().userId, second.target.id)
    assert.notEqual(firstResponse.body().userId, secondResponse.body().userId)
  })
})
