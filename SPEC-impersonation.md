# Technical specification: server-side account masquerade

**Status:** Detailed review draft, not an implementation approval.  
**Version:** 0.2  
**Date:** 19 October 2026  
**Product requirements:** [PRD-impersonation.md](PRD-impersonation.md)  
**Working package label:** `adonisjs-masquerade`; registry availability, repository name, version, and publication are undecided.

## 1. Reading contract and authority

This specification describes a new, independently maintained package for AdonisJS 7. Names and interfaces defined here are proposed APIs, not APIs that exist today. MUST, MUST NOT, SHOULD, and MAY have their usual requirements meaning. Product requirements take precedence over implementation suggestions; disagreements must be resolved in the documents before implementation.

The owner has settled the independent-package boundary, optional Account Kit integration, and server-side setting model. Duration/limiter defaults, storage implementation, transport coverage, and public API naming remain review proposals. The PRD document-review decisions are incorporated requirements, including mandatory normalized reasons, local versus global denial, audit boundaries, and native authentication compatibility. Remaining proposals still require review before implementation.

The central requirement is an account-level setting: an authenticated operator selects “masquerade as this user.” The server subsequently resolves that operator's effective application identity. Starting or stopping does **not** log in as the target, change the authenticated actor, replace a session as part of the mode transition, or mint target credentials. Ordinary native authentication may restore an actor session or maintain its cookies/remember-me token; masquerade must add no credential effects beyond that baseline.

This replaces the earlier browser-login-switch proposal. There is no saved administrator login to restore, no session enrollment protocol, no browser-session family registry, and no impersonation-specific cookie. Ordinary session and token authentication continue to identify the actor.

### 1.1 Agreed boundaries

- Own a new package; do not maintain a fork or depend on the previously assessed implementation.
- Remain usable with native AdonisJS Auth without Account Kit.
- Keep impersonation state, policy, expiry, and audit behavior outside Account Kit.
- Keep roles, tenancy, UI, user search, and application language in the host application.
- Follow open-source AdonisJS conventions. AdonisJS Plus compatibility is not a target.
- Keep actor and target identities separate. Never union their roles or permissions.
- This delivery creates specifications only. It does not authorize implementation, repository creation, issues, publication, deployment, or merging.

### 1.2 Decisions and remaining review assumptions

| ID | Decision / proposal | Consequence and review status |
|---|---|---|
| D01 | A mode is global to one actor within an application authority namespace. | All integrated sessions/devices see the same target on their next request. There is no per-tab or per-device override. |
| D02 | Ship native session and native opaque access-token actor integrations in v1. | Both preserve native actor authentication and add no mode-specific credential changes. Token capabilities must still constrain use. Custom/JWT guards remain an adapter extension, not a tested v1 claim. |
| D03 | Use a finite 15-minute default, configurable up to a hard 60-minute ceiling. | Activity never renews the deadline. A longer ceiling is a subsequent product decision. |
| D04 | Require a reason trimmed before validation, with 1–500 Unicode code points and at most 2,000 UTF-8 bytes after trimming. | Settled review decision. Reject whitespace-only input; reason text is sensitive and must not be logged indiscriminately. |
| D05 | Use a shared atomic control store; first maintained implementation is an optional Lucid SQL adapter for SQLite and PostgreSQL 16. | A custom store can satisfy the same contract. Memory is test-only. No additional Redis implementation is required for v1. |
| D06 | Require a public context token on every covered authenticated unsafe business request, including when no mode is active. | Applications must update forms/API clients. Explicit public/authentication/control exemptions are defined in section 5.2. This detects stale intent and is separate from authentication and CSRF. |
| D07 | A single credential's revocation does not clear an account-global mode. | That credential immediately loses access. Other independently valid credentials may continue until stop, expiry, account-security invalidation, or policy removal. |
| D08 | Capture actor and target security stamps at start; changing either ends the mode at next admission. | Native applications must expose meaningful security versions. Account Kit can supply its credential revision. |
| D09 | Deny unsafe target requests by default; only explicit ordinary mutation policies can allow them. | Sensitive actions, including billing mutations, remain blocked. HTTP method checks cannot guarantee absence of all side effects. |
| D10 | Do not transparently continue an invalidated target request as the actor. | Return a context-change response; the client reloads/reconfirms before another business action. |

## 2. Architecture and ownership

One product capability has the following implementation boundaries. These are dependency boundaries, not independently approved product initiatives.

| Boundary | Owns | Depends on |
|---|---|---|
| `masquerade-core` | Mode state machine, CAS semantics, policies, expiry, status, errors, audit contract | Ports only |
| `adonis-integration` | Provider, request context, effective guard, controllers, optional route registration | Core, Core 7, Auth 10 |
| `native-authority` | Validate the real actor credential; load identities; application security-stamp/access hooks | Adonis integration; Session 8 only for session transport |
| `sql-control-store` | Atomic mode/audit persistence, migration, retention, contract verification | Core store contract, optional Lucid 22 |
| `account-kit-adapter` | Actor credential checks and target account-access snapshots through public Account Kit APIs | Core authority contract, compatible Account Kit, selected actor transport |
| Host application | Explicit policies, identity namespace, UI, Bouncer abilities, tenant rules, route classification, action audit | Chosen integrations |

Dependency direction is external package → optional Account Kit adapter → Account Kit public API. Account Kit MUST NOT import or depend on this package. Selecting a native integration MUST NOT import Account Kit. Selecting a custom store MUST NOT import Lucid.

Recommended package exports, subject to the API review:

```text
.                         # config, service, domain types/errors, configure export
./types                   # public types only
./providers/masquerade_provider
./services/main           # application service
./auth                    # effective guard factory
./http                    # request middleware, error mapping, opt-in route registration
./native                  # native authority factories
./stores/lucid            # optional SQL implementation and schema helpers
./adapters/account-kit    # optional Account Kit integration
./testing/store-contract  # reusable persistence conformance suite
```

All runtime dependencies specific to optional integrations MUST be optional peers and lazily imported from the selected subpath. A packed native-only consumer MUST prove that importing the root does not resolve Account Kit or Lucid. Minimum peer versions are release claims to be established by floor/latest consumer tests, not inferred from this document's major-version labels.

### 2.1 Request flow

```text
Original credential (session cookie or bearer token)
  → authenticate actor using one explicitly selected native guard
  → validate that actor credential and ordinary actor access
  → read mode by (authority namespace, canonical actor ID)
  → validate mode stamps, expiry, continuation policy and credential capability
  → validate rendered/requested context for unsafe business actions
  → resolve effective user: target while active, actor while idle
  → ordinary application Bouncer/data-access checks use effective user
  → run the allowed business handler with immutable actor/effective audit context
```

Start, stop, status, and current-credential logout are control operations. They authenticate the **actor**, and do not depend on target authentication, target existence, or the effective guard succeeding. This is how a deleted or suspended target can never trap the operator in a mode.

## 3. Invariants

- **I01:** Every admission has a valid original actor credential. A stored mode never authenticates a request.
- **I02:** There is at most one active target per `(authorityNamespace, actorId)`.
- **I03:** Actor identity always comes from the selected authenticated guard, never request body/query/headers.
- **I04:** Effective target permissions never include the actor's administrator privileges.
- **I05:** A target is never logged in; no target session, remember-me token, or access token is created, modified, or revoked by masquerade.
- **I06:** Mode transitions introduce no actor credential refresh, replacement, revival, or lifetime extension. Ordinary native authentication, including remember-me recovery, retains its own behavior and expiration/revocation policy.
- **I07:** Each successful state transition atomically changes revision/context token and writes its authoritative audit event.
- **I08:** A stale expected revision cannot overwrite current mode, including an idle → active → idle cycle.
- **I09:** Mode expiry is fixed, UTC-based, and evaluated before business admission; `now >= expiresAt` is expired.
- **I10:** Policy denial, storage uncertainty, or validation failure never falls through to executing a business action under another identity.
- **I11:** Stop can clear the actor's own mode without loading the target or retaining permission to start a new one.
- **I12:** Single-session/token revocation denies that credential; account-wide stamp changes invalidate the account-global mode.
- **I13:** Transition observers cannot turn a committed success into a false failure or execute a second transition.
- **I14:** A read/status request never starts, renews, or selects another target. Expiry housekeeping may end an already invalid mode.
- **I15:** Process-local caches and locks are not authoritative across instances.
- **I16:** A request's identity snapshot is immutable after admission. Already admitted work is not retroactively revoked.
- **I17:** Neither control responses nor audit observers receive raw credentials, security stamps, or whole user records.
- **I18:** While active, sensitive actor/target account actions and billing mutations cannot be allowed by the ordinary mutation override.

## 4. Identity and policy contracts

The following declarations define semantic contracts. Implementations may improve names before API freeze, but MUST preserve the stated separation and failure behavior. Examples use `unknown`/generics to avoid coupling core to Lucid user models.

