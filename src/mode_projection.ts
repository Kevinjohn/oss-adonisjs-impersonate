import { contextToken } from './context_token.js'
import type { RequestAdmission } from './request_admission.js'
import type { ModeRow, ModeView, OwnerKey, ResolvedContext, Subject } from './types.js'

export function modeView(owner: OwnerKey, row: ModeRow | null): ModeView {
  const token = contextToken(owner, row)
  return Object.freeze(
    row?.state === 'active'
      ? {
          isMasquerading: true,
          contextToken: token,
          targetId: row.targetId,
          startedAt: row.startedAt,
          expiresAt: row.expiresAt,
        }
      : { isMasquerading: false, contextToken: token }
  )
}

export function admittedProjection<User>(
  owner: OwnerKey,
  row: ModeRow | null,
  actor: Subject<User>,
  effective: Subject<User>
): RequestAdmission<User> {
  const context: ResolvedContext = Object.freeze({
    ...owner,
    effectiveId: effective.id,
    effectiveIncarnation: effective.incarnation,
    isMasquerading: row?.state === 'active',
    contextToken: contextToken(owner, row),
    ...(row?.state === 'active' ? { modeId: row.modeId } : {}),
  })
  return Object.freeze({
    context,
    view: modeView(owner, row),
    actor: subjectProjection(actor),
    effective: subjectProjection(effective),
  })
}

function subjectProjection<User>(subject: Subject<User>): Readonly<Subject<User>> {
  return Object.freeze({
    id: subject.id,
    incarnation: subject.incarnation,
    user: subject.user,
  })
}
