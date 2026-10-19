import { IgnitorFactory } from '@adonisjs/core/factories'
import { test } from '@japa/runner'

test('the provider registers in a bare application without side effects', async ({ assert }) => {
  const ignitor = new IgnitorFactory()
    .withCoreProviders()
    .withCoreConfig()
    .merge({ rcFileContents: { providers: [() => import('../providers/masquerade_provider.js')] } })
    .create(new URL('../', import.meta.url))
  const app = ignitor.createApp('web')
  await app.init()
  await app.boot()
  assert.isTrue(app.isBooted)
  await app.terminate()
})
