/** Canonical provider identifier and UTC ISO 8601 timestamp. */
export type SubjectId = string
export type Instant = string
export type Revision = number
export type ContextToken = string
export interface Subject<User> {
  id: SubjectId
  incarnation: string
  user: User
}
export interface AccountSnapshot<User> {
  subject: Subject<User>
  securityStamp: string
  active: boolean
}
export interface NativeAuthority<User> {
  namespace: string
  guard: string
  incarnation: 'id' | ((user: User) => string)
  securityStamp(user: User): string | Promise<string>
  inspectAccount(id: SubjectId): Promise<AccountSnapshot<User> | null>
}
export interface MasqueradePolicy<User, Request> {
  canMasquerade(input: {
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
  targetId: SubjectId
  targetIncarnation: string
  actorStampHash: string
  targetStampHash: string
  reason: string
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
  at: Instant
  kind: EventKind
  outcomeCode: string
  revision: Revision
  reason?: string
}
export type ObserverEvent = Readonly<Omit<AuditEvent, 'reason'>>
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
  read(owner: OwnerKey): Promise<ModeRow | null>
  compareAndSet(input: CompareAndSetInput): Promise<CasOutcome>
  recordControlOutcome(event: AuditEvent): Promise<void>
  expiredBatch(input: { now: Instant; limit: number }): Promise<ModeRow[]>
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
}
export interface StartInput {
  targetId: string | number
  reason: string
  durationSeconds?: number
  expectedContext: ContextToken
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
    error(event: { code: string; transitionId: string }): unknown
  }
  observerErrorHandler: (error: unknown) => unknown
}
