import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { registerHooks } from 'node:module'
import { IgnitorFactory } from '@adonisjs/core/factories'
import type { ApplicationService } from '@adonisjs/core/types'
import type { Router } from '@adonisjs/core/http'
import type { HttpContext } from '@adonisjs/core/http'
import { test } from '@japa/runner'
import AccountKitProvider from '../account_kit/provider.js'
import AccountKitBlocker from '../account_kit/middleware.js'
import { hasVerifiedAccountKitBlocker } from '../integration/account_kit_status.js'

function canLoadKit(): boolean {
  if (process.env.ACCOUNT_KIT_SOURCE) return true
  try {
    import.meta.resolve('adonisjs-account-kit/http')
    return true
  } catch {
    return false
  }
}

if (process.env.ACCOUNT_KIT_SOURCE) {
  const entry = pathToFileURL(resolve(process.env.ACCOUNT_KIT_SOURCE, 'build/http/main.js')).href
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === 'adonisjs-account-kit/http') return { url: entry, shortCircuit: true }
      return nextResolve(specifier, context)
    },
  })
}

async function register(router: Router, name = 'web', strategy = 'session'): Promise<void> {
  const packagePath = 'adonisjs-account-kit/http'
  const kit = await import(packagePath)
  kit.registerManagedRoutes(router, {
    prefix: '/kit',
    kit: async () => ({}),
    guard: { strategy, name, forRequest: () => ({}), current: async () => ({}) },
    enabled: ['passwordReset'],
  })
}

async function fixture(
  options: { blocker?: boolean; inlineBlocker?: boolean; name?: string; strategy?: string } = {}
) {
  const app = new IgnitorFactory()
    .withCoreProviders()
    .withCoreConfig()
    .create(new URL('../', import.meta.url))
    .createApp('web')
  await app.init()
  await app.boot()
  const router = await app.container.make('router')
  if (options.blocker !== false)
    router.use([
      options.inlineBlocker
        ? async () => ({ default: AccountKitBlocker })
        : () => import('../account_kit/middleware.js'),
    ])
  await register(router)
  const adapter = {
    authority: {
      namespace: 'users',
      incarnation: (user: { generation: string }) => user.generation,
    },
    provider: { createUserForGuard: async (_user: unknown) => ({ getId: () => 42 }) },
    authenticateActor: async () => {
      throw new Error('ability absent')
    },
    managedGuard: { name: options.name ?? 'web', strategy: options.strategy ?? 'session' },
    kit: async () => ({
      managedHttp: {
        assertGuard(guard: { name: string; strategy: string }) {
          if (guard.name !== 'web' || guard.strategy !== 'session')
            throw new TypeError('wrong guard')
        },
      },
    }),
  }
  const providerApp = {
    container: { make: async (key: string) => (key === 'router' ? router : adapter) },
  } as unknown as ApplicationService
  return { app, router, adapter, providerApp, provider: new AccountKitProvider(providerApp) }
}

async function block(
  host: Awaited<ReturnType<typeof fixture>>,
  name: string,
  options: { authenticated?: boolean; active?: boolean; failure?: 'guard' | 'store' } = {}
) {
  const reads: unknown[] = []
  let nextCalls = 0
  const user = { generation: 'second' }
  const ctx = {
    route: { name },
    auth: {
      use: () => {
        if (options.failure === 'guard') throw new Error('guard unavailable')
        return { user, check: async () => options.authenticated ?? true }
      },
    },
    containerResolver: {
      make: async (key: string) => {
        if (key === 'router') return host.router
        if (key === 'masquerade.native') return host.adapter
        if (key === 'masquerade.runtime')
          return {
            activeMode: async (owner: unknown) => {
              reads.push(owner)
              if (options.failure === 'store') throw new Error('store unavailable')
              return options.active ?? false
            },
          }
        throw new Error(`unexpected ${key}`)
      },
    },
  } as unknown as HttpContext
  const call = () =>
    new AccountKitBlocker().handle(ctx, async () => {
      nextCalls++
      return 'next'
    })
  return { call, reads, nextCalls: () => nextCalls }
}

