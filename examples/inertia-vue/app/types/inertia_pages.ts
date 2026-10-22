type PublicUser = { id: number; fullName: string; email: string }
type PublicMode =
  | { isMasquerading: false; contextToken: string }
  | {
      isMasquerading: true
      access: 'view' | 'edit'
      contextToken: string
      targetId: string
      expiresAt: string
    }

declare module '@adonisjs/inertia/types' {
  interface InertiaPages {
    'support/workspace': {
      actor: PublicUser
      operator: boolean
      mode: PublicMode
      customers: PublicUser[]
      target: PublicUser | null
      beforeDeadline: boolean
      targetAvailable: boolean
    }
    'support/customer': {
      actor: PublicUser
      customer: PublicUser
      mode: Extract<PublicMode, { isMasquerading: true }>
      emailUpdates: boolean
      canEdit: boolean
    }
    'support/recovery': { message: string }
  }
}
