# M2 persistence result

SQL persistence is implemented behind the optional `./stores/lucid` export, with bounded expiry and retention housekeeping exposed by the `./commands` loader.

## API and schema

- `new LucidControlStore(db.connection(), options?)` accepts the installed Lucid 22 query-client port: `getWriteClient`, `knexQuery`, `dialect`, `isTransaction` and `mode`. It rejects transaction clients, read-only clients and unsupported dialects. Hosts inject a write-capable client backed by a Knex-owned Lucid pool. Externally managed `knex.client.config.connectionPool` configurations are rejected at construction, because public Knex destruction cannot retire those pools. The adapter imports Lucid types only; the root continues to import no SQL runtime.
- The same subpath exports `createMasqueradeSchema(schema)` and `dropMasqueradeSchema(schema)`. These return the schema builder. Await the returned builder for direct execution; call without awaiting inside a Lucid `BaseSchema` migration so Lucid retains execution order and dry-run behavior. `stubs/migrations/create_masquerade_tables.stub` demonstrates this.
- Fixed tables are `masquerade_modes` and `masquerade_events`. The unique owner key contains namespace, canonical actor ID and actor incarnation. Event IDs are unique independently. Revision uses PostgreSQL BIGINT and SQLite integer affinity. A mode-expiry index and event-retention index support bounded housekeeping.
- UTC instants are canonical ISO strings with milliseconds stored as bounded text on both engines. This avoids session timezone and driver date conversion differences and preserves exact lexical ordering. Row reads validate the complete core row, including strict safe-integer conversion of PostgreSQL BIGINT strings and canonical UTC timestamps. Invalid persisted rows fail closed.
- No production dependency was added. Development installs Luxon and its type definitions, required peers for exercising the installed Lucid runtime.

## Atomicity and failure handling

Owner creation uses an insert with conflict handling targeted only at the owner unique key. Existing owners use a conditional update containing the expected revision and complete owner key. A transaction inserts the event only after the row write wins. Conflicts roll back without an event; unrelated event constraints throw and roll back the row. Event IDs and the command are copied once before retries.

SQLite retries only recognized lock/busy failures before a definite commit, with three retries and ten milliseconds between attempts by default. Options bound retries to 0–10 and delays to 0–1,000 milliseconds. The host also owns its connection's native busy timeout; tests set five milliseconds on both independent connections. Native driver waits add to the adapter's bounded retry waits. A definite commit rejection rolls back; a recognized busy commit can safely retry after rollback. Any unclassified commit rejection returns `indeterminate` with the original transition ID and performs no retry or compensation. The lost-acknowledgement test injects a failure after a real commit; it does not claim to reproduce an actual network disconnect.

The adapter owns a pooled checkout explicitly and supplies it through Knex's public transaction `connection` configuration. A transaction's public `executionPromise` is observed immediately and awaited before reporting success. This is necessary because the installed Knex implementation can fulfill the COMMIT query promise while rejecting transaction completion. The checkout remains held while a failed SQLite COMMIT's native transaction is rolled back; Knex's completed flag alone does not establish native cleanup. Reads and host connection hooks retain the existing Lucid pool semantics, including in-memory SQLite compatibility.

If native cleanup itself fails, the adapter permanently fails closed and starts public Knex pool shutdown before releasing its checkout, then releases its own checkout and returns the original failure classification without awaiting unrelated work. New checkout fulfillment stops immediately; already admitted work drains asynchronously and its resources close afterward. Waiting for that drain could deadlock work that holds another checkout while awaiting the failed CAS. The shutdown rejection is observed immediately, including background rejection after the CAS returns. Retiring the pool also disables the host's shared Lucid connection; the host must reconnect or restart and create a new adapter. This exceptional outage is intentional: an uncertain native transaction must not be returned for unrelated application work. No private driver fields or pool internals are modified.

`recordControlOutcome` writes one event without updating state. Event retention deletes a bounded selected set in one statement, uses strict `at < before`, and never deletes owner rows. Expiry scans return validated bounded snapshots ordered by update time and owner key.

## Evidence

