import { test } from '@japa/runner'
import { errors, symbols } from '@adonisjs/auth'
import type { GuardContract } from '@adonisjs/auth/types'
import type { HttpContext } from '@adonisjs/core/http'
import { EffectiveSessionGuard } from '../auth/effective_session_guard.js'

test('raw/public requests authenticate natively without reading mode state', async ({ assert }) => {
  let runtimeResolutions = 0
  let modeReads = 0
  let rawAuthentications = 0
  const actor = { id: 'actor' }
  const raw = {
    driverName: 'session',
    async authenticate() {
      rawAuthentications++
      return actor
    },
    authenticateAsClient: async (user: typeof actor) => ({ session: { userId: user.id } }),
  } as unknown as GuardContract<typeof actor>
  const ctx = {
    auth: {
      use: (name: string) => {
        assert.equal(name, 'web')
        return raw
      },
    },
    containerResolver: {
      make: async () => {
        runtimeResolutions++
        return {
          effectiveGuardName: 'web_effective',
          effectiveGuardNames: ['web_effective'],
          admit: async () => {
            modeReads++
            throw new Error('store offline')
          },
        }
      },
    },
  } as unknown as HttpContext
  const guard = new EffectiveSessionGuard('web_effective', 'web', ctx, raw)
  assert.isTrue(await guard.check())
  assert.strictEqual(guard.user, actor)
  assert.equal(rawAuthentications, 1)
  ctx.route = {
    middleware: { all: () => [{ name: 'auth', args: [{ guards: ['web'] }] }] },
  } as never
  const controlGuard = new EffectiveSessionGuard('web_effective', 'web', ctx, raw)
  assert.isTrue(await controlGuard.check())
  assert.strictEqual(controlGuard.user, actor)
  assert.equal(rawAuthentications, 2)
  assert.equal(modeReads, 0)
  assert.equal(runtimeResolutions, 2)
  assert.equal(guard.driverName, 'session')
  assert.deepEqual(await guard.authenticateAsClient(actor), { session: { userId: 'actor' } })
  assert.isTrue(Object.hasOwn(guard, symbols.GUARD_KNOWN_EVENTS))
})

test('only a genuine native unauthorized error becomes false', async ({ assert }) => {
  const native = new errors.E_UNAUTHORIZED_ACCESS('Authentication required', {
    guardDriverName: 'session',
  })
  let failure: unknown = native
  const raw = {
    driverName: 'session',
    authenticate: async () => {
      throw failure
    },
  } as unknown as GuardContract<unknown>
  const ctx = {
    auth: { use: () => raw },
    containerResolver: {
      make: async () => ({
        effectiveGuardName: 'web_effective',
        effectiveGuardNames: ['web_effective'],
      }),
    },
  } as unknown as HttpContext
  const guard = new EffectiveSessionGuard('web_effective', 'web', ctx, raw)
  assert.isFalse(await guard.check())
  assert.isTrue(guard.authenticationAttempted)
  assert.isFalse(guard.isAuthenticated)
  failure = Object.assign(new Error('policy error'), { code: 'E_UNAUTHORIZED_ACCESS' })
  await assert.rejects(() => guard.check(), 'policy error')
  assert.isUndefined(guard.user)
})

import { Authenticator } from '@adonisjs/auth'
import { HttpContextFactory } from '@adonisjs/core/factories/http'
import { MasqueradeError } from '../src/errors.js'

test('business guard owns the facade while the raw guard retains actor identity; failures never fall back', async ({
  assert,
}) => {
  const actor = { id: 'actor' }
  const target = { id: 'target' }
  const ctx = new HttpContextFactory().create()
  ctx.route = {
    middleware: { all: () => [{ name: 'auth', args: [{ guards: ['web_effective'] }] }] },
  } as never
  const raw: GuardContract<typeof actor> = {
    [symbols.GUARD_KNOWN_EVENTS]: undefined,
    driverName: 'session',
    user: actor,
    isAuthenticated: true,
    authenticationAttempted: true,
    authenticate: async () => actor,
    check: async () => true,
    getUserOrFail: () => actor,
    authenticateAsClient: async () => ({}),
  }
  let failure: MasqueradeError | undefined
  ctx.containerResolver.bindValue('masquerade.runtime', {
    admit: async () => {
      if (failure) throw failure
      return { actor: { user: actor }, effective: { user: target } }
    },
  } as never)
  const auth = new Authenticator(ctx, {
    default: 'web_effective',
    guards: {
      web: () => raw,
      web_effective: () => new EffectiveSessionGuard('web_effective', 'web', ctx, raw),
    },
  })
  ctx.auth = auth as never
  assert.isTrue(await auth.check())
  assert.strictEqual(auth.user, target)
  assert.strictEqual(auth.getUserOrFail(), target)
  assert.equal(auth.authenticatedViaGuard, 'web_effective')
  assert.strictEqual(auth.use('web').user, actor)
  failure = new MasqueradeError('E_MASQUERADE_CONTEXT_CHANGED')
  await assert.rejects(() => auth.check(), 'Masquerade context changed')
  assert.isUndefined(auth.use('web_effective').user)
  assert.isFalse(auth.use('web_effective').isAuthenticated)
  assert.strictEqual(auth.use('web').user, actor)
})

test('effective wrapper rejects non-session native drivers', ({ assert }) => {
  assert.throws(
    () =>
      new EffectiveSessionGuard(
        'web_effective',
        'api',
        {} as HttpContext,
        { driverName: 'access_tokens' } as GuardContract<unknown>
      ),
    'Masquerade requires a native session guard'
  )
})
