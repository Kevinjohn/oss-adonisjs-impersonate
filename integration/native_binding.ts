import type { HttpContext } from '@adonisjs/core/http'
import type { Subject } from '../src/types.js'

/** Model-erased container boundary; concrete adapters retain their own User typing. */
export interface NativeRuntimeAdapter {
  readonly authority: { readonly namespace: string; readonly guard: string }
  authenticateActor(ctx: HttpContext): Promise<Subject<unknown>>
}
declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'masquerade.native': NativeRuntimeAdapter
  }
}
