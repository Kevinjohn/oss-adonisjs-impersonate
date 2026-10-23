import { test } from '@japa/runner'
import { IgnitorFactory } from '@adonisjs/core/factories'
import type { Router } from '@adonisjs/core/http'
import { routeCoverageReport } from '../commands/routes.js'
import { masqueradeRoutes } from '../http/control_routes.js'
import { MasqueradeController } from '../http/controllers.js'

class AuthMiddleware {
  async handle(_ctx: unknown, next: () => Promise<unknown>, _options?: { guards: string[] }) {
    await next()
  }
}

async function withRouter(run: (router: Router) => Promise<void>): Promise<void> {
  const app = new IgnitorFactory()
    .withCoreProviders()
    .withCoreConfig()
    .create(new URL('../', import.meta.url))
    .createApp('web')
  await app.init()
  await app.boot()
  try {
    await run(await app.container.make('router'))
  } finally {
    await app.terminate()
  }
}

function namedAuth(router: Router) {
  return router.named({ auth: async () => ({ default: AuthMiddleware }) }).auth
}

const startLimiter = async (_ctx: unknown, next: () => Promise<unknown>) => next()
const stopLimiter = async (_ctx: unknown, next: () => Promise<unknown>) => next()

test.group('masqueradeRoutes', () => {
  test('mounts the package controls behind the raw guard and separate limiters', async ({
    assert,
  }) => {
    await withRouter(async (router) => {
      masqueradeRoutes(router, { auth: namedAuth(router), guard: 'web', startLimiter, stopLimiter })
      router.commit()
      const routes = router.toJSON().root
      assert.deepEqual(
        routes.map((route) => [route.methods.join(','), route.pattern, route.name]),
        [
          ['GET,HEAD', '/masquerade', 'masquerade.status'],
          ['POST', '/masquerade/start', 'masquerade.start'],
          ['POST', '/masquerade/stop', 'masquerade.stop'],
        ]
      )
      const middleware = routes.map((route) => [...route.middleware.all()])
      assert.isFalse(middleware[0].includes(startLimiter) || middleware[0].includes(stopLimiter))
      assert.isTrue(middleware[1].includes(startLimiter))
      assert.isFalse(middleware[1].includes(stopLimiter))
      assert.isTrue(middleware[2].includes(stopLimiter))
      assert.isFalse(middleware[2].includes(startLimiter))
      for (const route of routes)
        assert.deepEqual((route.handler as { reference?: unknown }).reference, [
          MasqueradeController,
          (route.handler as { method: string }).method,
        ])
      assert.deepEqual(await routeCoverageReport(router.toJSON(), 'web', 'web_effective'), [
        [
          'web',
          '  GET,HEAD           /masquerade [CONTROL READ]',
          '  POST               /masquerade/start [CONTROL MUTATION]',
          '  POST               /masquerade/stop [CONTROL MUTATION]',
        ].join('\n'),
      ])
    })
  })

  test('takes a path and name prefix for another raw guard', async ({ assert }) => {
    await withRouter(async (router) => {
      const group = masqueradeRoutes(router, {
        auth: namedAuth(router),
        guard: 'api',
        startLimiter,
        stopLimiter,
        prefix: '/api/masquerade',
        as: 'token.masquerade',
      })
      group.use(startLimiter)
      router.commit()
      assert.deepEqual(
        router.toJSON().root.map((route) => [route.pattern, route.name]),
        [
          ['/api/masquerade', 'token.masquerade.status'],
          ['/api/masquerade/start', 'token.masquerade.start'],
          ['/api/masquerade/stop', 'token.masquerade.stop'],
        ]
      )
      const [report] = await routeCoverageReport(router.toJSON(), 'web', 'web_effective')
      assert.include(report, 'api\n  GET,HEAD           /api/masquerade [CONTROL READ]')
    })
  })

  test('fails at registration without the raw guard, auth or both limiters', async ({ assert }) => {
    await withRouter(async (router) => {
      const auth = namedAuth(router)
      const valid = { auth, guard: 'web', startLimiter, stopLimiter }
      const cases: Array<[Record<string, unknown>, string]> = [
        [{ ...valid, guard: undefined }, 'requires the raw guard name'],
        [{ ...valid, guard: '' }, 'requires the raw guard name'],
        [{ ...valid, auth: undefined }, 'requires the host auth middleware'],
        [{ ...valid, startLimiter: undefined }, 'requires a start limiter and a stop limiter'],
        [{ ...valid, stopLimiter: undefined }, 'requires a start limiter and a stop limiter'],
        [{ ...valid, stopLimiter: startLimiter }, 'requires separate start and stop limiters'],
        [{ ...valid, prefix: 'masquerade' }, 'prefix must start with /'],
        [{ ...valid, auth: () => startLimiter }, 'auth must be the named auth middleware'],
        [{ ...valid, auth: () => auth({ guards: ['web_effective'] }) }, 'named auth middleware'],
        [{ ...valid, auth: () => auth() }, 'named auth middleware'],
      ]
      for (const [options, message] of cases)
        assert.throws(
          () =>
            masqueradeRoutes(router, options as unknown as Parameters<typeof masqueradeRoutes>[1]),
          message
        )
      router.commit()
      assert.deepEqual(router.toJSON().root ?? [], [])
    })
  })
})