All commands use Node 24.21.0 and repository scripts.

- `pnpm quick:test --files=lucid_commit.spec.ts --files=lucid_control_store.spec.ts --files=lucid_schema.spec.ts --files=memory_control_store.spec.ts`: 19 passed after the native-COMMIT and asynchronous-quarantine corrections.
- `pnpm test:pg --files=lucid_commit.spec.ts --files=lucid_control_store.spec.ts --files=lucid_schema.spec.ts --files=memory_control_store.spec.ts`: 14 passed against real PostgreSQL 16.15 after the native-COMMIT correction and before the final asynchronous-quarantine/external-pool refinements, including migration execution and a real deferred-constraint failure at COMMIT. The server shut down successfully. SQLite-only cases are not registered under PostgreSQL. The supervising final PostgreSQL gate must validate the final quarantine refinements and external-pool rejection case.
- `pnpm lint --fix` and `pnpm typecheck`: passed after the scoped correction. Shared final checks must be rerun against the corrected implementation.


`tests/helpers/sql_store.ts` creates two independent Lucid `Database` instances with separate one-connection pools. SQLite uses one unique temporary file per fixture; PostgreSQL uses one unique schema per fixture and honors the repository's DB environment variables. Neither race uses a process mutex. `tests/lucid_control_store.spec.ts` races both absent-owner inserts and existing-revision updates: each phase produces exactly one applied result, one conflict and one additional audit event. Duplicate event IDs independently prove insert and update rollback. Audit assertions compare the complete stored start payload, including both incarnations, target, normalized reason, revision and transition ID.

The exported conformance suite runs unchanged against memory and SQL. It checks concurrent CAS, all owner-key dimensions through reads and writes, stale revisions, retained rows, defensive snapshots, exact expiry boundary, ordered/bounded expiry scans, strict event-retention boundary and bounded event counts. It uses only `ControlStore` methods; adapter-specific audit payload and rollback probes stay in SQL tests. No audit-read runtime port was added.

Additional SQL tests exercise malformed persisted rows, maximum safe revision, strict BIGINT strings, independent-connection SQLite lock exhaustion and successful retry, definite commit rejection, safe busy-commit retry, lost acknowledgement without retry, outcome persistence and constructor bounds. `tests/lucid_schema.spec.ts` loads the actual migration stub and executes dry-run, up and down through Lucid `BaseSchema`.

## Native COMMIT regression correction

An independent review identified that the earlier injected commit-throw tests did not establish behavior when the SQL COMMIT statement itself failed. Both new native reproductions first failed with an assertion that the store should reject: the old adapter falsely returned `applied`.

- PostgreSQL: an audit-event foreign key is `DEFERRABLE INITIALLY DEFERRED`, so row and event inserts succeed and the actual COMMIT rejects. The corrected adapter throws, an independent connection sees neither row nor event, and removing the constraint permits a subsequent successful CAS on the same pool.
- SQLite: a real read transaction holds a shared lock while an independent writer inserts its row and event. The actual COMMIT gets `SQLITE_BUSY`. With retries disabled, the corrected adapter rejects and cleans the still-open native transaction; after releasing the reader, a subsequent CAS succeeds on the same pool.
- A second real SQLite case releases the reader after observing the native COMMIT error. Safe retry writes exactly one row/event with the original transition ID. No synthetic commit exception is used in these native cases.
- A separate deterministic cleanup-failure injection proves that shutdown prevents further use of both the failed adapter and its shared pool, while the independent connection observes no row/event. The existing lost-acknowledgement injection remains a distinct test of unknown-outcome mapping after an actual successful commit; it is not a network-disconnect claim.

A two-checkout SQLite regression keeps unrelated pooled work checked out until the failed CAS returns. It proves quarantine returns without waiting for that work, blocks new checkout fulfillment during drain and lets the test await shutdown externally after releasing the unrelated checkout. A public configuration proxy proves externally managed pools are rejected without creating or owning an external pool. Both cases failed before their respective corrections.

SQL fixtures now clean up partially initialized pools, temporary files and PostgreSQL schemas on setup failure. Reader and writer lock lifetimes have unconditional rollback in test cleanup, including assertion failures.

