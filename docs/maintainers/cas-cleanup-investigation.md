# CAS result and connection cleanup investigation

## Conclusion

No supported Knex/Lucid release path was found that rejects after an acknowledged CAS. The release method could mask a returned CAS result if it rejected, but installed Knex does not produce a rejecting promise for ordinary pool release. A disposable SQLite probe confirmed that replacing `releaseConnection` with a deliberately rejecting proxy masks the result even though the transaction and event have committed. That demonstrates JavaScript `finally` behavior under an invented adapter contract; it is not evidence of a production Knex failure. No runtime change is warranted from this investigation.

## Dependency and source evidence

The frozen worktree install resolved `@adonisjs/lucid` 22.4.2, Knex 3.3.0, Tarn 3.1.2, and `better-sqlite3` 12.11.1.

- In Knex 3.3.0 `lib/client.js`, `Client.releaseConnection` synchronously calls `this.pool.release(connection)` and returns `Promise.resolve()`. Tarn 3.1.2 `dist/Pool.js` emits its `release` event, returns `true` when it finds and frees the checkout, and returns `false` when it does not. Tarn's `_executeEventHandlers` catches each listener exception and logs it before continuing pool release. Knex logs the false result and still returns the resolved promise. Thus even a throwing Tarn release observer does not reject ordinary release.
- The normal Lucid-created Knex pool is Knex's owned Tarn pool. Lucid's configured `afterCreate` callback is removed before the Tarn pool is constructed. The store also rejects externally supplied Knex `connectionPool` instances, so their custom `release` implementations are outside this adapter's supported setup.
- In [stores/lucid.ts](../../stores/lucid.ts), `compareAndSet` awaits `transaction.commit()` and its transaction completion result before returning `applied`; its `finally` then awaits `releaseConnection`. A rejecting replacement for that method would override the pending return, as the disposable probe showed.
- Knex's transaction runner does not release the provided connection when `transaction({ connection })` is used. The store therefore owns and releases that checkout after its transaction path finishes.

## Failure cases kept distinct

The repository already tests real SQLite cleanup behavior in [tests/lucid_commit.spec.ts](../../tests/lucid_commit.spec.ts): a reader lock causes a real busy COMMIT; native rollback cleanup makes the connection safe for reuse; an intentionally broken native rollback retires the pool and leaves the store unavailable; a safe busy-COMMIT retry reuses the same transition ID; and quarantine does not block while another checkout drains.

The unknown-commit case in [tests/lucid_control_store.spec.ts](../../tests/lucid_control_store.spec.ts) is a separate deliberate probe: it performs a real commit, then its wrapper throws as if the acknowledgement were lost. The store returns `indeterminate`, does not replay the transition, and the row and event are present. This is the defined unknown-acknowledgement simulation, not a release failure.

A temporary SQLite test attached a throwing listener to the actual Tarn pool's documented `release` event. The listener ran on both a direct release and the store's post-commit release; Tarn caught and logged both exceptions, and CAS still returned `applied` with the row and event committed. This tested the dependency's documented event path, which does not reproduce the issue.

A separate temporary SQLite test wrapped the installed Knex client's `releaseConnection`, performed the actual release, then returned a rejected promise. It observed a rejected CAS call while confirming the row and event were committed. Because this probe replaced the library method itself, it establishes only that an arbitrary rejecting cleanup promise can mask a prior return. Both temporary probes were removed after execution and are not included as product tests.

## Verification

Using Node 24.21.0 and pnpm 11.23.0, on temporary SQLite files created and removed by the test fixture:

- `pnpm quick:test --files=lucid_commit.spec.ts` — 5 passed.
- `pnpm quick:test --files=lucid_control_store.spec.ts` — 10 passed, including the unknown-acknowledgement case.
- Temporary `pnpm quick:test --files=cas_cleanup_investigation.spec.ts` — 1 passed for the fabricated release rejection with committed-row/event assertion, then 1 passed for a throwing Tarn release observer being contained with CAS still applied; the temporary test file was removed.

No live database, remote fault injection, or Docker was used. PostgreSQL was not needed because no runtime change was made.
