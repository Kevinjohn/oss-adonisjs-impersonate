# M3 HTTP and native-session integration

**Status: pass.** The retained starter fixture now consumes the built package tarball, a real
Lucid SQLite store, native session authentication, Bouncer and Edge. It no longer uses the M0
actor-to-target map. M0's historical evidence remains pinned in [M0-RESULT.md](M0-RESULT.md).

## Real application gate

On Node 24.21.0, the commands below pass in `examples/native-session` after the root build,
`pnpm pack:fixture`, and fixture installation:

- `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
- `pnpm test`: 14 tests, comprising four retained identity tests and ten HTTP integration tests.
- `pnpm test:report`: one report-mode test.
- `NODE_ENV=test LOG_LEVEL=info pnpm exec node ace masquerade:routes`: real grouped route output,
  including the intentional `/raw-business` coverage warning and package control recognition.

| Contract | Concrete evidence |
| --- | --- |
| Effective facade, raw actor, lazy Bouncer, global silent authentication, native HTML/JSON errors, Japa login and operator isolation | [effective_guard.spec.ts](examples/native-session/tests/functional/effective_guard.spec.ts). Native HTML still redirects to `/login`; JSON retains `Unauthorized access`. Failed native authentication reads no mode state. |
| T-CONTEXT: deterministic owner tokens; missing/malformed/query-only inputs; wrong owner/namespace; header/field disagreement | [masquerade_context.spec.ts](examples/native-session/tests/functional/masquerade_context.spec.ts), the owner-token and cross-owner cases. Query input uses the actual `_masqueradeContext` field name. |
| T-CONTEXT: pre-start and post-stop intent, A→idle→A rotation, form rendered for A and submitted by B | The same real HTTP suite tests stale tokens across transitions and submits an Edge-rendered token under another operator. |
| T-CONTEXT: immutable admitted rendering | The Edge case stops mode after admission, renders the original admitted token, rejects its later submission, and sees the actor on a fresh request. [request_admission.spec.ts](tests/request_admission.spec.ts) separately proves the frozen mode view and deadline. |
| T-CONTEXT: report migration | [tests/report/context.spec.ts](examples/native-session/tests/report/context.spec.ts) captures the missing-context warning and permits the idle request. [http.spec.ts](tests/http.spec.ts) also covers reported header/field disagreement. |
| T-ACTIONS: unsafe default denial, explicit mutation, sensitive/billing precedence, group inheritance, idle actor authorization | The real HTTP action cases exercise target Bouncer authorization, deny actor-only permissions while active, and test inherited `allowMutation()`. Billing is explicitly marked `sensitive()`. |
| T-ACTIONS: native logout and shared account mode | The real-cookie case creates two independent actor sessions and a target session through actual login forms. Logout invalidates only the submitting actor session; the other actor session keeps the shared target and the target's own credential remains valid. |
| Credential issuance and global revocation | The same case observes exactly the three initial native login attempts; starting mode adds none. Advancing the actor stamp rejects the triggering request with 409, then a fresh request is idle. |
| Raw/control boundaries during outage | The outage case proves zero mode reads on raw routes and logout; login still succeeds, while stop/status return 503 and business admission fails closed. |

The credential test uses ordinary Node HTTP requests because the Japa session plugin deliberately
creates and destroys a session per test-client request. Independent cookie jars exercise real
session persistence rather than treating `loginAs` as a persistent device.

## Package checks

Root checks on Node 24.21.0 pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
`pnpm test:built-exports`, and `pnpm test:pg`: 157 SQLite tests, 153 PostgreSQL 16 tests and two
built-export tests. Built-export tests assert the actual named APIs and
command discovery, and retain the fresh-process optional-import boundary. The packed application
also proves shared factory recognition, admission symbols and route marker metadata across
compiled entry points. PostgreSQL store regressions remain part of the root suite; M4 adds the
packed PostgreSQL and dependency floor/latest consumers.

## Decisions

- `sessionAuthority` returns an explicit `{ authority, authenticateActor }` adapter. The host
  binds it as `masquerade.native` and supplies its authority in configuration. It uses the same
  public session user provider as the raw guard and obtains canonical IDs through
  `createUserForGuard().getId()`, without assuming a model's primary-key property. Native mapping
  never reads stamps or account eligibility, so recovery controls retain their contract.
- Provider boot validates configuration, native namespace/guard wiring, the effective default
  and store suitability. It constructs the runtime without reading mode state. All marked
  effective guard aliases share that runtime. Raw/public authentication never admits a mode.
- Context middleware surrounds stock silent authentication and named auth. A genuine missing
  native credential is deferred to named auth for its configured redirect and native message.
  Domain errors remain terminal, cached admission rejection remains cached, and downstream
  errors never cause a second dispatch.
- Covered routes must select effective guards exclusively. Mixing an effective guard with a
  raw/token fallback returns 503 before admission or handler dispatch: either guard ordering
  could otherwise bypass context enforcement or replace the effective facade identity. The
  route report warns about this wiring. Implicit defaults resolve to their actual guard name;
  an explicitly named `default` guard receives no special exemption.
- Controls accept JSON and URL-encoded input, including Shield's `_csrf` transport field. They
  measure the retained raw body against 8 KiB, reject uploads/unsupported payloads, preserve
  native empty-body framing, and parse only canonical integer form durations. Business payload
  limits remain the host's responsibility. Invalid controls enter the core denial-audit path.
- Header/field disagreement is 409. Its core conflict token has revision zero and 32 hex
  characters, so it cannot equal either a no-row 64-character token or a positive row revision.
  Report mode logs the would-be context error and continues; start/stop always enforce.
- Edge sharing uses the admitted frozen view, never a later status read. Models retain their
  native mutability; the copied subject shells and audit projection are immutable.
- Markers come from actual route/group middleware metadata. `sensitive()` always wins over
  `allowMutation()`. The host must mark billing and other sensitive business semantics; the
  package does not guess them from URLs.
- Route reporting commits the router, resolves lazy controller default exports by actual class
  identity/inheritance, and groups the real default/explicit guards. Exact documented auth-route
  names are conventions for host controls; ambiguous names and unresolved string controllers
  remain visible for host review. Arbitrary middleware semantics cannot be inferred by the report.
- The fixture installs a relative local tarball instead of linking the repository's dependencies,
  avoiding duplicate framework instances. Its committed-data cleanup supports real SQL CAS.

## Behavior-sensitive verification

Temporary mutations were restored before the passing runs. Twelve guard/native/runtime mutations
were caught. Fixture mutations removed silent-auth observation, selected a raw default, removed
mutation permission, changed target Bouncer resolution to the actor, and changed enforce to
report; each broke its intended proof. HTTP regressions caught an inverted wire-size limit and
removal of chunked-body detection. Additional red/green checks established frozen admitted views,
authority freezing, native zero-length request handling, named-auth error rendering and route
commit before Ace reporting. Export assertions failed against the previous empty adapter build.

M4 documentation, configuration scaffolding, packed dependency consumers and the complete
requirement ledger remain the next milestone. No publication, tag, rename or merge is included.
