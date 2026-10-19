# M1 core result

The memory-backed core milestone is implemented. SQL persistence and HTTP integration remain M2 and M3 respectively.

## Public and internal boundaries

- The root exports `defineConfig`, `createMasqueradeService`, `MasqueradeError` and domain types. It imports no framework, Lucid or Account Kit runtime module.
- `defineConfig<User, Request>(config)` validates synchronously and freezes a copied configuration. `createMasqueradeService<User, Request extends object>(config, dependencies)` resolves the asynchronous store factory and returns the start/stop/status/resolve service.
- Runtime dependencies are separate from configuration: required native `authenticateActor(request)`, explicit `environment`, emitter, logger and observer error handler; optional `clock(): Date`. Requiring diagnostic ports prevents an unknown commit from silently losing its transition correlation. Production integration binds the framework ports.
- A generic request has no authentication method. The separate authenticated-actor resolver supplies a canonical `Subject<User>` after native credential validation. Native authentication exceptions retain their native rendering and never enter the control audit boundary.
- The internal `src/request_admission.ts` symbol exposes the admitted actor/effective subjects to the later effective guard. It is absent from the root public API. Public resolve returns only a frozen identity/context projection. Internal Subject shells are copied and frozen with readonly fields; the native User models retain their ordinary mutable identity. Inflight, successful and rejected admission outcomes are memoised for the request lifetime. Recovery requires a fresh request, so a caught invalidation cannot retry as the actor or a concurrent winner.
- `./testing` exports `MemoryControlStore` and `assertControlStoreConformance(createStore)`. The memory store declares `testOnly`; service creation rejects it unless the explicit runtime environment is `test`.

## Transition gate: actual mutation evidence

Each mutation was applied independently to working source, its focused repository test command was run, and the original source was restored in a `finally` block. Every listed mutation produced an assertion failure, rather than a loader or compilation failure. All 23 mutations were killed.

| SPEC 6.4 row                            | Disabled behavior                                                 | Failing test evidence                                                                                                                             |
| --------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1: absent/idle start                    | Omit the successful start CAS                                     | `core_service.spec.ts`: `start persists bounded reason and hashes; projections and observers expose only safe fields`; lifecycle test also failed |
| 2: second start                         | Remove already-active rejection                                   | `core_service.spec.ts`: `starts, rejects nesting, stops and preserves idle revisions`                                                             |
| 3: active stop                          | Return active row instead of clearing                             | `core_service.spec.ts`: `stop ignores target deletion, denied policies and failing stamp access`                                                  |
| 4: idle stop                            | Omit noop outcome write                                           | `core_service.spec.ts`: `matching idle stop records a noop and never rotates the context`                                                         |
| 5: stale start/stop                     | Remove current-token equality rejection                           | `core_service.spec.ts`: `stale start and stop cannot overwrite or clear the current winner`                                                       |
| 6: expiry                               | Disable active-admission expiry branch                            | `core_service.spec.ts`: `exact expiry clears durably without stamp access and rejects the triggering request`                                     |
| 6: stamps                               | Independently disable actor-hash and target-hash comparisons      | Corresponding `global invalidity actor_stamp` and `global invalidity target_stamp` cases failed                                                   |
| 6: eligibility/policy                   | Disable global invalidation clear/rejection                       | Actor/target ineligibility, policy denial, target-incarnation and both stamp cases failed                                                         |
| 7: request-local rejection              | Remove local-policy denial                                        | `core_service.spec.ts`: `credential and local denial preserve mode; native rejection writes no package event`                                     |
| 8: malformed authoritative state        | Bypass row validator                                              | `row_validation.spec.ts`: `malformed store rows fail closed across status, controls and admission`                                                |
| 9: exhausted revision                   | Remove maximum-revision guards                                    | `core_service.spec.ts`: `revision exhaustion fails closed without wrapping or transitions`                                                        |
| Additional: unknown commit              | Remove unknown-commit denial suppression                          | Both committed-start/stop lost-acknowledgement tests in `core_failures.spec.ts` failed                                                            |
| Additional: rejection retention         | Delete the memo after a rejected admission                        | Repeated expiry/stamp/policy rejection tests and the conflicting-expiry test failed                                                               |
| Additional: malformed CAS outcome       | Restore direct status dereference on null/undefined store outcome | Four committed-start/stop null/undefined cases failed without correlation diagnostics and with false denials                                      |
| Additional: internal immutability       | Remove copied/frozen Subject shells                               | `request_admission.spec.ts` immutable-shell case failed                                                                                           |
| Additional: control duration            | Restore nullish default for start duration                        | Explicit-null start-duration test failed                                                                                                          |
| Additional: config duration             | Restore nullish defaults for configuration durations              | Explicit-null configuration-duration test failed                                                                                                  |
| Additional: inherited methods           | Replace explicitly copied methods with an authority spread        | Class-based configuration test failed                                                                                                             |
| Additional: callback receivers          | Remove original-receiver method binding                           | Class-based configuration test failed                                                                                                             |
| Additional: reason normalization order  | Restore raw-input size cap before trimming                        | Long-whitespace-padding reason test failed                                                                                                        |
| Additional: expired-start audit failure | Omit expiry persistence before rejected stale intent              | Failed expired-start denial-audit regression failed                                                                                               |
| Additional: request consistency         | Disable inflight admission memo lookup                            | `core_authorization.spec.ts`: `concurrent admission of one request authenticates and reads authoritative state once`                              |

