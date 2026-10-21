import type { Data } from '@generated/data'

type PublicUser = { id: number; fullName: string; email: string }
type PublicMode =
  | { isMasquerading: false; contextToken: string }
  | { isMasquerading: true; contextToken: string; targetId: string; expiresAt: string }

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

/**
 * Bridge the shared props and flash data inferred from the Inertia
 * middleware into the Inertia client, so `usePage().props`, `usePage().flash`,
 * and layout callbacks are typed globally without passing a generic at each
 * call site.
 */
declare module '@inertiajs/core' {
  interface InertiaConfig {
    sharedPageProps: Data.SharedProps
    flashDataType: Data.FlashMessages
  }
}