```ts
type SubjectId = string // canonical provider ID; not an email or display name
type Instant = string // validated UTC ISO 8601 with millisecond precision
type Revision = string // positive signed-BIGINT-range decimal integer, never a JS number
type ContextToken = string // public, integrity-protected identity-context assertion

interface Subject<User> {
  id: SubjectId
  incarnation: string // immutable account instance; never reused after deletion
  user: User // server-only model/identity, never automatically serialized
}

interface ActorCredential {
  guard: string
  transport: 'session' | 'access_tokens'
  // Adapter-owned reference; held in request memory only, never mode/audit/status.
  reference: unknown
}

interface AccountSnapshot<User> {
  subject: Subject<User>
  securityStamp: string | null
  active: boolean
}

interface ActorSnapshot<User> extends AccountSnapshot<User> {
  credential: ActorCredential
}

type RequestOperation = 'start' | 'stop' | 'status' | 'read' | 'mutate'

interface AuthorityPort<User, Request> {
  // Namespace is fixed server configuration for one identity domain.
  namespace: string
  authenticateActor(request: Request): Promise<ActorSnapshot<User>>
  inspectAccount(id: SubjectId, request: Request): Promise<AccountSnapshot<User> | null>
  authorizeCredential(input: {
    actor: ActorSnapshot<User>
    operation: RequestOperation
    request: Request
  }): Promise<boolean>
}

interface MasqueradePolicy<User, Request> {
  canStart(input: {
    actor: Subject<User>; target: Subject<User>; reason: string; request: Request
  }): Promise<boolean>
  // Global actor-target eligibility; independent of the current route/tenant selection.
  canContinue(input: {
    actor: Subject<User>; target: Subject<User>
  }): Promise<boolean>
  // Request-local tenant/route eligibility; denial leaves global mode intact.
  canUseRequest(input: {
    actor: Subject<User>; target: Subject<User>; request: Request
  }): Promise<boolean>
  classify(request: Request): 'read' | 'mutation' | 'sensitive'
  allowMutation?(input: {
    actor: Subject<User>; target: Subject<User>; request: Request
  }): Promise<boolean>
}
```

Configuration MUST require `canStart`, `canContinue`, `canUseRequest`, `classify`, and the selected authority's credential policy. Missing callbacks cause boot-time configuration errors, never allow-all defaults. A callback must return exactly `true` to allow. Throwing is an operational failure and is not interpreted as permission. The application may share a global actor-bound Bouncer ability between start/continue callbacks; request-local tenant/route checks belong in `canUseRequest` and ordinary effective-user authorization.

`canContinue` checks account-wide actor-target eligibility, including durable membership or entitlement changes that make that pairing globally invalid. It must not depend on the current route, selected tenant, device, or credential scope. A definitive false result invalidates global mode; a thrown error denies with 503 and leaves mode unchanged because global invalidity has not been established. `canUseRequest` checks the current request's tenant/route access: false returns 403 without clearing mode, and an exception returns 503 without clearing mode. A token missing a capability is similarly denied locally. Neither failure permits actor fallback. An actor's device requesting tenant B must not end a mode still valid in tenant A merely because that request cannot use the target there.

`inspectAccount` establishes eligibility and the current security version, not authentication. It MUST NOT demand a target session or target token. `active=false`, a missing account, or denied ordinary access means that subject is not eligible. Eligibility here is account-wide; request-local tenant/route restrictions belong in `canUseRequest`, not `active` or the account snapshot. By default both subjects must be active; the first release has no “allow unverified target” bypass.

The authority adapter MUST distinguish “account exists but no longer eligible” from an infrastructure failure internally. Public responses must not disclose target existence to unauthorized callers. Both prevent target admission.

### 4.1 Namespace, identifiers, and tenancy

- Namespace is a deployment configuration value representing an identity domain, not a request-supplied tenant selector.
- A subject also has an immutable account incarnation. All guards for that account must return the same incarnation. Applications guaranteeing canonical IDs are never reused may explicitly use that ID as incarnation; otherwise they supply a persisted random identity-instance value. It must not change on ordinary security updates. No new Account Kit users-table column is required: the external adapter accepts this application identity mapping.
- Two actor guards representing the same users MUST map to the same namespace and canonical IDs. Guards representing different identity domains MUST NOT share a namespace.
- Resolve numeric/string/UUID target inputs through the provider, then use the provider's canonical ID. Do not silently equate arbitrary strings such as `"001"` and `"1"`.
- Store keys and MAC inputs use length framing or canonical structured encoding, not delimiter-concatenated untrusted identifiers.
- Host tenancy checks are split between global actor-target eligibility in start/continue and request-local tenant access in `canUseRequest` plus ordinary target authorization. Target selection cannot silently replace tenant state copied from the actor; application tenant context must be derived/validated after effective identity resolution.
- Multiple tenants for the same actor still share one selected target under D01. A per-tenant simultaneous mode is outside v1.

### 4.2 Native authority requirements

Native Auth validates the actor's native credential. Session authentication may create an actor session from a valid remember-me cookie, recycle that token, or perform normal session/cookie maintenance. The package must neither suppress nor add to those native effects. Compare start/stop/status and effective-guard requests with equivalent native-authentication requests under the same initial credential state; never interpret native recovery as target authentication. The native authority factory also requires application callbacks for ordinary account access and a security stamp for each subject. A stamp is a stable security epoch changed whenever the application wants existing modes invalidated, including relevant password, suspension, or privilege changes. A constant allow callback, a current timestamp generated at read time, or a hash of incomplete fields is not a valid substitute.

The factory MUST validate stamp types, cap encoded length at 512 bytes, and compare exact canonical values. `null` is a valid initial stamp only where the application contract can distinguish an unchanged initial account from later revisions. Missing stamp configuration is an error. The package cannot infer every application's revocation model from a Lucid user model.

Required security-event semantics under D07/D08:

| Event | Credential effect | Account stamp / mode effect |
|---|---|---|
| Logout one actor session or revoke one actor token | Reject that credential immediately through its native validator | Do not advance account stamp solely for this local revocation; other valid credentials may use mode. |
| Logout all / revoke all account credentials | All existing credentials rejected | Advance account stamp or explicitly invalidate the owned mode; a later login cannot inherit the prior mode. |
| Actor password, suspension, identity-security or relevant masquerade privilege change | Host's normal revocation policy | Advance actor stamp and/or deny current continuation policy; end old mode. Restoring a privilege does not revive a cleared mode. |
| Target password, suspension, verification/access or identity-security change | Target's own ordinary credential policy | Advance target stamp or report target ineligible; end this actor's old mode. |
| Revoke one of the target's own sessions/tokens | Reject that target credential | Does not by itself invalidate account eligibility or this mode; the operator is not using that credential. |
| Display name/theme or other non-security profile change | None required | No stamp advance required. |

Native adapter documentation must map host events to this table. If a host intentionally treats every local revocation as account-wide, document it as a stricter configured policy rather than claiming D07's continuation behavior. Account Kit's existing local revoke versus revision-advancing revoke-all provides the proposed default distinction.

For tokens, each request uses the original actor token's validity, expiry, and trusted token reference. The application's credential policy checks its capabilities for the requested operation. The package MUST NOT copy that token or its `currentAccessToken` property onto the target user, create an unrestricted token, or treat target permissions as a way around token scopes. Existing routes reading `effectiveUser.currentAccessToken` need an explicit migration to the actor-credential capability API; absence must fail closed.

### 4.3 Effective Auth guard and Bouncer

Provide an Adonis custom guard wrapper implementing the supported Auth 10 guard contract. It authenticates one fixed actor guard and returns the effective model for normal application authentication. It does not implement target login or issue credentials.

Suggested application configuration names are `web` → `web_effective` and `api` → `api_effective`. Each effective guard declares its single actor guard. Do not configure recursive guard dependencies or ambiguous multi-guard fallback. Control routes explicitly use actor guards. Business route groups explicitly use effective guards, with the appropriate one selected for each transport.

After business authentication, `auth.user`/`auth.getUserOrFail()` and default Bouncer resolution MUST refer to the effective user. `ctx.masquerade.actor` independently exposes the actor to trusted server code. The package MUST NOT overwrite the actor guard's stored identity or use global mutable user state. Two concurrent requests by different actors must be isolated.

Plain assignment to `ctx.auth.user`, monkey-patching a guard's private fields, or only replacing a template prop is prohibited. Consumer tests must exercise the actual framework guard and Bouncer behavior. Routes explicitly using a raw actor guard remain control/security routes and MUST NOT execute target business handlers.

The exact Authenticator seam is normative. Auth 10's facade `user` and `getUserOrFail()` use its last attempted guard. Therefore:

1. Business middleware calls `ctx.auth.authenticateUsing(['web_effective'])` or its token equivalent. The effective wrapper's `check()` resolves and stores the request's effective user, sets its own `authenticationAttempted`/`isAuthenticated`, and returns true only after every admission check.
2. Inside that wrapper, actor authentication calls **only** `ctx.auth.use('web').authenticate()` (or the selected raw token guard method). It MUST NOT call facade `authenticate`, `check`, `authenticateUsing`, or `checkUsing`, which would change the facade's attempted guard back to the actor.
3. Configure the default guard to the appropriate effective guard for the application surface. Repeated facade authentication on a business route must remain effective; explicit transport groups choose exactly one effective guard.
4. Initialize request Bouncer with a lazy resolver of the facade's effective user, for example the host's ordinary `new Bouncer(() => ctx.auth.user, ...)` integration. Do not eagerly capture a raw actor before effective authentication. Start/continue/local-request policies use the supplied actor/target models and an explicitly bound Bouncer instance/ability, never the default instance whose effective user is still being resolved.
5. Before business-handler dispatch, require `auth.authenticatedViaGuard` to be the declared effective guard. Assert `auth.user === effectiveGuard.user`, `auth.getUserOrFail().id === effectiveId`, and `auth.use(actorGuard).user.id === actorId` in real consumers. In idle mode the IDs coincide but the effective guard still owns the facade.
6. The wrapper's `check()` may translate only genuine missing/invalid actor authentication into false; context/policy/infrastructure domain errors must propagate to their mapped response. A catch-all returning false would hide admission failures and permit unsafe multi-guard fallback.

