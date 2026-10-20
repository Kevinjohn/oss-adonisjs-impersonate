import { test } from '@japa/runner'
import { IgnitorFactory } from '@adonisjs/core/factories'
import {
  isBusinessRoute,
  sensitive,
  allowMutation,
  routeMarkers,
} from '../integration/route_metadata.js'

const middleware = (name: string, args?: unknown[]) => ({ name, args })
const ctx = (routeMiddleware: unknown[] | undefined) => ({
  route: routeMiddleware ? { middleware: { all: () => new Set(routeMiddleware) } } : undefined,
})

test.group('masquerade route metadata', () => {
  test('classifies business routes from their matched auth guard metadata', ({ assert }) => {
    assert.isTrue(
      isBusinessRoute(
        ctx([middleware('auth', [{ guards: ['web_effective'] }])]) as never,
        'web_effective'
      )
    )
    assert.isFalse(
      isBusinessRoute(ctx([middleware('auth', [{ guards: ['web'] }])]) as never, 'web_effective')
    )
    assert.isTrue(isBusinessRoute(ctx([middleware('auth')]) as never, 'web_effective'))
    assert.isFalse(
      isBusinessRoute(
        ctx([middleware('auth', [{ guards: ['default'] }])]) as never,
        'web_effective'
      )
    )
    assert.isFalse(isBusinessRoute(ctx(undefined) as never, 'web_effective'))
  })

  test('exposes route and group markers as middleware visible in the matched route', ({
    assert,
  }) => {
    const sensitiveMarker = sensitive()
    const mutationMarker = allowMutation()
    assert.deepEqual(routeMarkers(ctx([sensitiveMarker, mutationMarker]) as never), {
      sensitive: true,
      allowMutation: true,
    })
    assert.deepEqual(routeMarkers(ctx([]) as never), { sensitive: false, allowMutation: false })
  })

  test('reads marker and guard options from a real Adonis router route', async ({ assert }) => {
    class AuthMiddleware {
      async handle(_ctx: unknown, next: () => Promise<unknown>, _options?: { guards: string[] }) {
        await next()
      }
    }
    const app = new IgnitorFactory()
      .withCoreProviders()
      .withCoreConfig()
      .create(new URL('../', import.meta.url))
      .createApp('web')
    await app.init()
    await app.boot()
    try {
      const router = await app.container.make('router')
      const named = router.named({ auth: async () => ({ default: AuthMiddleware }) })
      const route = router
        .get('/real-business-route', async () => {})
        .middleware([named.auth({ guards: ['web_effective'] }), sensitive(), allowMutation()])
        .toJSON()

      const context = { route } as never
      assert.isTrue(isBusinessRoute(context, 'web_effective'))
      assert.deepEqual(routeMarkers(context), { sensitive: true, allowMutation: true })
    } finally {
      await app.terminate()
    }
  })
})
