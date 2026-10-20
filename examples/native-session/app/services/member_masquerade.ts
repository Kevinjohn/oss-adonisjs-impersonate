import { createMasqueradeService, defineConfig } from 'adonisjs-masquerade'
import { sessionAuthority } from 'adonisjs-masquerade/native'
import { LucidControlStore } from 'adonisjs-masquerade/stores/lucid'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import type Member from '#models/member'
import { memberProvider } from '#services/member_guard'

const native = sessionAuthority({
  namespace: 'alternate-members',
  guard: 'members',
  provider: memberProvider,
  incarnation: 'id',
  securityStamp: (member: Member) => member.securityStamp,
  isActive: (member: Member) => Boolean(member.active),
})

/** This alternate host integration exercises canonical provider IDs on a real native guard. */
export function memberMasquerade() {
  return createMasqueradeService(
    defineConfig<Member, HttpContext>({
      authority: native.authority,
      policy: {
        canMasquerade: ({ actor, target }) =>
          actor.user.active && target.user.active && actor.id !== target.id,
      },
      store: async () => new LucidControlStore(db.connection()),
      contextEnforcement: 'enforce',
      retention: 'host-managed',
    }),
    {
      environment: 'test',
      authenticateActor: native.authenticateActor,
      emitter: { emit() {} },
      logger: { info() {}, error() {} },
      observerErrorHandler() {},
    }
  )
}
