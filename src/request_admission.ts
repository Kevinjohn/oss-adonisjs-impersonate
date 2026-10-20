import type { ModeView, ResolvedContext, Subject } from './types.js'
/** Internal integration seam; deliberately absent from the root public API. */
export const admission = Symbol('requestAdmission')
export interface RequestAdmission<User> {
  readonly context: ResolvedContext
  readonly view: ModeView
  readonly actor: Readonly<Subject<User>>
  readonly effective: Readonly<Subject<User>>
}
