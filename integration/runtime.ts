import type { HttpContext } from '@adonisjs/core/http'
import type { MasqueradeConfig, MasqueradeService, OwnerKey } from '../src/types.js'
import type { RequestAdmission } from '../src/request_admission.js'
import type { RouteGuardSelection } from './route_guard_selection.js'

export interface MasqueradeRuntime<User = unknown> {
  readonly service: MasqueradeService<HttpContext>
  readonly config: MasqueradeConfig<User, HttpContext>
  readonly effectiveGuardName: string
  readonly effectiveGuardNames: readonly string[]
  selectGuard(ctx: HttpContext): RouteGuardSelection
  admit(ctx: HttpContext): Promise<RequestAdmission<User>>
  activeMode(owner: OwnerKey): Promise<boolean>
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'masquerade.runtime': MasqueradeRuntime
  }
}

export function runtimeFor(ctx: HttpContext): Promise<MasqueradeRuntime> {
  return ctx.containerResolver.make('masquerade.runtime')
}
