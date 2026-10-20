import { test } from '@japa/runner'
import { IncomingMessage } from 'node:http'
import { Socket } from 'node:net'
import { RequestFactory } from '@adonisjs/core/factories/http'
import { errors } from '@adonisjs/auth'
import { admission } from '../src/request_admission.js'
import type { RequestAdmission } from '../src/request_admission.js'
import type { MasqueradeService } from '../src/types.js'
import { MasqueradeController } from '../http/controllers.js'
import { masqueradeContext } from '../http/context_middleware.js'
import { contextField, shareMasquerade } from '../http/edge.js'
import { allowMutation } from '../integration/route_metadata.js'
import { fixture } from './helpers/core.js'

function requestContext(
  f: ReturnType<typeof fixture>,
  options: {
    method?: string
    body?: Record<string, unknown>
    raw?: string | null
    hasBody?: boolean
    contentType?: string
    contentLength?: string | null
    header?: string
    routeMiddleware?: unknown[]
    defaultGuard?: string
  }
) {
  const responseState: {
    status?: number
    json?: unknown
    headers: Map<string, string>
    varies: string[][]
  } = {
    headers: new Map(),
    varies: [],
  }
  const warnings: unknown[] = []
  const ctx: Record<string, any> = {
    actorId: 'a',
    auth: { defaultGuard: options.defaultGuard ?? 'web_effective' },
    route: {
      name: 'business.test',
      pattern: '/business',
      middleware: {
        all: () =>
          new Set(
            options.routeMiddleware ?? [{ name: 'auth', args: [{ guards: ['web_effective'] }] }]
          ),
      },
    },
    logger: { warn: (value: unknown) => warnings.push(value) },
    request: {
      method: () => options.method ?? 'POST',
      body: () => options.body ?? {},
      // Adonis BodyParser stores the actual JSON/form wire body on Request.raw().
      raw: () =>
        options.raw !== undefined
          ? options.raw
          : options.body && Object.keys(options.body).length > 0
            ? JSON.stringify(options.body)
            : null,
      hasBody: () =>
        options.hasBody ??
        (options.raw !== null && options.raw !== undefined
          ? options.raw.length > 0
          : Boolean(options.body && Object.keys(options.body).length > 0)),
      header: (name: string) => {
        const normalized = name.toLowerCase()
        if (normalized === 'x-masquerade-context') return options.header
        if (normalized === 'content-type') return options.contentType ?? 'application/json'
        if (normalized === 'content-length') {
          if (options.contentLength === null) return undefined
          return (
            options.contentLength ??
            String(Buffer.byteLength(options.raw ?? JSON.stringify(options.body ?? {})))
          )
        }
        return undefined
      },
    },
    response: {
      header: (name: string, value: string) => responseState.headers.set(name.toLowerCase(), value),
      vary: (value: string[]) => responseState.varies.push(value),
      status: (value: number) => {
        responseState.status = value
        return ctx.response
      },
      json: (value: unknown) => {
        responseState.json = value
      },
    },
    containerResolver: {
      make: async () => ({
        service: await f.create(),
        config: f.config,
        effectiveGuardName: 'web_effective',
        effectiveGuardNames: ['web_effective', 'web_alias'],
        admit: async (request: object) => {
          const service = await f.create()
          return (
            service as MasqueradeService<object> & {
              [admission]: (request: object) => Promise<RequestAdmission<unknown>>
            }
          )[admission](request)
        },
      }),
    },
  }
  return { ctx: ctx as never, responseState, warnings }
}

