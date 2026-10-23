import { test } from '@japa/runner'
import { ApiClient } from '@japa/api-client'
import type { PluginFn } from '@japa/runner/types'
import { masqueradeApiClient } from '../plugins/api_client.js'

test.group('masqueradeApiClient', (group) => {
  group.setup(() => {
    ;(masqueradeApiClient() as unknown as () => void)()
  })

  test('rejects a target without an id', ({ assert }) => {
    const request = new ApiClient('http://127.0.0.1:9').get('/business')
    assert.throws(() => request.masquerading({} as never), 'requires a target with an id')
    assert.throws(() => request.masquerading(''), 'requires a target with an id')
  })

  test('fails before sending when the request has no loginAs actor', async ({ assert }) => {
    await assert.rejects(async () => {
      await new ApiClient('http://127.0.0.1:9').get('/business').masquerading('7')
    }, /requires loginAs\(\) on the same request/)
  })

  test('is a Japa plugin function', ({ assert }) => {
    const plugin: PluginFn = masqueradeApiClient({ prefix: '/api/masquerade' })
    assert.isFunction(plugin)
  })
})
