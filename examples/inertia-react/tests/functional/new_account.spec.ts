import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'

test.group('Self-signup', (group) => {
  group.setup(() => testUtils.db().migrate())

  test('creates and signs in an account from a valid signup form', async ({ client, assert }) => {
    const email = `signup-${crypto.randomUUID()}@example.test`
    try {
      const response = await client.post('/signup').redirects(0).withCsrfToken().form({
        fullName: 'New Account',
        email,
        password: 'signup-password',
        passwordConfirmation: 'signup-password',
      })

      response.assertStatus(302)
      response.assertHeader('location', '/')
      const user = await User.findByOrFail('email', email)
      assert.equal(user.fullName, 'New Account')
    } finally {
      await User.query().where('email', email).delete()
    }
  })
})
