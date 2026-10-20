import { test } from '@japa/runner'

if (process.env.TEST_BUILT_EXPORTS === '1')
  test('loads every built public export', async ({ assert }) => {
    const root = await import('adonisjs-masquerade')
    const types = await import('adonisjs-masquerade/types')
    const provider = await import('adonisjs-masquerade/providers/masquerade_provider')
    const auth = await import('adonisjs-masquerade/auth')
    const http = await import('adonisjs-masquerade/http')
    const native = await import('adonisjs-masquerade/native')
    const lucid = await import('adonisjs-masquerade/stores/lucid')
    const testing = await import('adonisjs-masquerade/testing')
    assert.equal(typeof root, 'object')
    assert.lengthOf(Object.keys(types), 0)
    assert.isFunction(provider.default)
    for (const subpath of [auth, http, native, lucid, testing])
      assert.equal(typeof subpath, 'object')
  })
