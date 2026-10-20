import { randomBytes, randomUUID } from 'node:crypto'
import { defineConfig } from './define_config.js'
import { contextToken, requireContext } from './context_token.js'
import { admittedProjection, modeView } from './mode_projection.js'
import { invalidInput, MasqueradeError, unavailable } from './errors.js'
import { openControlStore } from './control_store.js'
import { parseStartSelection, validateStartInputShape } from './start_input.js'
import { stampHash } from './security_stamp.js'
import { validateRow } from './row_validation.js'
import { validateSubject } from './subject_validation.js'
import {
  commitTransition,
  idleAfterTransition,
  nextRevision,
  UnknownCommit,
} from './mode_transition.js'
import { admission } from './request_admission.js'
import type { RequestAdmission } from './request_admission.js'
import type {
  ActiveModeRow,
  AuditEvent,
  ControlStore,
  EventKind,
  IdleModeRow,
  MasqueradeConfig,
  MasqueradeService,
  ModeRow,
  ModeView,
  OwnerKey,
  ServiceDependencies,
  StartInput,
  StopInput,
  Subject,
  AccountSnapshot,
  ResolvedContext,
} from './types.js'

export async function createMasqueradeService<User, Request extends object>(
  config: MasqueradeConfig<User, Request>,
  dependencies: ServiceDependencies<User, Request>
): Promise<MasqueradeService<Request>> {
  const validated = defineConfig(config)
  const store = await openControlStore(validated.store, dependencies.environment, [
    'read',
    'compareAndSet',
    'recordControlOutcome',
    'expiredBatch',
    'pruneEvents',
  ])
  if (typeof dependencies.authenticateActor !== 'function')
    throw new TypeError('Actor authentication resolver required')
  if (
    typeof dependencies.emitter?.emit !== 'function' ||
    typeof dependencies.logger?.info !== 'function' ||
    typeof dependencies.logger?.error !== 'function' ||
    typeof dependencies.observerErrorHandler !== 'function'
  )
    throw new TypeError('Observer and diagnostic ports required')
  return new CoreService(validated, dependencies, store)
}

