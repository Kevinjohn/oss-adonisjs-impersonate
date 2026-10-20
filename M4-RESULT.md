# M4 release-candidate readiness

**Status: M4 verification complete.** The release candidate remains unpublished, untagged and
unmerged; this record does not authorize or imply publication.

## Completed documentation work

- User setup, native-session wiring, guard boundaries, route protection and migration steps:
  [docs/guide/setup.md](docs/guide/setup.md).
- Account-global behavior, logout and stamp semantics, context-token rollout, sensitive routes,
  audit, retention, owner erasure, job and in-flight limits:
  [docs/guide/security.md](docs/guide/security.md).
- Root project overview and agent-facing integration notes: [README.md](README.md) and
  [README-AGENTS.md](README-AGENTS.md).
- Retained requirement map: [docs/maintainers/requirement-ledger.md](docs/maintainers/requirement-ledger.md).

Content is ready for review. The scoped repository link check passed: `pnpm quick:test
--files=docs_links.spec.ts` reported 3 passing cases on Node 24.21.0. The final `pnpm docs:build` log
(`/tmp/masquerade-m4-docs-final.log`) reports TypeDoc and VitePress success with no warnings. The
ledger keeps documentation review distinct from executable tests.

## Prior milestone evidence

M3's real application gate and earlier root checks are recorded in [M3-RESULT.md](M3-RESULT.md).
That result covers the Node 24.21.0 native-session fixture with 14 passing cases (four M0 identity,
ten M3 HTTP), one report-mode case and the real router report. It is historical evidence; M4 checks
are recorded below.

The real cookie test `logout ends only the actor session that submitted it` verifies two actor
sessions, a target session, mode continuity after one actor logout, unchanged target credentials,
no extra login attempt from starting mode, then stamp-change 409 followed by fresh idle mode. The
billing case proves host-applied `sensitive()` wins over `allowMutation()`; it does not imply URL
classification. These settled details are carried into the guides and ledger.

After the async migration correction, `pnpm test` passed 162 SQLite tests and `pnpm test:pg`
passed 158 PostgreSQL 16 tests; the PostgreSQL server stopped cleanly. `pnpm build`,
`pnpm typecheck`, `pnpm test:built-exports` (2 checks), `pnpm lint` and the final docs build passed.

## M4 verification results

| Gate | Required evidence | Result |
|---|---|---|
| Configure | Native Ace invocation; preflight and generated host artifacts; no auth/kernel/routes rewrite; force/conflict behavior; optional root imports remain safe. | Six focused configure/migration cases passed. Three configure mutants (overwrite, provider registration, middleware registration) and three packed-harness mutants (floor-selection mismatch, optional Lucid runtime import from package root, missing configure export) were killed. All five generated artifacts compile against real default User/UserSchema and host aliases at floor and latest. |
| Packed consumer | Frozen package at actual peer floor/latest on SQLite/PostgreSQL; record versions; run native session, report and credential scenarios; inspect optional imports and alternate user IDs. | Four cells passed: floor/SQLite, floor/PostgreSQL 16.15, latest/SQLite, latest/PostgreSQL 16.15. Both profiles passed generated compile, the fresh-root-process probe rejecting all `@adonisjs` and Account Kit runtime imports, lint and build. Each database cell passed typecheck, 16 functional cases, one report case and one expanded credential scenario: 72 executions total. The artifact had 59 installed peer checks per profile and zero incompatible peer warnings. |
| Native credential paths | Expired non-remembered credential cannot control mode; valid remembered recovery preserves actor/effective identities and permits stop/start. | `examples/native-session/tests/credentials/native_credentials.spec.ts` — “recovers the raw actor through remember-me after native session expiry while the effective guard keeps the admitted target”: 1/1 passed with lint/typecheck. Expired-session status/raw/effective/start/stop return 401 with valid fresh CSRF and leave row/event count unchanged. Starting the mode preserves the native session and remember cookie; after native session expiry, remember-me recovery creates a new session and rotates the remember cookie, after which status/stop/start/stop succeed. Target token count stays zero. The remembered-feature-off mutant fails during initial login (so it does not reach the expiry branch); a 10-second TTL mutant fails at exact expiry. |
| Requirements ledger | Map retained FR-01–31, NFR-01–08 and AC-01–16 to concrete tests/docs; mark deferred clauses and optional probes accurately. | Reconciled in [requirement-ledger.md](docs/maintainers/requirement-ledger.md); no retained acceptance requirement remains uncovered. |
| Documentation | Relative path/anchor check and generated TypeDoc/VitePress build. | `pnpm quick:test --files=docs_links.spec.ts`: 3 passed on Node 24.21.0. Final `pnpm docs:build`: TypeDoc and VitePress passed with no warnings. |

The packed artifact SHA-256 is `60228e9878167652a690b42a17a8a4d37d72fa9b8b6b4f72354a4de23f0c27a9` (Node 24.21.0). Resolved package versions were:

| Profile | Core | Auth | Bouncer | Lucid | Session | TypeScript | Vite integration |
|---|---:|---:|---:|---:|---:|---:|---:|
| Floor | 7.0.0 | 10.0.0 | 4.0.0 | 22.4.2 | 8.1.0 | 5.9.3 | 6.0.1 |
| Latest compatible | 7.6.0 | 10.1.0 | 4.0.1 | 22.4.2 | 8.3.0 | 6.0.3 | 6.0.2 |

Both profiles used assembler 8.5.2, Japa Adonis plugin 5.2.0 and Japa runner 5.3.0. Vite integration 6.0.1 is used at floor because 6.0.2 requires Core 7.5. All 59 installed peer checks had no incompatible warnings. The alternate-user case exercises a real `support_accounts.account_key` string/UUID primary key without an `id` column, composing native provider, core/service and SQL; it does not claim a second independent effective-guard facade. The normal numeric User fixture retains its 14 real HTTP cases. The matrix manifest was recorded at `tmp/consumers/60228e987816_97836fd1/results.json`. All
retained v1 requirements are mapped in the ledger and all four packed consumer cells passed. The
package remains unpublished, untagged and unmerged.
