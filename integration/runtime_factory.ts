import type {} from '@adonisjs/auth/auth_provider'
import type { HttpContext } from '@adonisjs/core/http'
import type { ApplicationService } from '@adonisjs/core/types'
import { defineConfig } from '../src/define_config.js'
import { createMasqueradeService } from '../src/service.js'
import { admission } from '../src/request_admission.js'
import type { RequestAdmission } from '../src/request_admission.js'
import type { MasqueradeConfig, ObserverEvent } from '../src/types.js'
import type { NativeRuntimeAdapter } from './native_binding.js'
import type { MasqueradeRuntime } from './runtime.js'
import { isEffectiveFactory } from './guard_registration.js'

type TransitionName =
  'masquerade:started' | 'masquerade:stopped' | 'masquerade:expired' | 'masquerade:invalidated'
declare module '@adonisjs/core/types' {
  interface EventsList {
    'masquerade:started': ObserverEvent
    'masquerade:stopped': ObserverEvent
    'masquerade:expired': ObserverEvent
    'masquerade:invalidated': ObserverEvent
  }
}
export interface RuntimeConfiguration {
  config: MasqueradeConfig<unknown, HttpContext>
  native: NativeRuntimeAdapter
  effectiveGuardName: string
  effectiveGuardNames: readonly string[]
}
/** Validate native wiring without constructing the store or authenticating a request. */
export async function runtimeConfiguration(app: ApplicationService): Promise<RuntimeConfiguration> {
  const config = defineConfig(app.config.get<MasqueradeConfig<unknown, HttpContext>>('masquerade'))
  const native = await app.container.make('masquerade.native')
  if (
    !native ||
    typeof native.authenticateActor !== 'function' ||
    native.authority?.namespace !== config.authority.namespace ||
    native.authority.guard !== config.authority.guard
  )
    throw new TypeError('Native masquerade binding must match configured namespace and guard')
  const auth = await app.container.make('auth.manager')
  if (typeof (auth.config.guards as Record<string, unknown>)[config.authority.guard] !== 'function')
    throw new TypeError('The configured raw session guard must be registered')
  const effectiveGuardName = String(auth.defaultGuard)
  if (!isEffectiveFactory(auth.config.guards[auth.defaultGuard]))
    throw new TypeError('The default auth guard must be the effective session guard')
  const effectiveGuardNames = Object.freeze(
    Object.entries(auth.config.guards)
      .filter(([, factory]) => isEffectiveFactory(factory))
      .map(([name]) => name)
  )
  return { config, native, effectiveGuardName, effectiveGuardNames }
}
export async function createRuntime(
  app: ApplicationService,
  wiring: RuntimeConfiguration
): Promise<MasqueradeRuntime> {
  const emitter = await app.container.make('emitter')
  const logger = await app.container.make('logger')
  const service = await createMasqueradeService(wiring.config, {
    environment: app.nodeEnvironment,
    authenticateActor: (ctx) => wiring.native.authenticateActor(ctx),
    emitter: { emit: (name, event) => emitter.emit(name as TransitionName, event) },
    logger: { info: (event) => logger.info(event), error: (event) => logger.error(event) },
    // Native emitter.emit dispatches listener rejection to its registered onError handler.
    // A failed logger, missing handler or throwing handler reaches this safe diagnostic fallback.
    observerErrorHandler: () => logger.error({ code: 'E_MASQUERADE_OBSERVER_FAILED' }),
  })
  const internal = service as typeof service & {
    [admission](ctx: HttpContext): Promise<RequestAdmission<unknown>>
  }
  return Object.freeze({
    service,
    config: wiring.config,
    effectiveGuardName: wiring.effectiveGuardName,
    effectiveGuardNames: wiring.effectiveGuardNames,
    admit: (ctx: HttpContext) => internal[admission](ctx),
  })
}
