import type { MasqueradeErrorCode } from './errors.js'

/** Canonical provider identifier and UTC ISO 8601 timestamp. */
export type SubjectId = string
export type Instant = string
export type Revision = number
export type ContextToken = string
export type ModeAccess = 'view' | 'edit'
export interface Subject<User> {
  id: SubjectId
  incarnation: string
  user: User
}
export interface AccountSnapshot<User> {
  subject: Subject<User>
  /** Current account epoch; must match `securityStamp(subject.user)` for the same account state. */
  securityStamp: string
  active: boolean
}
/**
 * Host-owned account inspection, separate from native credential authentication.
 * IDs are canonical provider IDs; incarnation identifies an immutable account lifetime.
 * securityStamp is captured at start; inspectAccount's snapshot stamp is checked on each active
 * admission. Both values must represent the same current account epoch. A missing account is null,
 * while operational failures reject. It never authenticates a target.
 */
export interface NativeAuthority<User> {
  namespace: string
  guard: string
  incarnation: 'id' | ((user: User) => string)
  securityStamp(user: User): string | Promise<string>
  inspectAccount(id: SubjectId): Promise<AccountSnapshot<User> | null>
}
/** Global eligibility, optional edit permission and request-local access; only literal true permits access. */
export interface MasqueradePolicy<User, Request> {
  canMasquerade(input: {
    actor: Subject<User>
    target: Subject<User>
    reason?: string
    request?: Request
  }): boolean | Promise<boolean>
  /** Required to start or continue edit access; absent denies edit. */
  canEdit?(input: {
    actor: Subject<User>
    target: Subject<User>
    reason?: string
    request?: Request
  }): boolean | Promise<boolean>
  canUseRequest?(input: {
    actor: Subject<User>
    target: Subject<User>
    request: Request
  }): boolean | Promise<boolean>
}
export interface OwnerKey {
  namespace: string
  actorId: SubjectId
  actorIncarnation: string
}
interface RowBase extends OwnerKey {
  revision: Revision
  revisionNonce: string
  modeId: string
  lastTransitionId: string
  updatedAt: Instant
}
export interface IdleModeRow extends RowBase {
  state: 'idle'
  access: null
  targetId: null
  targetIncarnation: null
  actorStampHash: null
  targetStampHash: null
  reason: null
  startedAt: null
  expiresAt: null
}
export interface ActiveModeRow extends RowBase {
  state: 'active'
  access: ModeAccess
  targetId: SubjectId
  targetIncarnation: string
  actorStampHash: string
  targetStampHash: string
  /** Null when the host's reason policy is optional and no reason was given. */
  reason: string | null
  startedAt: Instant
  expiresAt: Instant
}
export type ModeRow = IdleModeRow | ActiveModeRow
export type EventKind =
  | 'started'
  | 'stopped'
  | 'expired'
  | 'invalidated'
  | 'start_denied'
  | 'stop_denied'
  | 'control_noop'
export interface AuditEvent extends OwnerKey {
  id: string
  modeId?: string
  targetId?: SubjectId
  targetIncarnation?: string
  /** Access level of the active row that produced this event. */
  access?: ModeAccess
  at: Instant
  kind: EventKind
  outcomeCode: string
  revision: Revision
  reason?: string
}
export type ObserverEvent = Readonly<Omit<AuditEvent, 'reason'>>
export type DiagnosticCategory =
  'configuration' | 'store' | 'authority' | 'policy' | 'control' | 'observer'
export type DiagnosticOperation =
  | 'validate'
  | 'open'
  | 'read'
  | 'compare_and_set'
  | 'record_control_outcome'
  | 'inspect_account'
  | 'security_stamp'
  | 'can_masquerade'
  | 'can_edit'
  | 'can_use_request'
  | 'start'
  | 'stop'
  | 'error_reporter'
export interface DiagnosticEvent {
  readonly category: DiagnosticCategory
  readonly operation: DiagnosticOperation
  readonly code: MasqueradeErrorCode
  readonly transitionId?: string
}
/** An indeterminate commit may have succeeded; callers recover through status, never blind retry. */
export type CasOutcome =
  | { status: 'applied'; transitionId: string }
  | { status: 'conflict' }
  | { status: 'indeterminate'; transitionId: string }
export interface CompareAndSetInput {
  owner: OwnerKey
  expected: Revision | null
  next: ModeRow
  event: AuditEvent
}
export interface ControlStore {
  /** Test stores must expose this flag so production boot rejects them. */
  readonly testOnly?: boolean
  /** Independent row snapshot for the complete owner key; null is authoritative absence. */
  read(owner: OwnerKey): Promise<ModeRow | null>
  /** Atomically match the expected revision (null means absent), replace the row and append its event. */
  compareAndSet(input: CompareAndSetInput): Promise<CasOutcome>
  /** Append a required denial/no-op outcome without changing the owner's row or revision. */
  recordControlOutcome(event: AuditEvent): Promise<void>
  /** At most limit expired active snapshots; pruning re-reads and uses CAS before clearing each. */
  expiredBatch(input: { now: Instant; limit: number }): Promise<ModeRow[]>
  /** At most limit active snapshots, oldest update first; operator commands re-read and use CAS. */
  activeBatch(input: { limit: number }): Promise<ModeRow[]>
  /** Delete at most limit events older than before. Never delete mode rows, including idle rows. */
  pruneEvents(input: { before: Instant; limit: number }): Promise<number>
}
export interface MasqueradeConfig<User, Request> {
  authority: NativeAuthority<User>
  policy: MasqueradePolicy<User, Request>
  store: () => Promise<ControlStore>
  durationSeconds?: number
  maxDurationSeconds?: number
  contextEnforcement: 'report' | 'enforce'
  retention: { days: number } | 'host-managed'
  /** Defaults to optional; required rejects a start without a reason. */
  reason?: 'optional' | 'required'
}
export interface StartInput {
  targetId: string | number
  /** Required only when the configured reason policy is required. */
  reason?: string
  durationSeconds?: number
  expectedContext: ContextToken
  /** Defaults to view; edit requires explicit host policy permission. */
  access?: ModeAccess
}
export interface StopInput {
  expectedContext: ContextToken
}
export type ModeView = Readonly<
  | { isMasquerading: false; contextToken: ContextToken }
  | {
      isMasquerading: true
      contextToken: ContextToken
      targetId: SubjectId
      /** Fixed access level of this active mode. */
      access: ModeAccess
      startedAt: Instant
      expiresAt: Instant
    }
>
export interface ResolvedContext {
  readonly namespace: string
  readonly actorId: SubjectId
  readonly actorIncarnation: string
  readonly effectiveId: SubjectId
  readonly effectiveIncarnation: string
  readonly isMasquerading: boolean
  readonly contextToken: ContextToken
  readonly modeId?: string
  /** Present exactly while masquerading. */
  readonly access?: ModeAccess
}
export interface MasqueradeService<Request> {
  start(request: Request, input: StartInput): Promise<ModeView>
  stop(request: Request, input: StopInput): Promise<ModeView>
  status(request: Request): Promise<ModeView>
  resolve(request: Request): Promise<ResolvedContext>
}
/** Runtime dependencies are ports, never serialisable application configuration. */
export interface ServiceDependencies<User, Request> {
  environment: string
  authenticateActor(request: Request): Promise<Subject<User>>
  clock?: () => Date
  emitter: { emit(name: string, event: ObserverEvent): unknown }
  logger: {
    info(event: ObserverEvent): unknown
    error(event: DiagnosticEvent): unknown
  }
  observerErrorHandler: (error: unknown) => unknown
}