Commands used the repository runner: `pnpm quick:test --files=<named spec>`. The initial lifecycle test failed before exports existed. Separate red/green checks exposed and fixed exhausted-revision ordering, canonical self-target denial and missing diagnostic ports.

## Coverage and decisions

- Authentication/authorization: false and nonboolean approval, throwing policies, canonical self-target, missing/ineligible target equivalence, native rejection without audit, recovery stop after permission loss/deletion, and unknown client fields.
- Context/coordination: owner/namespace/incarnation binding, malformed/oversized token handling, stale commands, retained idle revisions, active-to-idle-to-active, shared devices, competing starts, concurrent stop/start and expiry racing a newer selection.
- Expiry/invalidation: fixed/default/minimum/maximum/narrowed durations, exact deadline, non-sliding reads, backward clock after durable expiry, both stamp changes, actor/target deletion or suspension, new incarnation, global policy denial and local tenant denial without global invalidation.
- Persistence/failures: malformed bounded rows, strict runtime field types, read/write/outcome failures, atomic memory CAS/event cloning, exported conformance, retention of idle rows, expiry-batch snapshots, unknown committed acknowledgement and no automatic retries.
- Privacy/observers: hashed opaque stamps bounded to 512 UTF-8 bytes; reason trim/CRLF/control/code-point/byte rules; normalized reason only on the persisted successful-start event; no reason/user/stamp in public views or observer/log projections; caught sync throws and rejected promises; pending observers/reporters are not awaited.
- Start policy receives normalized reason and request. Active admission policy receives neither. Stop/status authenticate the raw actor; stop never inspects accounts, policies or stamps. Expiry also avoids account/stamp work.
- A maximum revision fails closed even for status. A migration is required before further use. No wrap, compaction or automatic retry is attempted.
- Canonical IDs come from the provider; core does not equate numeric-looking string IDs. Canonical self-target is 422, including aliases resolved by the provider.
- The store conformance helper requires a fresh isolated store and checks CAS winners, conflicts, isolation, snapshots, outcomes and retained rows. This preliminary helper does not yet establish active-expiry ordering/bounds or detailed audit-payload completeness. Expanding conformance and independent SQL connection, busy and rollback proofs remain M2 gates.

## Verification and remaining work

The final revision passes the shared build, built-export and PostgreSQL gates. The M0 real-session fixture remains unchanged by this milestone.

M1 does not implement HTTP header/field arbitration, report/enforce middleware, route markers, native effective guard, Shield/limiter mounting, no-store headers or body-size enforcement; those are M3 responsibilities. PostgreSQL BIGINT parsing and SQL transaction/race behavior remain M2. Consumer dependency floors/latest and full requirement traceability remain M4. No publication, tag or merge is performed by this milestone.

Completed on Node 24.21.0:

- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm quick:test` / `pnpm test`: 93 passed, including 89 new M1 tests and the four existing provider/document checks. No tests were moved or disabled.
- `pnpm build`: passed.
- `pnpm test:built-exports`: 2 passed, including a fresh-process root import that rejects optional integration resolution.
- `pnpm test:pg`: 93 passed under local PostgreSQL 16; the managed server shut down successfully.
- Transition mutation gate: 23 of 23 intentional behavior mutations killed; source restored before final checks.

A temporary compiled-root Lucid import was rejected by the optional-boundary test; the import was removed and both built-export tests passed again. The prototype-getter admission regression failed before explicit Subject property copying and passed after the fix. Independent review findings are resolved.

Admission correction: repeated resolution of one request remains rejected after expiry, stamp or policy invalidation, or an invalidation CAS conflict. A new request observes the committed idle state or winner. The five affected tests were first observed failing, then passed after retaining rejected admission promises. Reintroducing rejection deletion killed all five tests; the mutation was restored before final verification.

Additional reviewed corrections: null/undefined results from an already-committed store operation follow unknown-commit handling, with only the pre-generated transition correlation logged and no success emission or false denial. Internal admission copies/freezes Subject shells without freezing native models. Explicit null durations fail integer validation in configuration and controls; defaults apply only to omitted values. Seven new regression cases were observed failing before implementation, then passing; four corresponding behavior mutations were killed and restored. Final assigned checks below include these corrections.

Final configuration/normalization review: known configuration fields are copied explicitly, with authority, incarnation, policy and store callbacks bound to their original receivers. Class implementations with inherited methods remain valid. Reason validation trims before applying normalized bounds; HTTP raw-body limits belong to M3. An expired start may commit expiry and then fail its separate denial audit: the response is503, and the committed idle row/expired event remain. A failed outcome write itself changes no state; it never compensates a completed transition. Class receiver and padded-reason tests were red before implementation; the expiry/audit interaction was already correct and received a regression test. Four additional independent mutants were killed and restored.

Namespaces use an ASCII letter/digit-led identifier with letters, digits, underscores, periods, colons and hyphens, bounded to 128 UTF-8 bytes. Numeric target inputs must be safe integers; larger or non-numeric provider IDs use strings unchanged. When narrowing the maximum below the 900-second default, the host must also set a valid default duration. Successful-start audit retains the normalized reason; denial records omit it and observer/log projections always omit it. These are explicit v1 validation and privacy choices.