## Mutation checks

Each mutation was applied alone, run through the focused repository test script, and restored in a `finally` block. All eleven meaningful behavior mutations were rejected; the final five target the native-COMMIT and quarantine corrections:

| Disabled behavior | Evidence |
| --- | --- |
| Expected-revision predicate | Independent update race returned two applied results; conformance also failed. |
| Event insertion inside the transaction | Moving the event after commit left a row after duplicate-event failure; rollback assertion failed. |
| SQLite busy retries | A released lock still produced failure instead of the expected applied transition; the race also failed. |
| Safe-integer BIGINT guard | Strict decoder accepted an unsafe numeric string; assertion failed. |
| Actor-incarnation read predicate | Conformance could not read independently stored incarnations and failed closed on the mismatched row. |
| Deferred migration execution | Awaiting the builder in migration `up` mutated the database during dry-run; assertion failed. |
| Transaction completion check | Ignoring the rejected execution promise returned applied for a real SQLite COMMIT failure; rejection assertion failed. |
| Native rollback after failed COMMIT | Omitting cleanup left SQLite in its previous transaction; same-pool reuse/retry cases failed. |
| Pool retirement after cleanup failure | Omitting public shutdown let the dirty shared connection execute another query; rejection assertion failed. |
| Asynchronous pool drain | Awaiting shutdown after releasing the CAS checkout blocked behind unrelated work waiting for the CAS; bounded-return assertion failed. |
| Externally managed pool rejection | Omitting the configuration guard allowed construction with an externally owned pool; rejection assertion failed. |

An initial mutation that removed incarnation from every persisted record was discarded as low-value evidence because NOT NULL constraints rejected fixture writes before owner-isolation assertions. It is not counted above.

## Prune command and retention

`adonisjs-masquerade/commands` implements Ace's metadata/command loader contract and discovers `masquerade:prune --batch-size=100`. It starts the host application, reads `config/masquerade`, and uses native emitter/logger services without depending on the later provider binding.

Each invocation processes one bounded pass: up to 100 candidates and events by default, with a maximum batch size of 1,000. It rereads each candidate and verifies revision/expiry before CAS. Committed expiry rotates revision/nonce, clears active-only fields, and writes one `expired` event. Unknown acknowledgements fail closed with correlation diagnostics. Idle rows remain. Host-managed retention never invokes event deletion.

The supplied store's scan and retention methods are global: pruning handles every validated namespace returned by that store, and one retention policy applies to them all. Hosts requiring different retention policies use separately scoped stores. No runtime audit-read or namespace-filter port was introduced.

`tests/prune.spec.ts` proves stale candidate protection, invalid inputs/state, global namespace handling, atomic expiry and retention boundaries. Removing the stale guard, forcing host-managed event deletion, and restoring namespace equality each made a regression fail. `tests/prune_command.spec.ts` discovers and executes the real Ace command, including a rejected listener delivered to the configured native emitter error handler while expiry remains committed. The prune event outcome matches core's `expired`.

## Final integrated verification

On Node 24.21.0 and pnpm 11.23.0:

- `pnpm lint` and `pnpm typecheck`: passed.
- `pnpm test`: 117 passed on SQLite.
- `pnpm build`: passed, including the command entry and migration stub.
- `pnpm test:built-exports`: 2 passed, including built Ace command discovery and the optional-integration root import boundary.
- `pnpm test:pg`: 113 passed on PostgreSQL 16, including real deferred-constraint COMMIT failure, independent connection races, and actual migration dry-run/up/down. SQLite-only lock cases are not registered as PostgreSQL passes. The managed server shut down successfully.
- The final SQLite native-COMMIT/quarantine subset passed 5/5 after increasing its bounded-return deadline to one second for loaded hosts; the unrelated checkout remains held until the CAS settles, preserving the regression guarantee.

All temporary behavior mutations were restored. Independent review findings are resolved. Native-session HTTP behavior and packed consumer floor/latest runs remain M3/M4 gates. No publication, tag, rename or merge is included.