test.group('masquerade HTTP boundary', () => {
  test('rejects mixed native-effective and other guards before authentication or downstream fallback', async ({
    assert,
  }) => {
    for (const guards of [
      ['api', 'web_effective'],
      ['web_effective', 'api'],
      ['web_effective', 'default'],
    ]) {
      for (const missingNativeCredential of [false, true]) {
        const f = fixture()
        const service = await f.create()
        const mode = await service.status({})
        if (missingNativeCredential)
          f.dependencies.authenticateActor = async () => {
            throw new errors.E_UNAUTHORIZED_ACCESS('Native session missing', {
              guardDriverName: 'session',
            })
          }
        const before = f.state.authenticateCount
        const { ctx, responseState } = requestContext(f, {
          body: { _masqueradeContext: mode.contextToken },
          routeMiddleware: [{ name: 'auth', args: { guards } }],
        })
        let downstreamCalls = 0
        await masqueradeContext(ctx, async () => {
          downstreamCalls++
        })
        assert.equal(responseState.status, 503)
        assert.equal(downstreamCalls, 0)
        assert.equal(f.state.authenticateCount, before)
      }
    }
  })

  test('defers native authentication rendering to named auth without retrying downstream errors', async ({
    assert,
  }) => {
    const f = fixture()
    f.dependencies.authenticateActor = async () => {
      throw new errors.E_UNAUTHORIZED_ACCESS('Raw session missing', { guardDriverName: 'session' })
    }
    let reads = 0
    f.store.read = async () => {
      reads++
      return null
    }
    const { ctx, responseState } = requestContext(f, { method: 'GET' })
    let downstreamCalls = 0
    await assert.rejects(
      () =>
        masqueradeContext(ctx, async () => {
          downstreamCalls++
          throw new errors.E_UNAUTHORIZED_ACCESS('Named auth chooses rendering', {
            guardDriverName: 'session',
          })
        }),
      'Named auth chooses rendering'
    )
    assert.equal(downstreamCalls, 1)
    assert.equal(reads, 0)
    assert.equal(responseState.headers.get('cache-control'), 'no-store')
  })

  test('requires context on idle unsafe routes in report mode and ignores query state', async ({
    assert,
  }) => {
    const f = fixture()
    f.config.contextEnforcement = 'report'
    const { ctx, warnings } = requestContext(f, { body: {} })
    let continued = false
    await masqueradeContext(ctx, async () => {
      continued = true
    })
    assert.isTrue(continued)
    assert.equal((warnings[0] as { code: string }).code, 'E_MASQUERADE_CONTEXT_REQUIRED')
  })

  test('reports header and form token disagreement as stale context', async ({ assert }) => {
    const f = fixture()
    f.config.contextEnforcement = 'report'
    const service = await f.create()
    const mode = await service.status({})
    const { ctx, warnings } = requestContext(f, {
      body: { _masqueradeContext: mode.contextToken },
      header: `1.${'a'.repeat(32)}`,
    })
    let continued = false
    await masqueradeContext(ctx, async () => {
      continued = true
    })
    assert.isTrue(continued)
    assert.equal((warnings[0] as { code: string }).code, 'E_MASQUERADE_CONTEXT_CHANGED')
  })

  test('does not apply the control-body limit to covered business requests', async ({ assert }) => {
    const f = fixture()
    const service = await f.create()
    const mode = await service.status({})
    const payload = 'x'.repeat(9000)
    const { ctx } = requestContext(f, {
      body: { _masqueradeContext: mode.contextToken, payload },
    })
    let continued = false
    await masqueradeContext(ctx, async () => {
      continued = true
    })
    assert.isTrue(continued)
  })

  test('enforces mutations and preserves package error JSON and no-store headers', async ({
    assert,
  }) => {
    const f = fixture()
    const service = await f.create()
    await f.start(service)
    const mode = await service.status({})
    const { ctx, responseState } = requestContext(f, {
      body: { _masqueradeContext: mode.contextToken },
    })
    let continued = false
    await masqueradeContext(ctx, async () => {
      continued = true
    })
    assert.isFalse(continued)
    assert.equal(responseState.status, 403)
    assert.deepEqual(responseState.json, {
      errors: [
        { code: 'E_MASQUERADE_ACTION_BLOCKED', message: 'Action is blocked while masquerading' },
      ],
    })
    assert.equal(responseState.headers.get('cache-control'), 'no-store')
  })

  test('passes safe read requests and permits explicitly marked mutations', async ({ assert }) => {
    const f = fixture()
    const service = await f.create()
    await f.start(service)
    const mode = await service.status({})
    const token = mode.contextToken
    const { ctx: read } = requestContext(f, { method: 'GET' })
    let readContinued = false
    await masqueradeContext(read, async () => {
      readContinued = true
    })
    assert.isTrue(readContinued)

    const { ctx: mutation } = requestContext(f, {
      body: { _masqueradeContext: token },
      routeMiddleware: [{ name: 'auth', args: [{ guards: ['web_effective'] }] }, allowMutation()],
    })
    let mutationContinued = false
    await masqueradeContext(mutation, async () => {
      mutationContinued = true
    })
    assert.isTrue(mutationContinued)
  })

  test('routes malformed control input through core auditing and renders the public error', async ({
    assert,
  }) => {
    const f = fixture()
    const { ctx, responseState } = requestContext(f, {
      body: { targetId: 'b', reason: 'ok', unexpected: true },
    })
    const controller = new MasqueradeController()
    await controller.start(ctx)
    assert.equal(responseState.status, 422)
    assert.equal(f.store.events.at(-1)?.kind, 'start_denied')
    assert.equal(f.store.events.at(-1)?.outcomeCode, 'E_MASQUERADE_INVALID_INPUT')
    assert.equal(responseState.headers.get('cache-control'), 'no-store')
  })

  test('accepts Shield form transport without treating its CSRF field as package input', async ({
    assert,
  }) => {
    const f = fixture()
    const { ctx, responseState } = requestContext(f, {
      body: { _csrf: 'host-csrf-token' },
      contentType: 'application/x-www-form-urlencoded',
      raw: '_csrf=host-csrf-token',
    })
    await new MasqueradeController().stop(ctx)
    assert.equal(responseState.status, 428)
    assert.equal(f.store.events.at(-1)?.kind, 'stop_denied')
    assert.equal(f.store.events.at(-1)?.outcomeCode, 'E_MASQUERADE_CONTEXT_REQUIRED')
  })

  test('rejects controls above 8 KiB using the actual URL-encoded wire length', async ({
    assert,
  }) => {
    const f = fixture()
    const service = await f.create()
    const mode = await service.status({})
    const body = { _masqueradeContext: mode.contextToken, _csrf: 'csrf' }
    const { ctx, responseState } = requestContext(f, {
      body,
      contentType: 'application/x-www-form-urlencoded',
      raw: `%5FmasqueradeContext=${encodeURIComponent(mode.contextToken)}&${'a='.repeat(4300)}`,
    })
    await new MasqueradeController().stop(ctx)
    assert.equal(responseState.status, 422)
    assert.equal(f.store.events.at(-1)?.kind, 'stop_denied')
    assert.equal(f.store.events.at(-1)?.outcomeCode, 'E_MASQUERADE_INVALID_INPUT')
  })

  test('accepts an empty header-only stop request', async ({ assert }) => {
    const f = fixture()
    const service = await f.create()
    const mode = await service.status({})
    const { ctx, responseState } = requestContext(f, {
      method: 'POST',
      body: {},
      raw: null,
      contentLength: '0',
      header: mode.contextToken,
    })
    await new MasqueradeController().stop(ctx)
    assert.equal(responseState.status, 200)
    assert.isFalse((responseState.json as { isMasquerading: boolean }).isMasquerading)
  })

  test('accepts canonical form duration strings but keeps JSON number validation strict', async ({
    assert,
  }) => {
    const f = fixture()
    const service = await f.create()
    const mode = await service.status({})
    const form = {
      targetId: 'b',
      reason: 'support',
      durationSeconds: '900',
      _masqueradeContext: mode.contextToken,
    }
    const formRaw = new URLSearchParams(form).toString()
    const { ctx: formRequest, responseState: formResponse } = requestContext(f, {
      body: form,
      contentType: 'application/x-www-form-urlencoded',
      raw: formRaw,
    })
    await new MasqueradeController().start(formRequest)
    assert.equal(formResponse.status, 200)
    assert.equal(
      Date.parse((formResponse.json as { expiresAt: string }).expiresAt) - f.state.now,
      900_000
    )

    const jsonFixture = fixture()
    const jsonService = await jsonFixture.create()
    const jsonMode = await jsonService.status({})
    const { ctx: jsonRequest, responseState: jsonResponse } = requestContext(jsonFixture, {
      body: { ...form, _masqueradeContext: jsonMode.contextToken },
      contentType: 'application/json',
    })
    await new MasqueradeController().start(jsonRequest)
    assert.equal(jsonResponse.status, 422)
    assert.equal(jsonFixture.store.events.at(-1)?.outcomeCode, 'E_MASQUERADE_INVALID_INPUT')

    const noncanonicalFixture = fixture()
    const noncanonicalService = await noncanonicalFixture.create()
    const noncanonicalMode = await noncanonicalService.status({})
    const noncanonical = {
      ...form,
      durationSeconds: '0900',
      _masqueradeContext: noncanonicalMode.contextToken,
    }
    const { ctx: noncanonicalRequest, responseState: noncanonicalResponse } = requestContext(
      noncanonicalFixture,
      {
        body: noncanonical,
        contentType: 'application/x-www-form-urlencoded',
        raw: new URLSearchParams(noncanonical).toString(),
      }
    )
    await new MasqueradeController().start(noncanonicalRequest)
    assert.equal(noncanonicalResponse.status, 422)
    assert.equal(noncanonicalFixture.store.events.at(-1)?.outcomeCode, 'E_MASQUERADE_INVALID_INPUT')
  })

  test('does not treat chunked unsupported-content bodies as empty stop requests', async ({
    assert,
  }) => {
    const f = fixture()
    const service = await f.create()
    const mode = await service.status({})
    const { ctx, responseState } = requestContext(f, {
      body: {},
      raw: null,
      hasBody: true,
      contentLength: null,
      contentType: 'text/plain',
      header: mode.contextToken,
    })
    await new MasqueradeController().stop(ctx)
    assert.equal(responseState.status, 422)
    assert.equal(f.store.events.at(-1)?.outcomeCode, 'E_MASQUERADE_INVALID_INPUT')
  })

  test('returns unavailable when recording an invalid-control audit fails', async ({ assert }) => {
    const f = fixture()
    f.store.recordControlOutcome = async () => {
      throw new Error('audit unavailable')
    }
    const { ctx, responseState } = requestContext(f, { body: { unexpected: true } })
    await new MasqueradeController().start(ctx)
    assert.equal(responseState.status, 503)
    assert.deepEqual(responseState.json, {
      errors: [{ code: 'E_MASQUERADE_UNAVAILABLE', message: 'Masquerade is unavailable' }],
    })
  })

  test('skips explicit raw-guard routes without reading masquerade state', async ({ assert }) => {
    const f = fixture()
    let storeReads = 0
    const read = f.store.read.bind(f.store)
    f.store.read = async (owner) => {
      storeReads++
      return read(owner)
    }
    const { ctx } = requestContext(f, {
      routeMiddleware: [{ name: 'auth', args: { guards: ['web'] } }],
    })
    let runtimeCalls = 0
    ;(
      ctx as { containerResolver: { make(name: string): Promise<unknown> } }
    ).containerResolver.make = async () => {
      runtimeCalls++
      return {
        effectiveGuardName: 'web_effective',
        effectiveGuardNames: ['web_effective'],
      }
    }
    let continued = false
    await masqueradeContext(ctx, async () => {
      continued = true
    })
    assert.isTrue(continued)
    assert.equal(runtimeCalls, 1)
    assert.equal(storeReads, 0)
  })

  test('enforces routes using an alias of the effective session guard', async ({ assert }) => {
    const f = fixture()
    const service = await f.create()
    await f.start(service)
    const mode = await service.status({})
    const { ctx, responseState } = requestContext(f, {
      body: { _masqueradeContext: mode.contextToken },
      routeMiddleware: [{ name: 'auth', args: { guards: ['web_alias'] } }],
    })
    let continued = false
    await masqueradeContext(ctx, async () => {
      continued = true
    })
    assert.isFalse(continued)
    assert.equal(responseState.status, 403)
  })

  test('accepts Content-Length zero using the native request body detection', async ({
    assert,
  }) => {
    const f = fixture()
    const service = await f.create()
    const mode = await service.status({})
    const { ctx, responseState } = requestContext(f, {})
    const incoming = new IncomingMessage(new Socket())
    incoming.headers = { 'content-length': '0', 'x-masquerade-context': mode.contextToken }
    const request = new RequestFactory().merge({ req: incoming, method: 'POST' }).create()
    request.updateBody({})
    assert.isTrue(request.hasBody())
    Object.defineProperty(ctx, 'request', { value: request })
    await new MasqueradeController().stop(ctx)
    assert.equal(responseState.status, 200)
    assert.equal(f.store.events[0].kind, 'control_noop')

    const chunked = new IncomingMessage(new Socket())
    chunked.headers = {
      'transfer-encoding': 'chunked',
      'content-type': 'application/octet-stream',
      'x-masquerade-context': mode.contextToken,
    }
    const chunkedRequest = new RequestFactory().merge({ req: chunked, method: 'POST' }).create()
    chunkedRequest.updateBody({})
    assert.isTrue(chunkedRequest.hasBody())
    const rejected = requestContext(f, {})
    Object.defineProperty(rejected.ctx, 'request', { value: chunkedRequest })
    await new MasqueradeController().stop(rejected.ctx)
    assert.equal(rejected.responseState.status, 422)
    assert.equal(f.store.events[1].kind, 'stop_denied')
  })

  test('renders an escaped hidden context field from a safe view', ({ assert }) => {
    assert.equal(
      contextField({ isMasquerading: false, contextToken: '0.' + 'a'.repeat(64) }),
      `<input type="hidden" name="_masqueradeContext" value="0.${'a'.repeat(64)}">`
    )
  })

  test('shares Edge state from the memoized admission snapshot without rereading storage', async ({
    assert,
  }) => {
    const f = fixture()
    let reads = 0
    const read = f.store.read.bind(f.store)
    f.store.read = async (owner) => {
      reads++
      return read(owner)
    }
    const { ctx } = requestContext(f, { method: 'GET' })
    let shared: Record<string, unknown> | undefined
    ;(ctx as { view: { share(value: Record<string, unknown>): void } }).view = {
      share: (value) => {
        shared = value
      },
    }
    const mode = await shareMasquerade(ctx)
    assert.equal(reads, 1)
    assert.deepEqual(shared?.masquerade, mode)
  })
})
