import '@adonisjs/inertia/types'

type Label = { id: number; fullName: string | null; email: string }
type Mode =
  | { isMasquerading: false; contextToken: string }
  | {
      isMasquerading: true
      contextToken: string
      targetId: string
      expiresAt: string
    }

declare module '@adonisjs/inertia/types' {
  export interface InertiaPages {
    'auth/login': Record<string, never>
    'auth/signup': Record<string, never>
    'errors/not_found': Record<string, never>
    'errors/server_error': Record<string, never>
    'home': Record<string, never>
    'support/workspace': {
      actor: Label
      operator: boolean
      mode: Mode
      customers: Label[]
      target: Label | null
      beforeDeadline: boolean
      targetAvailable: boolean
    }
    'support/customer': {
      actor: Label
      customer: Label
      mode: Extract<Mode, { isMasquerading: true }>
      emailUpdates: boolean
      canEdit: boolean
    }
    'support/recovery': { message: string }
  }
}
