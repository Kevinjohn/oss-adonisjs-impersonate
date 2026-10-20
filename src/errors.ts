import type { HttpContext } from '@adonisjs/core/http'

export const errorDetails = {
  E_MASQUERADE_UNAUTHENTICATED: [401, 'Actor authentication required'],
  E_MASQUERADE_NOT_ALLOWED: [403, 'Masquerade is not allowed'],
  E_MASQUERADE_ACTION_BLOCKED: [403, 'Action is blocked while masquerading'],
  E_MASQUERADE_ALREADY_ACTIVE: [409, 'Masquerade is already active'],
  E_MASQUERADE_CONTEXT_CHANGED: [409, 'Masquerade context changed'],
  E_MASQUERADE_INVALID_INPUT: [422, 'Invalid masquerade input'],
  E_MASQUERADE_CONTEXT_REQUIRED: [428, 'Masquerade context required'],
  E_MASQUERADE_UNAVAILABLE: [503, 'Masquerade is unavailable'],
} as const
export type MasqueradeErrorCode = keyof typeof errorDetails

export type MasqueradeSetupErrorCode =
  'E_MASQUERADE_INVALID_CONFIGURATION' | 'E_MASQUERADE_INVALID_STORE'

export type MasqueradeSetupErrorField =
  | 'config'
  | 'authority'
  | 'authority.namespace'
  | 'authority.guard'
  | 'authority.incarnation'
  | 'authority.securityStamp'
  | 'authority.inspectAccount'
  | 'policy'
  | 'policy.canMasquerade'
  | 'policy.canUseRequest'
  | 'store'
  | 'store.testOnly'
  | 'store.read'
  | 'store.compareAndSet'
  | 'store.recordControlOutcome'
  | 'store.expiredBatch'
  | 'store.pruneEvents'
  | 'durationSeconds'
  | 'maxDurationSeconds'
  | 'contextEnforcement'
  | 'retention'
  | 'retention.days'

/** Safe setup diagnostics for synchronous configuration and store contract failures. */
export class MasqueradeSetupError extends TypeError {
  constructor(
    readonly code: MasqueradeSetupErrorCode,
    readonly field: MasqueradeSetupErrorField
  ) {
    super(
      code === 'E_MASQUERADE_INVALID_CONFIGURATION'
        ? 'Invalid masquerade configuration'
        : 'Invalid masquerade store for environment'
    )
    this.name = 'MasqueradeSetupError'
  }
}

export class MasqueradeError extends Error {
  readonly status: number
  constructor(readonly code: MasqueradeErrorCode) {
    super(errorDetails[code][1])
    this.name = 'MasqueradeError'
    this.status = errorDetails[code][0]
  }

  handle(_error: unknown, ctx: HttpContext): void {
    ctx.response.header('Cache-Control', 'no-store')
    ctx.response.vary(['Accept', 'X-Masquerade-Context'])
    ctx.response.status(this.status).json({
      errors: [{ code: this.code, message: this.message }],
    })
  }
}
export function unavailable(): MasqueradeError {
  return new MasqueradeError('E_MASQUERADE_UNAVAILABLE')
}
export function invalidInput(): MasqueradeError {
  return new MasqueradeError('E_MASQUERADE_INVALID_INPUT')
}
