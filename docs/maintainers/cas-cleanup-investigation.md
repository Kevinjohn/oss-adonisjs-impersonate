# CAS result and connection cleanup investigation

## Conclusion

The default Knex/Lucid pool release path resolves, but a host-installed Tarn release listener can escape its error handler when it throws a non-`Error` value such as `null`. Tarn then throws while reading `.stack`; Knex's release method propagates that synchronous exception, and the store's awaited `finally` can replace an acknowledged CAS result. A disposable SQLite probe reproduced this with a documented Tarn event hook and confirmed that the row and event committed while the checkout remained in use. A configured Tarn `pool.log` callback that throws can also escape the listener error handler.

This requires a faulty host-installed observer or logger; the package does not install either hook, and an ordinary `Error`-valued listener with the default nonthrowing logger is contained. It is not evidence of a spontaneous database or driver release failure. The report records the boundary for owner review; it does not change runtime behavior or unknown-commit handling.

## Dependency and source evidence

The frozen worktree install resolved `@adonisjs/lucid` 22.4.2, Knex 3.3.0, Tarn 3.1.2, and `better-sqlite3` 12.11.1.

- In Knex 3.3.0 `lib/client.js`, `Client.releaseConnection` synchronously calls `this.pool.release(connection)` and returns `Promise.resolve()`. Tarn 3.1.2 `dist/Pool.js` emits its `release` event, returns `true` when it finds and frees the checkout, and returns `false` when it does not. Tarn's `_executeEventHandlers` catches each listener exception and calls `this.log(...)`; however, it interpolates `err.stack` without validating the thrown value and does not guard the configured logger. A `null` throw therefore escapes as a `TypeError`; a throwing `pool.log` callback can also escape. Knex then propagates the exception synchronously instead of reaching `Promise.resolve()`.
- The normal Lucid-created Knex pool is Knex's owned Tarn pool. Lucid's configured `afterCreate` callback is removed before the Tarn pool is constructed. Knex passes a host-configured `pool.log` through as a Tarn option; the callback must not throw. The store also rejects externally supplied Knex `connectionPool` instances, so their custom `release` implementations are outside this adapter's supported setup.
- In [stores/lucid.ts](../../stores/lucid.ts), `compareAndSet` awaits `transaction.commit()` and its transaction completion result before returning `applied`; its `finally` then awaits `releaseConnection`. A rejecting replacement for that method would override the pending return, as the disposable probe showed.
- Knex's transaction runner does not release the provided connection when `transaction({ connection })` is used. The store therefore owns and releases that checkout after its transaction path finishes.

## Failure cases kept distinct

The repository already tests real SQLite cleanup behavior in [tests/lucid_commit.spec.ts](../../tests/lucid_commit.spec.ts): a reader lock causes a real busy COMMIT; native rollback cleanup makes the connection safe for reuse; an intentionally broken native rollback retires the pool and leaves the store unavailable; a safe busy-COMMIT retry reuses the same transition ID; and quarantine does not block while another checkout drains.

The unknown-commit case in [tests/lucid_control_store.spec.ts](../../tests/lucid_control_store.spec.ts) is a separate deliberate probe: it performs a real commit, then its wrapper throws as if the acknowledgement were lost. The store returns `indeterminate`, does not replay the transition, and the row and event are present. This is the defined unknown-acknowledgement simulation, not a release failure.

A temporary SQLite test attached an ordinary `Error`-throwing listener to the actual Tarn pool's documented `release` event. Under the default nonthrowing logger, Tarn caught and logged it, and CAS returned `applied` with the row and event committed. A second temporary SQLite test attached a listener that throws `null`; Tarn's attempt to read `err.stack` raised `TypeError`, the CAS promise rejected after commit, and the test confirmed the row and event were persisted and the checkout remained in Tarn's used set. The test removed the listener and returned the leaked checkout before fixture cleanup.

The package itself installs no Tarn release listener and does not set a pool logger. The event listener probe attaches through Knex's internal pool object, though Tarn documents this listener API. A host-supplied `pool.log` is a Knex pool option and is passed through to Tarn. Both cases require host code that throws during cleanup diagnostics; neither is an ordinary driver failure.

A separate temporary SQLite test wrapped the installed Knex client's `releaseConnection`, performed the actual release, then returned a rejected promise. It observed a rejected CAS call while confirming the row and event were committed. Because this probe replaced the library method itself, it establishes only that an arbitrary rejecting cleanup promise can mask a prior return. All temporary probes were removed after execution and are not included as product tests.

## Verification

Using Node 24.21.0 and pnpm 11.23.0, on temporary SQLite files created and removed by the test fixture:

- `pnpm quick:test --files=lucid_commit.spec.ts` — 5 passed.
- `pnpm quick:test --files=lucid_control_store.spec.ts` — 10 passed, including the unknown-acknowledgement case.
- Temporary `pnpm quick:test --files=cas_cleanup_investigation.spec.ts` — 1 passed for the fabricated release-method rejection, 1 passed for a normal `Error`-throwing Tarn listener being contained, and 1 passed for the `null` listener TypeError after CAS commit with persisted row/event and checkout cleanup; the temporary test file was removed.

No live database, remote fault injection, or Docker was used. PostgreSQL was not needed because no runtime change was made.