This follows the [Auth 10 Authenticator selection behavior](https://github.com/adonisjs/auth/blob/10.x/src/authenticator.ts), not private-field mutation. Unsupported host code can still deliberately read raw actors; coverage review must identify such business paths rather than claiming the package can rewrite arbitrary application code.

## 5. Public service API and request context

### 5.0 Configuration contract

The root `defineConfig` validates the following proposed shape at provider boot. There is no package-enabled-by-default behavior and no allow-all authorization scaffold:

```ts
interface MasqueradeConfig<User, Request> {
  authority: AuthorityPort<User, Request>
  policy: MasqueradePolicy<User, Request>
  store: () => Promise<ControlStore>
  durationSeconds?: number // default 900; integer 60..3600
  maxDurationSeconds?: number // default 3600; can narrow the hard ceiling
  audit: { retentionDays: number } // explicit positive integer; no infinite default
  onEvent?: (event: PublicAuditEvent, signal: AbortSignal) => Promise<void>
  reportFailure: (failure: RedactedDiagnostic, signal: AbortSignal) => void | Promise<void>
}
```

The Adonis integration obtains context-MAC and stamp-encryption facilities from an explicitly selected application key provider; raw keys are never serialized in config diagnostics. That provider must support format/key versioning and purpose binding as described below. The store and identity authority must declare production suitability; the test memory store is rejected by production readiness checks. Unknown config fields, non-finite durations, duration exceeding configured/hard maximum, absent callbacks/key facilities/retention, and unsafe namespaces fail at boot.

Proposed bounds: namespace 128 UTF-8 bytes; canonical subject ID 255 bytes; incarnation 128 bytes; security stamp 512 bytes. Validate IDs before SQL/MAC construction and resolve framework model IDs before canonical storage. Callback user models remain server-only. Changing namespace or incarnation mapping is an explicit migration that invalidates prior context assertions, not a way to silently repair a misconfiguration.

`PublicAuditEvent` is the safe event projection in section 6.2, excluding stamps and credentials. `RedactedDiagnostic` includes a stable failure kind, safe event/transition correlation, and a privately handled exception cause; it is never sent to the client. Reporter and observer failures are isolated from already committed results. Their exception messages must not reach flash/status/error bodies.

Proposed service entry points:

```ts
interface StartInput {
  targetId: string | number
  reason: string
  durationSeconds?: number
  expectedContext: ContextToken
}

interface StopInput {
  expectedContext: ContextToken
}

type ModeView = {
  isMasquerading: false
  contextToken: ContextToken
} | {
  isMasquerading: true
  contextToken: ContextToken
  targetId: SubjectId
  startedAt: Instant
  expiresAt: Instant
}

interface MasqueradeService<Request> {
  start(request: Request, input: StartInput): Promise<ModeView>
  stop(request: Request, input: StopInput): Promise<ModeView>
  status(request: Request): Promise<ModeView>
  // Request-local business context, never a credential-issuing API.
  resolve(request: Request): Promise<ResolvedContext>
}

interface ResolvedContext {
  authorityNamespace: string
  actorId: SubjectId
  actorIncarnation: string
  effectiveId: SubjectId
  effectiveIncarnation: string
  isMasquerading: boolean
  contextToken: ContextToken
  // An opaque reference for audit correlation; not a session secret.
  modeId?: string
}
```

The Adonis request context additionally holds typed server-only actor/effective models through a generic integration type. `ResolvedContext` is the safe explicit projection, not permission to serialize the entire request context. The projection retains namespace and both immutable account incarnations for attribution across identity domains and ID reuse. Idle mode uses the actor ID/incarnation for both identities. These fields are audit context, never authorization evidence supplied by a client. No service accepts `fromUser`, an actor ID, a credential revision, or an arbitrary mode ID from the client as authority.

`AccountSnapshot`/`ActorSnapshot` and mode resolution are memoized only within one request after successful admission. Do not perform another target model lookup for each Bouncer call. Idle mode does not load a target. The normal request budget is original credential validation, one shared mode read, required current account/stamp/policy reads, and no mode/audit write unless a transition or invalidation occurs. This budget applies to business/status requests, including their local denials; admitted start/stop control outcomes have the separate audit-write contract in section 6.2. Record actual query counts and latency against a comparable native guard in consumer evidence; no unmeasured latency or throughput claim is a release criterion. Cross-request allow caching is excluded because it weakens immediate next-admission revocation semantics.

Status discloses the target ID only to an authenticated owner credential allowed to read its mode. It excludes operator reason, security stamps, token reference, raw revision, audit records, and complete user objects. Display labels are an application-owned safe projection. Mode IDs never confer access.

### 5.1 Context token

The server issues an integrity-protected, non-secret token derived from namespace, authenticated actor ID **and incarnation**, current control revision, and a random revision nonce. Bind it to a format version and key ID. Use Node's supported cryptography or an established framework MAC primitive; compare MACs safely. Do not accept client-parsed revision fields without verification. Bound token input to 512 bytes and reject malformed/unsupported formats.

For an actor with no row, use a distinct deterministic “never selected” context under the server key. The first start creates revision `1` atomically. Once a row exists, retain an idle tombstone with its latest revision/nonce. Removing that tombstone would make pre-start tokens valid again and is prohibited during ordinary pruning.

Every covered authenticated unsafe business request MUST supply the token from the page/API state on which the intent was based. Accept one defined header, `X-Masquerade-Context`, or one hidden form field, `_masqueradeContext`. If both are supplied they must match exactly. This token does not replace Shield CSRF, the actor cookie/token, or target Bouncer checks.

The client MUST NOT fetch a new token immediately before silently replaying an old form; doing so would assert an intent under a context the operator has not reviewed. On mismatch, discard/review/reconfirm the business intent after loading current state. Background API consumers using a human actor's tokens need the same explicit context handling or a distinct service identity without masquerade capability.

GET/HEAD requests resolve the latest server mode without requiring a previous token. The browser does not select effective identity. Start and stop require expected context, and change it on success.

### 5.2 Middleware, client bootstrap, and coverage

Provide a route-level global enforcement middleware after matched-route resolution and Auth initialization, before business authentication/Bouncer/handlers. Supply a validated coverage registry whose entries name the real registered route, transport/actor guard, effective guard, and kind: `business`, `control`, or `public`. Business entries also declare trusted read/mutation/sensitive classification. The framework adapter resolves actual route identities, never caller-supplied route names.

At boot, compare the registry with the framework's resolved route inventory. Reject unclassified registered routes, duplicate/conflicting entries, recursive guards, raw-actor business guards, and a missing control-route guard. Late/dynamic or unknown routes are denied at request time until classified. These checks prove declared wiring completeness, not the correctness of arbitrary business-handler code. Examples and integration tests must additionally prove that handlers do not select raw-actor authorization or use actor-derived tenant state.

Exemptions must be explicit: genuinely public endpoints, initial login/signup/CSRF bootstrap, proof-authorized routes, and current-credential logout are not actor-bound business mutations. They retain their own authentication, proof, CSRF and rate-limit contracts. Public proof/security actions presented with an authenticated actor in active mode are blocked according to section 9.3. Logout always affects the real current actor credential, never a target, so it remains a safe recovery route without a context token. Account-global start/stop always require one.

Registry classification is the baseline. A dynamic policy may only make it stricter: `sensitive` outranks `mutation`, which outranks `read`. An unsafe method forces at least mutation. Unknown/invalid policy classification denies. A public declaration is not a shortcut for bypassing effective authorization on a business handler; the boot check verifies declared wiring, and application review verifies that public handlers really are public.

On server-rendered business GETs, expose the safe mode view through `ctx.masquerade` and an explicit Edge view share; forms render `_masqueradeContext`. Do not share raw actor/target models automatically. On API clients, GET status is the bootstrap and refresh contract; the client sends the observed token with its subsequent unsafe intent. Native bearer clients are not forced to use a browser or cookie. Existing applications must migrate covered forms and clients before enabling enforcement. There is no required re-login/session enrollment; a stale existing form instead receives 428/409 and must be reviewed again.

This registry/global middleware integration is required for the strong all-covered-route guarantee. An advanced service-only use may wrap selected handlers, but its guarantees apply only to those handlers and documentation must not present it as application-wide enforcement.

## 6. Persistence and atomic transitions

### 6.1 Mode table

Proposed default table: `masquerade_modes`. Applications may configure a validated SQL identifier. No foreign key to a particular users table or Lucid model is required.

| Column | Meaning / constraint |
|---|---|
| `authority_namespace` | Non-null bounded string; first component of unique owner key |
| `actor_id` | Canonical bounded string; second component of unique owner key |
| `actor_incarnation` | Immutable account instance; third component of unique owner key |
| `revision` | Monotonic integer in `1..9223372036854775807`, represented as a decimal string; compatible with SQL signed BIGINT/SQLite INTEGER |
| `revision_nonce` | Fresh 256-bit random value on every successful state transition |
| `state` | `idle` or `active`; no browser login transition is involved |
| `mode_id` | Random operation correlation UUID for current/most recent mode |
| `target_id` | Canonical target ID while active; null while idle |
| `target_incarnation` | Captured target account instance while active; null while idle |
| `actor_stamp_sealed` | Captured actor stamp, authenticated-encrypted, nullable only for idle |
| `target_stamp_sealed` | Captured target stamp, authenticated-encrypted, nullable only for idle |
| `reason` | Required bounded reason while active; clear when ended |
| `started_at`, `expires_at` | UTC values; active invariant requires `expires_at > started_at` |
| `updated_at` | UTC transition time, not per-request activity |
| `last_transition_id` | Stable event/command UUID used to resolve indeterminate commit outcomes internally |

Unique key: `(authority_namespace, actor_id, actor_incarnation)`. Index active expiry for pruning. Validate all row/state combinations on reads; malformed or unsupported state fails closed. Protect sealed values with the application's encryption/key-rotation facility and purpose-bind them to namespace, actor ID/incarnation, mode ID, and field. Store encryption format/key version. Decryption/key-unavailability fails closed; never replace a stored stamp with today's stamp to repair it. A reused target ID with a different incarnation is ineligible for the captured mode even if its initial security stamp happens to match.

The table holds one row per actor account instance who has selected a mode, not one row per browser, device, target, or ordinary application user. Idle rows retain revision and nonce, not captured credentials/stamps/reason. Owner erasure may remove the row only after retiring that immutable incarnation. Reusing a numeric ID then creates a different owner key and MAC context; the old deterministic no-row token cannot become valid for the new account. Restoring a database backup must follow an explicit context-key/namespace recovery procedure so old intent assertions are not silently resurrected.

### 6.2 Audit table

Proposed table: `masquerade_events`. Each transition event has a unique event ID, mode ID when known, namespace, actor ID, target ID when authorized/known, UTC time, kind, stable outcome/reason code, owner revision, and optional bounded operator reason for start. Do not persist credentials, cookies, token identifiers, security stamps, whole users, arbitrary request bodies, IP addresses, or user-agent strings by default.

The event also records actor incarnation and target incarnation when known, so reused numeric IDs do not conflate different account instances. Store/retention access remains application-owned. Applications auditing individual business actions consume the immutable request actor/effective projection; the package does not automatically log every handler invocation or copy request payloads.

Event kinds: `started`, `stopped`, `expired`, `invalidated`, `start_denied`, `stop_denied`, `control_noop`, `transition_failed`. Non-transition records identify the attempted control operation and stable outcome code; `control_noop` records an already-idle stop without representing another successful state transition. Invalidation codes distinguish actor-security-change, target-security-change, actor-ineligible, target-ineligible, and continuation-policy-denied for trusted operations. Public status/errors use generic wording.

Successful mode update and authoritative event insert MUST share one durable transaction. Audit boundaries are explicit:

- Once native actor authentication/ordinary access, CSRF, and the applicable shared control limiter succeed, each start/stop invocation enters the durable control-audit boundary. Record its committed transition atomically, or record its denial, input failure, context conflict, or idle-stop no-op without changing mode revision. Before authorized target resolution, record only the trusted owner and safe outcome, never a supplied target ID or request body.
- Native authentication/CSRF failures, throttled controls, and other pre-boundary rejections use host security diagnostics. Status and business authorization denials, including local credential/tenant denials, also use host diagnostics without mandatory package audit writes. Global invalidation still requires an atomic end event.
- Start and stop have separate shared limiter budgets, so exhausted start capacity cannot block recovery. Limiter rejection occurs before durable denial writes; use bounded host diagnostics for rejected volume.
- A required non-transition record write failure returns 503 without business effects or state mutation. Store/authority outages and uncertain commits may prevent a record; emit a redacted diagnostic and never claim complete durable coverage during an outage. Do not add a `transition_failed` record asserting rollback when commit remains unknown.

`recordControlOutcome` stores admitted non-transition outcomes only; successful transitions always use CAS plus its event. A current-token idle stop creates `control_noop`, never another `stopped` event.

Observer events are post-commit notifications with event IDs for downstream deduplication. They are best effort, not exactly-once or a transactional outbox. Observer execution and any diagnostic reporter wait share a fixed 1,000 ms monotonic deadline after commit; failure, timeout, or a reporter exception cannot alter the committed response. Pass an abort signal and abort it at the deadline, stop awaiting, and handle late rejection without retry or compensation. Cancellation is cooperative: callbacks must not block the event loop, and the package cannot undo their external effects.

Cap outstanding observer/reporter callbacks at 100 per process, retaining a slot until its promise settles even after timeout. When full, skip non-authoritative callbacks and emit a redacted saturation counter/log through the host logger. Reporter failure/timeout uses that same fallback without recursively calling the reporter. Diagnostics on non-committed error paths use the same bounded-wait helper. Tests use controllable promises to prove deadlines, bounded pending work and late-rejection handling. Applications needing durable notification delivery can consume authoritative events through their own integration; no durable delivery system is included in v1.

### 6.3 Store contract

```ts
interface OwnerKey { namespace: string; actorId: SubjectId; actorIncarnation: string }

type CasOutcome =
  | { status: 'applied'; transitionId: string }
  | { status: 'conflict' }
  | { status: 'indeterminate'; transitionId: string }

interface ControlStore {
  read(owner: OwnerKey): Promise<ModeRow | null>
  // expected=null means INSERT IF ABSENT, never an unconditional upsert.
  // update + event commit together or neither is accepted.
  compareAndSet(input: {
    owner: OwnerKey
    expected: Revision | null
    next: ModeRow
    event: AuditEvent
  }): Promise<CasOutcome>
  // Committed state-transition events only, never denial/no-op records.
  // Internal owner-scoped lookup; not a public audit browsing endpoint.
  readTransition(owner: OwnerKey, transitionId: string): Promise<AuditEvent | null>
  recordControlOutcome(event: AuditEvent): Promise<void>
  expiredBatch(input: { now: Instant; limit: number }): Promise<ModeRow[]>
  pruneEvents(input: { before: Instant; limit: number }): Promise<number>
}
```

The store adapter must also expose typed health/schema validation and a conformance-test factory; these are operational APIs, not HTTP endpoints. `ModeRow`/`AuditEvent` are validated persistence DTOs matching sections 6.1–6.2. Adapter authors must not implement CAS as a read followed by an unconditional write.

PostgreSQL uses unique insert / conditional update with transactional event insert. SQLite uses real database transaction/uniqueness behavior and bounded busy handling. Process-local mutexes do not satisfy the contract. Conflict handling MUST NOT delete a competing row, recreate an absent row, or silently adopt the winner's target. Exhausted transient retries return a service error without business-handler execution.

The mode store and identity database may differ. There is no cross-store distributed transaction claim. Identity checks observe a consistent adapter snapshot; each business admission revalidates stamps and access. A mode may become obsolete immediately after a successful start, just as permissions can change after login. Its next admission must reject it. Store CAS linearizes the mode selection, not every external policy mutation or already executing business transaction.

Generate the event/transition UUID once before CAS and retain it across the adapter's safe transaction retries. Definite pre-commit failure throws an unavailable error marked `notCommitted`; transport loss that cannot establish commit/rollback returns `indeterminate`. The service must not retry/compensate that command automatically. It returns a generic 503 outcome-unknown error with the safe transition UUID for support correlation. Owner-scoped lookup of a matching successful state-transition event can prove the command committed; denial/no-op records are not evidence of a state transition; a momentary missing event does not prove a timed-out transaction can never commit. GET status gives the client current state and a new context for a newly reviewed intent; it does not prove which past concurrent command committed. Unknown-state observer notification is not emitted speculatively.

### 6.4 State transition table

| Current state | Input / condition | Result |
|---|---|---|
| Absent/idle | Valid start, matching expected context, eligible actor/target and explicit policies | Active; new mode ID, revision/nonce; fixed expiry; one `started` event |
| Active | Any second start, including same target | 409; no replacement or extension; stop/reconfirm/start is required |
| Active | Valid stop with matching context | Idle; next revision/nonce; clear stamps/target/reason; one `stopped` event |
| Idle/absent | Stop with current context | 200 idle, no revision change; one `control_noop` record and no duplicate successful-stop event |
| Any | Mismatching expected context | 409; never alter the current winner |
| Active | Expired or global validation/policy invalid | CAS to idle; one end event; triggering business request returns context-changed |
| Active | Current actor credential invalid or request locally lacks capability/tenant access | Reject that request; do not revoke other actor credentials or clear mode solely for this reason |
| Any | Store unavailable or sealed data invalid | 503/generic operational failure; no business action, no actor fallback |

At revision overflow, fail closed and require controlled migration; never wrap to zero. The conceptual no-row revision `0` is a token sentinel, not a persisted mode row. A deleted row that a client token claims existed is invalid, not an invitation to silently recreate it. Wire representations remain strings so counters beyond JavaScript's safe integer range are exact.

## 7. Algorithms

### 7.1 Start

1. Authenticate one configured actor guard and validate the original credential/ordinary actor access. Check transport-appropriate CSRF and the transition rate budget.
2. Validate the request shape and expected context against the actor's current mode. Resolve an expired active mode to idle first, then return a changed-context conflict; do not start from an old token in that same request.
3. Reject an active mode and self-targeting. Resolve the target through the configured provider with generic denial for missing/ineligible/disallowed targets. Actor ID is not an input.
4. Check actor credential capability for `start`, current actor/target eligibility, `canStart`, `canContinue`, and `canUseRequest`. Local denial leaves existing global state unchanged. Capture the exact security stamps and fixed deadline using the trusted clock.
5. Build the active row and `started` event. Use CAS against the observed idle revision, or unique insert if no row exists. Only the winner succeeds.
6. Return the committed view and new context token. Run observer notifications after commit, with isolated failure handling. The mode transition invokes no Auth login/logout and makes no cookie changes; ordinary native authentication may already have performed its normal actor session/remember-me maintenance.

Validation denials do not change mode revision. A denied transition must not reveal target existence to an unauthorized actor. A lost response is an unknown client outcome; GET status supplies current mode/context for a newly reviewed intent, not proof of that command's historical outcome. A matching transition record proves commitment; an absent record may remain indeterminate until the database establishes a definitive result. Do not automatically retry start as a new command or compensate an uncertain transition.

### 7.2 Business request admission

1. Authenticate and validate the original actor credential. An invalid session or revoked/expired token fails before target resolution.
2. Read the actor-global mode from the shared authoritative store. No cross-request allow cache is permitted in v1.
3. If idle, resolve effective identity to the actor. Validate context tokens for covered unsafe requests even in this state, then follow ordinary actor authorization. Do not apply active-mode sensitive-action or mutation restrictions to an idle actor.
4. If active, check exact expiry, actor/target security stamps, both accounts' eligibility, and global continuation policy. Any global invalidity must prevent the business handler and attempt CAS to idle. A CAS conflict is re-read or returned as a conflict, never used as permission to run under a new target.
5. Check the current credential's `read`/`mutate` capability and `canUseRequest` for local tenant/route access. A local denial returns 403 without clearing global mode; an exception returns 503 without clearing it. Continue with no actor fallback in either case.
6. Check context token for every unsafe request. Reject stale intent before business effects. Classify the registered route from trusted route metadata. Never let request body, query parameters, or a caller header declare a sensitive route safe.
7. **While active**, if sensitive, deny. Billing mutations are sensitive regardless of mutation opt-in. If mutation, require exact `true` from the explicit mutation callback and ordinary target permissions. GET/HEAD/OPTIONS are the method-level safe set, but application classification can be stricter; any unsafe verb remains mutation even if classification says read. Unknown routes are denied by coverage enforcement. Idle sensitive actions retain ordinary actor policy.
8. Freeze the actor/effective context for this request. Return the effective model through the custom guard and let normal Bouncer/application authorization run as that user.

Check mode once again before beginning a package-provided mutation handler if request admission preceded additional asynchronous work. This narrows a race, but does not promise that a stop concurrent with a running business transaction can roll back that transaction. Applications with stronger financial/irreversible-operation requirements must use their own transaction-time authorization and are not allowed to infer it from this package.

### 7.3 Stop

1. Authenticate the real actor and validate ordinary actor access, apply CSRF for session transport and the separate stop limiter, then enter the control-audit boundary and require that credential's `stop` capability. Do not authenticate the target, invoke `canStart`, or require `canContinue`/`canUseRequest`.
2. Read the owned mode and verify expected context. A stale stop must not clear a newer mode, including a newer selection of the same target.
3. Atomically write idle state plus `stopped`. Return idle/current context. There is no credential restoration.
4. Repeated stop with the current idle token records `control_noop` and returns idle without changing revision. A retry carrying the old active token returns 409; use status to distinguish a completed stop from a newer active mode.

Stop must remain usable after target deletion, target suspension, target security change, or loss of permission to start new modes, provided the actor's original credential and ordinary account access remain valid. A globally invalid actor is denied rather than being “restored.”

### 7.4 Expiry and invalidation

Every admission enforces expiry even if no maintenance job has run. CAS the expired/invalidated row to idle with its end event. Cleanup races re-read current state and never clear a newer mode. The triggering business request returns 409 with a context-change code and executes no business action; a status/control request may return the resulting idle view.

If persistence fails during invalidation, return 503 and admit no target action. A maintenance task can retry later; expiry correctness never depends on task availability. A durably ended mode cannot become active again after backward clock movement. All instances need synchronized clocks, and event/expiry tests must cover boundary skew explicitly. Use a shared store UTC clock for start/admission where available; custom stores declare their clock/skew contract. The package cannot guarantee real-time expiry under an arbitrary undetected reversal of its trusted clock; time-source health is a deployment dependency, not a hidden absolute-time guarantee.

### 7.5 Logout, login, and security changes

- Logging out one original credential ends that credential normally. It does not silently clear the actor-global setting on other devices.
- The application may explicitly stop first as a separate account-global action. The logout UI must explain which action it performs.
- Account Kit logout-all/credential changes advance account revision; active modes captured under the previous stamp cannot be used by a later valid login.
- Native applications must similarly advance their security stamp when they require global invalidation. Native Auth does not invent an account-wide security epoch.
- A fresh valid login during an unexpired, otherwise valid mode sees that account-global target. This is intentional under D01 and must be explicit in the UI and documentation.
- The target's own sessions, devices, and credentials remain unaffected. The target never inherits the actor's selected setting.
- Self-targeting is rejected as invalid input; selecting target B when A is active requires stop, fresh context, then a new authorized start. No implicit replacement endpoint exists in v1.

## 8. HTTP contract

Routes are opt-in and mountable under an application prefix. Nothing is auto-registered on package import.

| Method/path | Actor operation | Input | Success |
|---|---|---|---|
| `GET /masquerade` | Status | Original actor credential | 200 `ModeView` |
| `POST /masquerade/start` | Start | `{ targetId, reason, durationSeconds? }` plus context token | 200 active `ModeView` |
| `POST /masquerade/stop` | Stop | Empty object plus context token | 200 idle `ModeView` |

These paths are proposed working names; PRD/spec reviewers must settle them together before API freeze. Static control routes must not overlap a parameterized target route. Equivalent server-rendered controllers may call the same service and redirect with fixed same-origin destinations after success. The core service never accepts arbitrary redirect URLs.

Session requests require Shield CSRF on both controls and covered unsafe business actions. Bearer-only requests use explicit native token guard authentication and application origin/CORS rules; never bypass CSRF merely because a request includes some Authorization header while a cookie can establish authority. If both transports are presented, select the route's explicitly configured actor guard or reject ambiguity. Do not fall back to another actor when the selected credential fails.

All control/status and effective-user-specific responses MUST use `Cache-Control: no-store` and appropriate `Vary` headers; do not share-cache operator/target state. Clients must not persist target pages in a cross-user application cache. Status may expose an application-owned banner projection, but target email/name is not part of the default response.

Input validation: reject unknown control fields, empty/unbounded IDs, invalid durations, fractional/negative/non-finite seconds, invalid UTF-8/control characters in reason, and oversized bodies. Reject invalid encoding/control characters before normalization, trim reason with ECMAScript `String.prototype.trim()`, then require 1–500 Unicode code points and at most 2,000 UTF-8 bytes; reject an empty result and persist only the trimmed value. Do not silently truncate. Proposed maximum control body size is 8 KiB. Duration is an integer in `[60, 3600]`, default `900`, and may be further narrowed by application policy; never accept a client expiry timestamp. Rate-limiter defaults are proposed as 5 start attempts/minute per actor and 30/minute per trusted client, shared across instances. Status and safe stop/logout must not be trapped behind the exhausted start budget. Document a separate abuse budget for stop that still permits ordinary recovery.

### 8.1 Errors and outcome uncertainty

JSON errors use `{ errors: [{ code, message }] }`; JSON:API negotiation may use `{ code, title }` to match Adonis conventions. Domain services throw typed errors; controllers map known codes and log unexpected causes privately. Never flash arbitrary exception messages.

| HTTP | Code | Meaning |
|---|---|---|
| 401 | `E_MASQUERADE_UNAUTHENTICATED` | Original actor credential/account access invalid |
| 403 | `E_MASQUERADE_NOT_ALLOWED` | Explicit start/credential/policy denial; no target existence disclosure |
| 403 | `E_MASQUERADE_ACTION_BLOCKED` | Sensitive action or mutation denied |
| 409 | `E_MASQUERADE_ALREADY_ACTIVE` | Cannot nest/replace/renew a mode |
| 409 | `E_MASQUERADE_CONTEXT_CHANGED` | Stale page, concurrent transition, expiry, or invalidated mode; no handler ran |
| 422 | `E_MASQUERADE_INVALID_INPUT` | Invalid control input or self-target |
| 428 | `E_MASQUERADE_CONTEXT_REQUIRED` | Covered unsafe request lacks expected context |
| 429 | `E_MASQUERADE_THROTTLED` | Transition budget exceeded; include bounded `Retry-After` |
| 503 | `E_MASQUERADE_UNAVAILABLE` | Store, authority provider, decryption, or policy infrastructure failure |
| 503 | `E_MASQUERADE_OUTCOME_UNKNOWN` | A control write may have committed; return a safe `transitionId` for correlation and use status before any new intent |

Shield's CSRF errors remain framework errors; do not disguise them as domain success. HTTP 503 after a network/commit-ack failure does not prove rollback. GET status is the current-state recovery operation; historical command certainty uses the owner-scoped transition record described in section 6.3. The outcome-unknown error may include `transitionId` alongside its stable code/message, never the private cause. No automatic destructive compensation or replay is allowed. No `Idempotency-Key` header is advertised in v1. CAS plus status defines retry behavior; unsupported idempotency headers do not imply exactly-once delivery.

Look up user-facing error text through the host's `@adonisjs/i18n` instance as `errors.<code>`, with package English fallback. Ship no translations, locale selection, language setting, or loader. Stable codes/statuses cannot be changed by wording overrides. The configuration and domain services remain independent of a request translator.

## 9. Account Kit integration

### 9.1 Current baseline and changed implication

At Account Kit baseline `286b342f55e6252cfbe5cd1100345fef585619d6`, `authentication.current` validates the actual account credential: revision for sessions, token row for access tokens, optional session handle, and `canAccess`. See [authentication checks](https://github.com/Kevinjohn/oss-adonisjs-account-kit/blob/286b342f55e6252cfbe5cd1100345fef585619d6/src/authentication.ts#L65), [guard metadata](https://github.com/Kevinjohn/oss-adonisjs-account-kit/blob/286b342f55e6252cfbe5cd1100345fef585619d6/src/http/guard.ts#L148), and [credential revision](https://github.com/Kevinjohn/oss-adonisjs-account-kit/blob/286b342f55e6252cfbe5cd1100345fef585619d6/src/credential_revision.ts#L36).

That remains the correct actor check. Do not pass a target ID with the actor's revision/token/handle into `current`. Do not create a target sign-in registry row to make that check pass.

The server-side setting model no longer needs the previously discussed credential-issuance extension. The generic gap is **account eligibility inspection without claiming a credential belongs to that account**. A narrowly scoped public snapshot operation is proposed:

```ts
interface AccountAccessInput {
  userId: string | number
  expectedRevision?: string | null
  requireActive: boolean
}

interface AccountAccessSnapshot {
  account: CurrentAccount
  revision: string | null
}

// PROPOSED Account Kit public method; not implemented today.
kit.authentication.inspectAccountAccess(input: AccountAccessInput)
  : Promise<AccountAccessSnapshot>
```

Under the account lock it must load the configured account adapter, apply `canAccess`, check active state if required, read the exact revision, and compare `expectedRevision` when explicitly supplied. Missing, denied, inactive, and mismatched states fail generically. `null` is a real initial revision and differs from an omitted expected value. The operation does not authenticate a caller, issue a credential, register/touch a session, advance a revision, or expose a new HTTP route.

The success mapping into `AccountSnapshot` is exact: `subject` comes from the host identity provider with matching ID/incarnation, `securityStamp = result.revision`, and `active = result.account.active`. `AccountAccessSnapshot` does not need a duplicate top-level active field. Distinguish omitted `expectedRevision` (capture current), an explicitly present null (require initial null), and present canonical string (require that exact value). Present undefined or malformed values are input errors; use own-property presence rather than truthiness.

Proposed typed errors: `AccountAccessDeniedError` for missing/ineligible/inactive/revision-mismatched subjects, with one generic public code/message; existing/proposed typed invalid-input error for malformed input; infrastructure/provider/database exceptions propagate as operational errors and are mapped by the external adapter to unavailable. A false `canAccess` result is denied; a thrown database/policy exception is not disguised as a missing target. Final class/code naming must follow Account Kit conventions in its API review. Original credential failures remain `InvalidSessionError`/the existing actor authentication contract. Incarnation is supplied by the host adapter as in section 4.1; this inspection API need not add an account column.

It is a trusted server-side primitive. A controller must not expose arbitrary user inspection without its own authorization. Name and exact result/error types require an Account Kit API review. A package-private export or direct users-table query from the external adapter is prohibited.

### 9.2 Adapter operations

1. Authenticate through the configured original native guard and construct its real `CurrentAccountInput` using the existing managed-guard integration.
2. Call `kit.authentication.current` or `requireActive` on the actor's actual credential. Preserve token identity and session handle checks, including when session management is enabled.
3. Inspect the actor's account revision and target account eligibility/stamp through the proposed snapshot method. Both stamps are captured at start and compared at each active admission.
4. Resolve actor/target framework user models through the application-selected model provider for effective Auth/Bouncer use. Verify that canonical IDs match the Account Kit snapshots; reject mismatches rather than silently cross identity domains.
5. Keep all mode data in the external package's control store. Account Kit configuration gains no masquerade capability flag, target ID, mode table, policy callback, or UI component.

When Account Kit session management is disabled, the actor still requires its revision or actual token; never invent a session handle. When enabled, only the real actor session's handle is required and updated. The target's existing session rows are irrelevant to whether its account is eligible; they are never used as operator authority.

### 9.3 Managed Account Kit routes

Account Kit's existing managed routes derive their account and `actorId` from real credential checks; they are account/security operations, not generic business routes. Do not replace their user ID with the effective target or pretend they automatically support masquerade.

While a mode is active, deny managed account/profile/security/session-list/revocation/registration/identity/proof-consumption routes before effects, except explicitly recognized control behavior such as CSRF bootstrap and **logout of the original current credential**. A page needing target account presentation uses a deliberately authorized application read projection instead of relabeling Account Kit's self-service credential API. The integration must cover public proof-consumption routes when an authenticated actor carries an active mode, not only protected route groups.

The target's separate ordinary browser/token traffic is unaffected. A proof presented without an authenticated operator context follows normal Account Kit behavior. Do not globally disable password reset for everyone because one operator has a mode.

The adapter may offer an application middleware/helper listing known managed route identities. If current managed-route metadata is insufficient for reliable classification, record a separate small generic route-metadata change for review. Do not hard-code only URL substrings or add a circular Account Kit dependency on this package.

## 10. Threat model and operational limits

| Threat / abuse case | Required control | Evidence |
|---|---|---|
| Regular user selects another account | Explicit required start/continue policy and credential capability | T-AUTH |
| Admin privileges leak into target access | Actual effective guard/Bouncer identity; no permission union | T-IDENTITY |
| Token scopes disappear after target selection | Original token validity/capability checks on every request | T-TOKEN |
| Deleted/revoked actor revived on stop | Actor remains authentically authenticated; stop issues no credential | T-INVALIDATION |
| Cross-tenant target selection | Application policy under explicit namespace; target-derived tenant context | T-TENANT |
| Stale page submits under new mode | Context assertion required even while idle | T-CONTEXT |
| Two devices race start/stop | Shared store uniqueness/CAS; stable idle tombstone | T-CONCURRENCY |
| Repeated requests extend privileged mode | Fixed deadline; no renew API/activity writes | T-EXPIRY |
| Store outage silently returns admin identity | 503 without business fallback | T-FAILURE |
| Listener throws after commit | Isolated observer failure; committed result retained | T-AUDIT |
| Credentials/PII copied to audit/status | Explicit projection, stamp encryption, redaction | T-PRIVACY |
| Sensitive account mutation hidden behind a GET | Trusted route classification before handler; application audit | T-ACTIONS |

The package does not eliminate tabs or stale client UI. It removes browser-local ownership of identity selection. All integrated devices converge on the server setting at their next admission; already rendered content remains until refresh. UI examples must show an accessible “Masquerading as …” state and stop action, but clients never decide server identity.

Background workers, scheduled jobs, WebSocket messages, subscriptions, and non-HTTP service calls do not automatically inherit a safe effective context. v1 does not ship those adapters. Jobs explicitly created under a mode must carry an immutable actor/effective audit projection and application authorization policy; no raw credential or AsyncLocalStorage scope is assumed to survive enqueueing. Long-running requests use the admitted snapshot; a stop cannot retract their completed effects. Stronger transaction-time guards are application responsibilities.

Do not auto-enable mode for service identities or shared automation credentials. Human API tokens participating in the configured namespace are affected by account-global mode under D01/D02; maintainers must explicitly review that consequence. Apps requiring a separate operator and service identity should keep their authority domains/subjects distinct.

### 10.1 Retention and maintenance

- Idle mode rows retain only owner key, revision/nonce, timestamps and last mode correlation reference as needed; clear reason and sealed stamps on end.
- Retain idle rows until controlled actor deletion/incarnation change. Never prune them merely because their last mode expired.
- Audit retention is required explicit configuration. No universal legal retention period is selected. If unset, fail production readiness validation rather than silently retaining events forever.
- Ship bounded `masquerade:prune --batch-size=100` behavior: expire active rows by conditional revision/expiry update, then remove events older than configured retention. Runtime expiry enforcement is independent of pruning.
- Recheck revision and expiry when pruning selected rows, so a stale batch cannot clear a newer mode. There is no renewal operation, but a new mode may occupy the owner row.
- Provide a server-only controlled owner-erasure operation for account deletion workflows. It must retire state, respect audit retention/redaction policy, and prevent ID reuse with old context tokens. It must not erase unrelated owners.
- Owner erasure is an application deletion integration, not a self-service HTTP endpoint. The SQL adapter must expose a bounded owner-scoped transaction helper alongside the core store SPI to delete a retired incarnation's row and apply the host's explicit audit retention/erasure policy. Exact erasure-policy callback types require privacy/API review before that integration ships; no implicit legal policy or general-purpose data-erasure framework is introduced.
- Key rotation must support decryption of unexpired old records or explicitly invalidate them. Context-MAC rotation may invalidate outstanding intent tokens; document the resulting 409/reload behavior. No silent stamp resealing from fresh account data.
- Record redacted diagnostics for authority/store outages, denied transitions, observer failures, and invalid configuration. Avoid user IDs in metric labels and operator reasons in general application logs.

## 11. Proposed repository structure and code conventions

This structure belongs in the future standalone repository, not inside Account Kit's runtime tree:

```text
src/config.ts, src/types.ts, src/errors.ts
src/mode_service.ts, src/context_token.ts, src/policy.ts
src/audit.ts, src/expiry.ts
src/auth/effective_guard.ts
src/http/context_middleware.ts, src/http/controllers.ts, src/http/responses.ts
src/native/session_authority.ts, src/native/token_authority.ts
stores/lucid.ts, stores/lucid_schema.ts
adapters/account_kit.ts
providers/masquerade_provider.ts
commands/prune.ts
tests/                       # one spec per module/closely related pair
tests/helpers/               # shared clocks, identities, failure controls
testing/store_contract.ts
examples/native/             # native-only session and bearer applications
examples/account-kit/        # real packed Account Kit integration
docs/                        # install, policies, transports, deployment, recovery
```

One responsibility per file; split at cohesive seams, not arbitrary line counts. Follow the open-source AdonisJS TypeScript/config conventions, ESM, explicit types at ports, snake_case filenames, and narrow exports. Avoid an ORM-independent repository framework beyond the actual control-store contract. No Docker configuration, containers, or container-based tests are authorized by this specification.

Example implementation style:

```ts
const changed = await store.compareAndSet({ owner, expected: current.revision, next, event })
if (changed.status === 'conflict') throw new ContextChangedError()
if (changed.status === 'indeterminate') throw new OutcomeUnknownError(changed.transitionId)

// This helper enforces the shared callback deadline and pending-work limit.
// The durable transition is already complete. Observers cannot undo its outcome.
await notifyObserversSafely(event, diagnostics)
return publicView(next)
```

Do not place private planning/review metadata, contributor-assistance attribution, credentials, or live customer data in future public source/docs/commits/screenshots. If implementation reuses upstream code rather than only concepts, retain the applicable copyright/license notices and review provenance; the new package is not represented as an upstream-maintained release.

## 12. Acceptance and verification matrix

Each row is a required test family, not a single happy-path test. Tests must assert observable identity, denied handler execution, persisted state/event outcomes, and no credential effects beyond equivalent native authentication. Test doubles establish domain behavior only; actual framework/packed-consumer cases establish integration claims.

| Test family | Required cases / acceptance evidence |
|---|---|
| **T-AUTH** | Missing/false/throwing policies; non-admin caller; self-target; missing/ineligible target indistinguishable to unauthorized actor; continue policy removed; stop still allowed after start permission removed; no client actor substitution. |
| **T-IDENTITY** | Actual session and token guards authenticate actor before/during/after mode; facade attempted/authenticated guard remains effective despite internal actor checks; effective guard returns target only while active; lazy Bouncer resolves target and actor-bound policy is distinct; audit actor retained; no global mutable state between simultaneous actors. |
| **T-CREDENTIALS** | Compare start/stop/status and effective requests with native-authentication controls for existing sessions, remember-me-only recovery, and expired/revoked credentials. Mode code never calls login/logout or adds actor cookie/token rotation, session issuance, renewal or expiry extension; native remember-me recovery retains its normal behavior. No target sessions/tokens or credential modifications; status always requires native actor authentication. |
| **T-CONTEXT** | Idle-page token rejected after start; target-page token rejected after stop; active A → idle → active A invalidates old token; missing token yields 428; altered/wrong-owner/wrong-namespace tokens fail; header/form conflict fails; stale client cannot silently refresh/replay intent. |
| **T-CONCURRENCY** | Two starts with same idle revision on independent processes/connections yield one target and one start event; simultaneous stop/start/stale stop; separate devices share one mode; stale expiry batch cannot clear new selection; no unconditional upsert. |
| **T-EXPIRY** | Exact deadline, non-sliding reads, minimum/maximum/invalid duration, backward/skewed clock behavior, delayed pruning, expiry concurrent with stop/start, no business action on expiry-triggering request. |
| **T-INVALIDATION** | Actor/target deleted, suspended, security stamp changed, verification lost, global tenant membership/eligibility removed; no implicit fallback handler; target deletion does not block stop; no actor credential is issued by the mode transition beyond native authentication behavior. |
| **T-TOKEN** | Expired/revoked actor token rejected; restricted token cannot start/use/stop without configured capability; single-token revocation does not clear global mode used by another valid credential; token scopes never copied onto target model; competing cookie identity cannot replace selected token actor. |
| **T-ACTIONS** | Active unsafe methods denied by default; explicit ordinary mutation allowed only with target permissions; active sensitive routes, including billing/payment-method/subscription mutations, denied regardless of override; idle sensitive routes follow normal actor permissions with context token; unsafe verb cannot be labeled read to bypass; boot/request coverage rejects unclassified routes; GET side effects explicitly classified; logout applies to original credential only. |
| **T-KIT** | Actor real revision/token/handle checked; session management on/off; actor/target initial null revision; password reset, logout-all and restrictions invalidate modes appropriately; no target registry row; original session row can still be revoked normally. |
| **T-KIT-HTTP** | Managed account/profile/password/email/provider/session/proof actions blocked while active, including authenticated public proof route; explicit CSRF bootstrap and original-credential logout safe; target's separate normal traffic unaffected; no target ID paired with actor credential evidence. |
| **T-FAILURE** | Store read/write/audit failure, unique conflict, busy timeout, transaction rollback, lost commit acknowledgement, provider outage, policy exception, stamp decryption/key failure, process crash before/after commit; status supplies current state but does not prove historical command outcome; matching transition record proves commit and absent record stays indeterminate without definitive database evidence; no automatic compensation or replay. |
| **T-AUDIT** | State and event atomicity; deduplicated successful transition; admitted start/stop denials/input failures/conflicts and idle-stop no-ops recorded without themselves changing revision; a separately required expiry/invalidation may advance revision before the control denial; pre-boundary/throttled controls and business/status local denials require no package event; required control-outcome write failure returns 503; denial minimization; stop/expiry/invalidation reason codes; rejected/never-settling observers and reporters preserve committed results within the shared deadline; saturation bounds pending callbacks and late rejection is handled; no exactly-once notification claim. |
| **T-PRIVACY** | No secrets/stamps/raw models in status, errors, logs or events; no target enumeration; trimmed reason, whitespace-only rejection, Unicode code-point/UTF-8 byte boundaries and bounded body, correct i18n fallback, safe HTML example escaping, no untrusted redirects; retention/owner erasure/key rotation; business audit projections distinguish namespaces and reused actor/effective IDs in active and idle mode; reused actor/target IDs with a new incarnation reject old mode/context; erased owner cannot recreate old idle assertions. |
| **T-STORE** | Reusable conformance suite against real SQLite/PostgreSQL; concurrent multi-process uniqueness/CAS; owner isolation; idle tombstone retention; malformed state; revision precision; transaction event rollback; custom store contract rejects fake process-local atomicity. |
| **T-PACKAGE** | Build/exports/configure in immutable packed consumers; native root without Account Kit/Lucid installed; optional subpaths with required peers; one native framework user model; numeric/string/UUID IDs; alternate users table; root import has no side effects. |
| **T-UI-CONTRACT** | Accessible application example for server-rendered and API client flows; mode visible after another device starts/stops; stale mutation rejected without submitting handler; browser cache/back button cannot authorize actions; reason is not exposed in target banner. |
| **T-TENANT** | Different identity namespaces cannot collide; same actor across included guards shares mode; actor/target cross-tenant denial; two devices in tenants A/B prove B-local denial leaves A mode/revision unchanged, while global membership loss invalidates it; local policy exceptions return 503 without clearing; tenant context not inherited incorrectly from actor; target settings are not chained into another effective target. |

Tests MUST include positive and negative native-only applications and Account Kit consumers. At least one real browser example demonstrates how a server-owned mode appears across pages, but the correctness mechanism must be proven through independent authenticated HTTP clients as well. API correctness is not inferred from a banner fixture.

### 12.0 Product-to-verification traceability

| PRD criteria | Verification families |
|---|---|
| AC-01: server-owned actor-to-target setting | T-AUTH, T-STORE, T-CREDENTIALS |
| AC-02: cross-device actor/effective identity | T-IDENTITY, T-TOKEN, T-CONCURRENCY |
| AC-03: target authorization, actor audit, no union | T-IDENTITY, T-TENANT, T-AUDIT |
| AC-04: explicit authorization denial/error | T-AUTH, T-FAILURE |
| AC-05: no nesting, competing transitions | T-AUTH, T-CONCURRENCY, T-STORE |
| AC-06: stop without target/start authority | T-AUTH, T-INVALIDATION, T-TOKEN |
| AC-07: local logout and account-global mode | T-CREDENTIALS, T-TOKEN, T-KIT |
| AC-08: credential versus epoch revocation | T-INVALIDATION, T-TOKEN, T-KIT |
| AC-09: global invalidation versus local denial, no fallback | T-INVALIDATION, T-ACTIONS, T-TENANT |
| AC-10: expiry/stale request rejection | T-EXPIRY, T-CONTEXT, T-ACTIONS |
| AC-11: idle and active context assertions | T-CONTEXT, T-UI-CONTRACT |
| AC-12: mutation/sensitive policy | T-ACTIONS, T-KIT-HTTP |
| AC-13: minimized attributable audit | T-AUDIT, T-PRIVACY |
| AC-14: durable state versus observers | T-FAILURE, T-AUDIT, T-STORE |
| AC-15: independent package and adapter | T-PACKAGE, T-KIT, T-CREDENTIALS |
| AC-16: complete adoption/deployment guidance | T-UI-CONTRACT, T-PACKAGE, T-KIT-HTTP, documentation review |

Functional requirements FR-01–FR-31 and NFR-01–NFR-08 are reviewed alongside their grouped acceptance criteria; an implementation must retain a requirement-to-test evidence ledger. A family label alone is not a passing result. The release review must identify exact tests/consumer runs for each requirement and mark any unmet criterion explicitly.

| Requirement group | Product criteria / additional direct evidence |
|---|---|
| FR-01, FR-06 | AC-01, AC-02, AC-05; T-STORE owner/incarnation/CAS invariants |
| FR-02 | AC-02, AC-15; T-CREDENTIALS proves no mode-induced credential effects beyond native authentication |
| FR-03, FR-04 | AC-03; T-IDENTITY actual Auth facade and Bouncer behavior |
| FR-05 | AC-05 |
| FR-07 | AC-10; T-EXPIRY boundary/non-renewal tests |
| FR-08, FR-09 | AC-16; T-ACTIONS coverage and T-PACKAGE route mounting |
| FR-10 | AC-06 |
| FR-11 | AC-09, AC-10 |
| FR-12 | AC-07, AC-08 |
| FR-13 | AC-02, AC-16 |
| FR-14, FR-15 | AC-11; T-CONTEXT token/MAC/idle assertions |
| FR-16, FR-17, FR-18 | AC-12; T-ACTIONS and T-KIT-HTTP |
| FR-19 | AC-09, AC-10 |
| FR-20 | AC-04, AC-09; T-TENANT global versus local policy cases |
| FR-21, FR-22, FR-23 | AC-08, AC-09; T-TOKEN and T-KIT event matrix |
| FR-24, FR-25 | AC-15, AC-16; T-KIT and each native packed transport |
| FR-26, FR-27, FR-28, FR-29, FR-30 | AC-13, AC-14; T-AUDIT and T-PRIVACY |
| FR-31 | AC-15; T-STORE and optional-peer packed consumers |
| NFR-01, NFR-02, NFR-03, NFR-04 | T-AUTH, T-FAILURE, T-CONCURRENCY, T-CONTEXT, T-STORE |
| NFR-05, NFR-06 | T-IDENTITY, T-TOKEN, T-KIT-HTTP, T-PACKAGE |
| NFR-07, NFR-08 | T-PACKAGE, T-UI-CONTRACT and deployment/documentation review |

### 12.1 Commands and compatibility evidence

Use Node 24 and pnpm. The following are **required future repository scripts**, not commands claimed to exist in this specification-only repository:

```sh
nvm use
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
pnpm quick:test
pnpm test:pg-service
pnpm test:pg
pnpm test:consumer --mode=native-session
pnpm test:consumer --mode=native-token
pnpm test:consumer --mode=account-kit-session
pnpm test:consumer --mode=account-kit-token
pnpm test:e2e
```

Each consumer mode must run on SQLite and PostgreSQL where it uses SQL persistence, at declared exact minimum and latest compatible dependency sets. Record candidate revision/archive digest, exact Node/pnpm/framework/adapter/database versions, command outcomes and limitations. Use pnpm-native dependency audit before release and triage reachability. No different package manager or competing lockfile is introduced.

For the future Account Kit public snapshot change, use its actual existing scripts: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm quick:test`, `pnpm test:pg-service`, `pnpm test:pg`; add its existing packed-consumer release gates as applicable. Keep external-store tests and Account Kit tests in their owning repositories. Assign one integration owner to run the final combined matrix rather than every worker repeating it.

No runtime test results are asserted by these documents. For this documentation-only delivery, verify links, requirement/test references, terminology, obsolete-design removal, and consistency between the PRD and specification; product tests are not evidence for prose correctness.

## 13. Dependency order and review handoff

This is a proposed delivery sequence for estimating and review, not an approved implementation task list.

1. **Architecture proof:** settle account-global scope, native transport matrix, effective-guard/Bouncer semantics, context-token adoption cost, and the Account Kit inspection API. Exercise a tiny real framework proof before treating those contracts as frozen.
2. **First useful native milestone:** core service + SQL CAS/audit + native session effective guard; demonstrate start → target read → stop with two independent actor credentials and no credential effects beyond native authentication.
3. **Complete safety lifecycle:** expiry/invalidation, context checks, failure/commit uncertainty, pruning/privacy, and native token scope integration. No production-ready claim before these pass.
4. **Account Kit integration:** review/implement generic inspection API in its own repository, then adapter/managed-route blocking and both actor transports in the external package.
5. **Packaging and examples:** exact-floor/latest packed consumers, generated configuration, explicit middleware wiring, both database backends, operator/client documentation and accessible examples.
6. **Release assessment:** reconcile every PRD criterion with the test matrix and actual candidate evidence. Resolve all required review findings. Package name/version/repository/publication and any merges remain separately controlled delivery decisions.

During implementation, workers may own core/store tests, framework guard/HTTP, or Account Kit integration independently **after** the relevant public contracts are agreed. Do not have two workers modify the same contract concurrently. Changes that invalidate a reviewed invariant return to that reviewer before broader end-to-end work.

### 13.1 Reviewer brief

Read the PRD first, then this document. Review the complete requested design, not just framework version ranges. Return findings with severity, precise section/requirement/test references, a concrete failure sequence, and a proposed correction. Separate required safety/contract fixes from optional product additions. State uncertainty and missing evidence. Do not silently implement changes, create issues, contact upstream, or publish review content.

Focused questions:

1. Is account-global mode across valid sessions **and human API tokens** the intended scope, including fresh logins while the mode is active?
2. Does the effective guard make existing Auth/Bouncer/data-access behavior unambiguous without overwriting real actor authentication? Which integration paths could still accidentally authorize as the actor?
3. Is the required context-token contract on idle and active unsafe requests acceptable? If narrowed, what stale-intent guarantee is explicitly lost?
4. Are actor account-wide stamps and per-credential capability checks sufficient and correctly separated? Does D07 match operator expectations for logout/revocation?
5. Does the generic Account Kit inspection operation expose the minimum necessary server API, preserve account locks/revision semantics, and avoid claiming target credentials?
6. Can SQL CAS and event persistence satisfy the stated semantics under rollback, crash and unknown commit, with no hidden cross-store transaction claim?
7. Are mutation classification and managed Account Kit route exclusions complete? Do the defaults fit a support-view workflow without suggesting a universal read-only sandbox?
8. Are the optional peers, data-retention costs, and native integration callbacks proportionate for a focused package?
9. Are the remaining duration/limiter proposals suitable, and is guidance for the settled reason rule sufficient? Which unresolved choices block implementation and which only block publication?

## 14. References and evidence boundaries

- [AdonisJS session guard documentation](https://docs.adonisjs.com/guides/auth/session-guard): framework login/authentication baseline; not proof of this proposed effective guard.
- [AdonisJS sessions](https://docs.adonisjs.com/guides/basics/session): ordinary session ownership remains with the actor.
- [AdonisJS custom guards](https://docs.adonisjs.com/guides/auth/custom-auth-guard) and [authorization](https://docs.adonisjs.com/guides/auth/authorization): integration contracts to verify in a real consumer.
- [Auth 10 session guard](https://github.com/adonisjs/auth/blob/10.x/modules/session_guard/guard.ts): actual native credential behavior.
- [Previously assessed package](https://github.com/devnymous/adonis-impersonate/tree/b86b3c82dcff91026473d861999a6afba9c42314): comparison/reference only; its browser-login-switch architecture is not adopted.
- [Account Kit authentication](https://github.com/Kevinjohn/oss-adonisjs-account-kit/blob/286b342f55e6252cfbe5cd1100345fef585619d6/docs/authentication.md), [managed HTTP](https://github.com/Kevinjohn/oss-adonisjs-account-kit/blob/286b342f55e6252cfbe5cd1100345fef585619d6/docs/managed-http.md), [signed-in devices](https://github.com/Kevinjohn/oss-adonisjs-account-kit/blob/286b342f55e6252cfbe5cd1100345fef585619d6/docs/signed-in-devices.md), and [verification guidance](https://github.com/Kevinjohn/oss-adonisjs-account-kit/blob/286b342f55e6252cfbe5cd1100345fef585619d6/docs/maintainers/verification.md): current owning-package contracts.

The external package, effective guard, control store, context-token protocol, and proposed Account Kit inspection method are unimplemented. Compatibility, concurrency, security and human usability claims remain acceptance targets until verified against an implementation.