test.group('Account Kit provider', () => {
  test('commits and verifies registered routes and installed blocker at ready', async ({
    assert,
  }) => {
    const host = await fixture()
    try {
      assert.isFalse(host.router.commited)
      await host.provider.ready()
      assert.isTrue(host.router.commited)
      assert.isTrue(hasVerifiedAccountKitBlocker(host.providerApp))
    } finally {
      await host.app.terminate()
    }
  }).skip(!canLoadKit(), 'requires installed Account Kit or ACCOUNT_KIT_SOURCE')

  test('recognizes an inline lazy loader for the same blocker class', async ({ assert }) => {
    const host = await fixture({ inlineBlocker: true })
    try {
      await host.provider.ready()
      assert.isTrue(hasVerifiedAccountKitBlocker(host.providerApp))
    } finally {
      await host.app.terminate()
    }
  }).skip(!canLoadKit(), 'requires installed Account Kit or ACCOUNT_KIT_SOURCE')

  test('does not invoke raw inline route middleware while verifying blocker installation', async ({
    assert,
  }) => {
    const host = await fixture()
    try {
      host.router.commit()
      let calls = 0
      const rawRequestMiddleware = async () => {
        calls++
      }
      for (const route of host.router.toJSON().root ?? []) {
        if (!route.name?.startsWith('accountKit.')) continue
        const original = route.middleware.all.bind(route.middleware)
        route.middleware.all = () => new Set([...original(), rawRequestMiddleware])
      }
      await host.provider.ready()
      assert.equal(calls, 0)
      assert.isTrue(hasVerifiedAccountKitBlocker(host.providerApp))
    } finally {
      await host.app.terminate()
    }
  }).skip(!canLoadKit(), 'requires installed Account Kit or ACCOUNT_KIT_SOURCE')

  for (const [label, values] of [
    ['name', { name: 'wrong' }],
    ['strategy', { strategy: 'access_tokens' }],
  ] as const)
    test(`rejects mismatched managed guard ${label}`, async ({ assert }) => {
      const host = await fixture(values)
      try {
        await assert.rejects(() => host.provider.ready(), 'wrong guard')
      } finally {
        await host.app.terminate()
      }
    }).skip(!canLoadKit(), 'requires installed Account Kit or ACCOUNT_KIT_SOURCE')

  test('rejects a mounted managed route without the blocker', async ({ assert }) => {
    const host = await fixture({ blocker: false })
    try {
      await assert.rejects(() => host.provider.ready(), 'Account Kit blocker middleware is missing')
    } finally {
      await host.app.terminate()
    }
  }).skip(!canLoadKit(), 'requires installed Account Kit or ACCOUNT_KIT_SOURCE')

  test('rejects a mounted name absent from registration', async ({ assert }) => {
    const host = await fixture()
    try {
      host.router.get('/rogue', async () => {}).as('accountKit.rogue')
      await assert.rejects(
        () => host.provider.ready(),
        'Account Kit managed route accountKit.rogue is not registered'
      )
    } finally {
      await host.app.terminate()
    }
  }).skip(!canLoadKit(), 'requires installed Account Kit or ACCOUNT_KIT_SOURCE')

  for (const field of ['method', 'path'] as const)
    test(`rejects a registered route with a changed ${field}`, async ({ assert }) => {
      const host = await fixture()
      try {
        const packagePath = 'adonisjs-account-kit/http'
        const { managedRouteRegistration } = await import(packagePath)
        const registration = managedRouteRegistration(host.router)!
        const route = registration.routes[0] as { method: string; path: string }
        route[field] = field === 'method' ? 'DELETE' : '/wrong'
        await assert.rejects(
          () => host.provider.ready(),
          'Account Kit managed route accountKit.auth.csrf is not registered'
        )
      } finally {
        await host.app.terminate()
      }
    }).skip(!canLoadKit(), 'requires installed Account Kit or ACCOUNT_KIT_SOURCE')

  test('blocks an active actor without requiring masquerade token ability', async ({ assert }) => {
    const host = await fixture()
    try {
      host.router.commit()
      const attempt = await block(host, 'accountKit.auth.passwordReset.request', { active: true })
      try {
        await attempt.call()
        assert.fail('expected active route to block')
      } catch (error) {
        assert.equal((error as { code: string }).code, 'E_MASQUERADE_ACTION_BLOCKED')
        assert.equal((error as { blockedBy: string }).blockedBy, 'sensitive')
        assert.equal((error as { status: number }).status, 403)
      }
      assert.deepEqual(attempt.reads, [
        { namespace: 'users', actorId: '42', actorIncarnation: 'second' },
      ])
      assert.equal(attempt.nextCalls(), 0)
    } finally {
      await host.app.terminate()
    }
  }).skip(!canLoadKit(), 'requires installed Account Kit or ACCOUNT_KIT_SOURCE')

  test('passes idle, expired, exempt, unrelated and unauthenticated requests without extra reads', async ({
    assert,
  }) => {
    const host = await fixture()
    try {
      host.router.commit()
      for (const [name, options, expectedReads] of [
        ['accountKit.auth.passwordReset.request', { active: false }, 1],
        ['accountKit.auth.passwordReset.request', { authenticated: false }, 0],
        ['accountKit.account.logout', { active: true }, 0],
        ['accountKit.auth.csrf', { active: true }, 0],
        ['business.route', { active: true }, 0],
      ] as const) {
        const attempt = await block(host, name, options)
        assert.equal(await attempt.call(), 'next')
        assert.equal(attempt.reads.length, expectedReads)
      }
    } finally {
      await host.app.terminate()
    }
  }).skip(!canLoadKit(), 'requires installed Account Kit or ACCOUNT_KIT_SOURCE')

  test('maps raw guard and store failures to 503', async ({ assert }) => {
    const host = await fixture()
    try {
      host.router.commit()
      for (const failure of ['guard', 'store'] as const) {
        const attempt = await block(host, 'accountKit.auth.passwordReset.request', { failure })
        try {
          await attempt.call()
          assert.fail('expected unavailable route')
        } catch (error) {
          assert.equal((error as { code: string }).code, 'E_MASQUERADE_UNAVAILABLE')
          assert.equal((error as { status: number }).status, 503)
        }
      }
    } finally {
      await host.app.terminate()
    }
  }).skip(!canLoadKit(), 'requires installed Account Kit or ACCOUNT_KIT_SOURCE')
})