class CoreService<User, Request extends object> implements MasqueradeService<Request> {
  #admitted = new WeakMap<Request, Promise<RequestAdmission<User>>>()
  constructor(
    private config: MasqueradeConfig<User, Request>,
    private dependencies: ServiceDependencies<User, Request>,
    private store: ControlStore
  ) {}
  private now(): string {
    try {
      const date = (this.dependencies.clock ?? (() => new Date()))()
      const value = date.toISOString()
      if (!/^\d{4}-/.test(value)) throw unavailable()
      return value
    } catch {
      throw unavailable()
    }
  }
  private async actor(request: Request): Promise<Subject<User>> {
    // Native authentication errors retain their native rendering and never enter the audit boundary.
    const subject = await this.dependencies.authenticateActor(request)
    try {
      return validateSubject(subject, this.config.authority)
    } catch {
      throw unavailable()
    }
  }
  private owner(actor: Subject<User>): OwnerKey {
    return {
      namespace: this.config.authority.namespace,
      actorId: actor.id,
      actorIncarnation: actor.incarnation,
    }
  }
  private async read(owner: OwnerKey): Promise<ModeRow | null> {
    try {
      return validateRow(await this.store.read(owner), owner)
    } catch {
      throw unavailable()
    }
  }
  private event(
    owner: OwnerKey,
    row: ModeRow | null,
    kind: EventKind,
    outcomeCode: string,
    reason?: string
  ): AuditEvent {
    return {
      ...owner,
      id: randomUUID(),
      ...(row ? { modeId: row.modeId } : {}),
      ...(row?.state === 'active'
        ? { targetId: row.targetId, targetIncarnation: row.targetIncarnation }
        : {}),
      at: this.now(),
      kind,
      outcomeCode,
      revision: row?.revision ?? 0,
      ...(reason === undefined ? {} : { reason }),
    }
  }
  private async outcome(
    owner: OwnerKey,
    row: ModeRow | null,
    kind: EventKind,
    code: string
  ): Promise<void> {
    try {
      await this.store.recordControlOutcome(this.event(owner, row, kind, code))
    } catch {
      throw unavailable()
    }
  }
  private async commit(
    owner: OwnerKey,
    previous: ModeRow | null,
    next: ModeRow,
    event: AuditEvent
  ): Promise<void> {
    const outcome = await commitTransition(this.store, this.dependencies, {
      owner,
      expected: previous?.revision ?? null,
      next,
      event,
    })
    if (outcome === 'conflict') {
      await this.read(owner)
      throw new MasqueradeError('E_MASQUERADE_CONTEXT_CHANGED')
    }
  }
  private async clear(
    owner: OwnerKey,
    row: ActiveModeRow,
    kind: 'stopped' | 'expired' | 'invalidated',
    code: string
  ): Promise<IdleModeRow> {
    const event = this.event(owner, row, kind, code)
    const next = idleAfterTransition(row, event)
    event.revision = next.revision
    await this.commit(owner, row, next, event)
    return next
  }
  private async inspect(id: string): Promise<AccountSnapshot<User> | null> {
    try {
      const snapshot = await this.config.authority.inspectAccount(id)
      if (!snapshot) return null
      validateSubject(snapshot.subject, this.config.authority)
      if (typeof snapshot.active !== 'boolean') throw unavailable()
      return snapshot
    } catch {
      throw unavailable()
    }
  }
  private eligibleActor(
    current: AccountSnapshot<User> | null,
    actor: Subject<User>
  ): current is AccountSnapshot<User> {
    return Boolean(
      current?.active &&
      current.subject.id === actor.id &&
      current.subject.incarnation === actor.incarnation
    )
  }
  private async allowed(
    actor: Subject<User>,
    target: Subject<User>,
    request?: Request,
    reason?: string
  ): Promise<boolean> {
    try {
      return (
        (await this.config.policy.canMasquerade({
          actor,
          target,
          ...(request === undefined ? {} : { request }),
          ...(reason === undefined ? {} : { reason }),
        })) === true
      )
    } catch {
      throw unavailable()
    }
  }
  private async local(
    actor: Subject<User>,
    target: Subject<User>,
    request: Request
  ): Promise<void> {
    if (!this.config.policy.canUseRequest) return
    let allowed
    try {
      allowed = await this.config.policy.canUseRequest({ actor, target, request })
    } catch {
      throw unavailable()
    }
    if (allowed !== true) throw new MasqueradeError('E_MASQUERADE_NOT_ALLOWED')
  }
  async status(request: Request): Promise<ModeView> {
    const actor = await this.actor(request)
    const owner = this.owner(actor)
    const row = await this.read(owner)
    nextRevision(row)
    return modeView(owner, row)
  }
  async start(request: Request, input: StartInput): Promise<ModeView> {
    const actor = await this.actor(request)
    const owner = this.owner(actor)
    let row: ModeRow | null = null
    try {
      row = await this.read(owner)
      validateStartInputShape(input)
      requireContext(input.expectedContext, contextToken(owner, row))
      nextRevision(row)
      if (row?.state === 'active' && this.now() >= row.expiresAt) {
        await this.clear(owner, row, 'expired', 'expired')
        throw new MasqueradeError('E_MASQUERADE_CONTEXT_CHANGED')
      }
      if (row?.state === 'active') throw new MasqueradeError('E_MASQUERADE_ALREADY_ACTIVE')
      const { targetId, reason, duration } = parseStartSelection(
        input,
        actor.id,
        this.config.durationSeconds!,
        this.config.maxDurationSeconds!
      )
      const currentActor = await this.inspect(actor.id)
      const target = await this.inspect(targetId)
      if (target?.subject.id === actor.id) throw invalidInput()
      if (!this.eligibleActor(currentActor, actor) || !target?.active)
        throw new MasqueradeError('E_MASQUERADE_NOT_ALLOWED')
      if (!(await this.allowed(currentActor.subject, target.subject, request, reason)))
        throw new MasqueradeError('E_MASQUERADE_NOT_ALLOWED')
      await this.local(currentActor.subject, target.subject, request)
      let actorHash: string
      let targetHash: string
      try {
        actorHash = stampHash(await this.config.authority.securityStamp(currentActor.subject.user))
        targetHash = stampHash(await this.config.authority.securityStamp(target.subject.user))
      } catch {
        throw unavailable()
      }
      const event = this.event(owner, row, 'started', 'started', reason)
      const next: ActiveModeRow = {
        ...owner,
        state: 'active',
        revision: nextRevision(row),
        revisionNonce: randomBytes(16).toString('hex'),
        modeId: randomUUID(),
        lastTransitionId: event.id,
        updatedAt: event.at,
        targetId: target.subject.id,
        targetIncarnation: target.subject.incarnation,
        actorStampHash: actorHash,
        targetStampHash: targetHash,
        reason,
        startedAt: event.at,
        expiresAt: new Date(Date.parse(event.at) + duration * 1000).toISOString(),
      }
      Object.assign(event, {
        modeId: next.modeId,
        targetId: next.targetId,
        targetIncarnation: next.targetIncarnation,
        revision: next.revision,
      })
      await this.commit(owner, row, next, event)
      return modeView(owner, next)
    } catch (error) {
      if (error instanceof UnknownCommit) throw error
      await this.outcome(
        owner,
        row,
        'start_denied',
        error instanceof MasqueradeError ? error.code : 'E_MASQUERADE_UNAVAILABLE'
      )
      throw error instanceof MasqueradeError ? error : unavailable()
    }
  }
  async stop(request: Request, input: StopInput): Promise<ModeView> {
    const actor = await this.actor(request)
    const owner = this.owner(actor)
    let row: ModeRow | null = null
    try {
      row = await this.read(owner)
      if (!input || Object.keys(input).some((key) => key !== 'expectedContext'))
        throw invalidInput()
      requireContext(input.expectedContext, contextToken(owner, row))
      nextRevision(row)
      if (!row || row.state === 'idle') {
        await this.outcome(owner, row, 'control_noop', 'idle')
        return modeView(owner, row)
      }
      return modeView(owner, await this.clear(owner, row, 'stopped', 'stopped'))
    } catch (error) {
      if (error instanceof UnknownCommit) throw error
      await this.outcome(
        owner,
        row,
        'stop_denied',
        error instanceof MasqueradeError ? error.code : 'E_MASQUERADE_UNAVAILABLE'
      )
      throw error instanceof MasqueradeError ? error : unavailable()
    }
  }
  async resolve(request: Request): Promise<ResolvedContext> {
    const admitted = await this[admission](request)
    return admitted.context
  }
  async [admission](request: Request): Promise<RequestAdmission<User>> {
    const memo = this.#admitted.get(request)
    if (memo) return memo
    const pending = this.admit(request)
    this.#admitted.set(request, pending)
    // A rejected request must never retry under the identity created by its own invalidation.
    return pending
  }
  private async admit(request: Request): Promise<RequestAdmission<User>> {
    const actor = await this.actor(request)
    const owner = this.owner(actor)
    const row = await this.read(owner)
    if (row?.revision === Number.MAX_SAFE_INTEGER) throw unavailable()
    let effective = actor
    if (row?.state === 'active') {
      let invalid: string | undefined
      if (this.now() >= row.expiresAt) {
        await this.clear(owner, row, 'expired', 'expired')
        throw new MasqueradeError('E_MASQUERADE_CONTEXT_CHANGED')
      }
      const currentActor = await this.inspect(actor.id)
      const target = await this.inspect(row.targetId)
      if (!this.eligibleActor(currentActor, actor)) invalid = 'actor_ineligible'
      else if (
        !target?.active ||
        target.subject.id !== row.targetId ||
        target.subject.incarnation !== row.targetIncarnation
      )
        invalid = 'target_ineligible'
      else {
        if (stampHash(currentActor.securityStamp) !== row.actorStampHash) invalid = 'actor_stamp'
        else if (stampHash(target.securityStamp) !== row.targetStampHash) invalid = 'target_stamp'
        else if (!(await this.allowed(currentActor.subject, target.subject)))
          invalid = 'policy_denied'
      }
      if (invalid) {
        await this.clear(owner, row, 'invalidated', invalid)
        throw new MasqueradeError('E_MASQUERADE_CONTEXT_CHANGED')
      }
      effective = target!.subject
      await this.local(currentActor!.subject, effective, request)
    }
    return admittedProjection(owner, row, actor, effective)
  }
}
