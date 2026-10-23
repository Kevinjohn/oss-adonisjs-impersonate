# Historical implementation handoff

This is the original M0–M4 implementation brief. Those milestones are now recorded as complete
in [M4-RESULT.md](https://github.com/Kevinjohn/oss-adonisjs-masquerade/blob/7e0940e/M4-RESULT.md) and the [requirement ledger](requirement-ledger.md). The
instructions below preserve the original sequence and stop conditions; they are not a current
backlog. For maintenance, use the [source map](source-map.md) and [conventions](conventions.md).

This page is for whoever builds the package. It is self-contained: read it, then the three
documents it names, and start. Nothing below needs a decision from the owner until the point
marked **STOP**.

## Read in this order

1. [DEVELOPMENT-PLAN.md](../design/DEVELOPMENT-PLAN.md): the accepted scope. Twenty agreed items and
   four owner decisions. This wins over the SPEC where they differ.
2. [SPEC-masquerade.md](../design/SPEC-masquerade.md): the technical contract. Sections 3
   (invariants), 4 (contracts), 6.4 (transition table) and 11 (tests and milestones) are the ones
   you will keep open.
3. [PRD-masquerade.md](../design/PRD-masquerade.md): the product boundaries. Read "Settled
   product boundaries" and the "v1 scope addendum"; the rest is background.
4. [AGENTS.md](../../AGENTS.md) and [conventions.md](conventions.md): how code is laid out and
   checked.

## Decisions already made

Do not reopen these. Each has a reason recorded in the plan.

- v1.1 supports native sessions and opaque access tokens; JWT is out and Account Kit integration
  is v1.2.
- One mode per operator account, shared by every session of that account. Fixed expiry, no
  renewal, explicit stop.
- The operator stays authenticated as themselves. Nothing ever logs in as the target.
- Every mode starts view-only. Edit is selected per start and requires optional host `canEdit` to
  return exactly `true`; active edit admission rechecks it and invalidates with `edit_denied` when
  permission is revoked. Unsafe requests require edit access and `allowMutation()`; `sensitive()`
  always blocks. The typed `blockedBy` field explains the denial category to host handlers.
- Context token on every covered unsafe request, idle or active, with `report` and `enforce`
  modes so hosts can migrate forms.
- Security stamps are stored as sha256 hashes, not encrypted. Revision is a plain integer. No
  boot-time route registry; `masquerade:routes` prints a report instead.
- Audit rows are written in the same transaction as the state change. Observers are
  emit-and-forget.
- Lucid store supporting SQLite and PostgreSQL from v1, behind a `ControlStore` contract with an
  exported conformance suite.
- The package name is not final. Keep `adonisjs-masquerade` everywhere until the owner renames
  it; a rename is one find-and-replace plus the `package.json` `name` field.

## Working rules

- Node 24 and pnpm. Run the repository scripts, never the bare tools.
- One responsibility per file, named for it. One spec per module. Fixtures in `tests/helpers/`.
- A test counts when it fails without the change it covers. Check that before claiming coverage.
- Commit messages in the imperative mood. No AI attribution anywhere. One change per pull request.
- Keep `## Unreleased` in `CHANGELOG.md` current for anything a user can see.
- If the SPEC and the plan disagree, the plan wins. If the plan is silent, choose the smallest
  thing that satisfies the SPEC and note it in the pull request.
- Do not publish, tag or rename anything. Those are owner actions.

## Milestone M0: prove the seam

Everything else depends on this. Do it first, on its own, before any core code.

**Question it answers.** In a stock AdonisJS 7 app, can a custom "effective" guard that wraps the
`web` session guard make `auth.user` the target user on business routes while `auth.use('web')`
still reports the operator?

**Why first.** Auth 10's Authenticator returns `user` from whichever guard was attempted last.
That is how the implementation behaves, not a documented contract. If the starter kit's
`silent_auth` middleware or any `auth.check()` call flips the facade back to the raw guard,
business code runs as the operator without anyone noticing. SPEC section 4.3 is the full
description.

**Build.**

- Create `examples/native-session/` from the AdonisJS 7 hypermedia starter kit, SQLite, pnpm.
- Add a `users` table and the `web` session guard as the kit provides them.
- Add a `web_effective` guard implementing the Auth 10 guard contract. Inside it, authenticate
  the actor with `ctx.auth.use('web').authenticate()` and nothing else from the facade. Resolve
  the target from an in-memory `Map<actorId, targetId>`; empty map means idle, effective user is
  the actor.
- Set `web_effective` as the default guard. Keep `silent_auth` registered as the kit registers it.
- One business route under `web_effective` that returns `auth.user.id`, `auth.use('web').user.id`
  and `auth.authenticatedViaGuard`. One control route under `web` that writes the map.
- A Bouncer ability resolved lazily from `ctx.auth.user`.

**Do not.** Assign to `ctx.auth.user`. Patch private fields. Call facade `authenticate`,
`check`, `authenticateUsing` or `checkUsing` inside the wrapper. Add a store, policy, HTTP
controllers or anything from later milestones.

**Prove, one Japa functional test each.**

| Item            | Pass condition                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Facade identity | `auth.user`, `auth.getUserOrFail()` and `auth.authenticatedViaGuard` are the effective guard before, during and after a mode.             |
| Raw actor       | `auth.use('web').user.id` is the operator throughout.                                                                                     |
| Bouncer         | A lazy Bouncer ability sees the target while active and the actor while idle.                                                             |
| silent_auth     | With `silent_auth` running on a business route, the facade still ends on `web_effective`.                                                 |
| Error rendering | With `driverName` passed through, an unauthenticated request gets the session guard's behaviour: redirect for HTML, JSON for API clients. |
| Japa loginAs    | `loginAs(user)` works unchanged against routes under `web_effective`.                                                                     |
| Isolation       | Two operators with modes active at the same time each see their own target; neither sees the other's.                                     |

**Done.** `pnpm test` is green inside `examples/native-session`, and `M0-RESULT.md` at the
repository root records pass or fail per item with `file:line` evidence and lists every Auth 10
behaviour the seam relies on.

**STOP if any item fails.** Do not start M1. Report which item failed, with the failing test,
to the owner. The plan has no fallback for this, so it is the owner's decision.

## Milestones M1 to M4

After M0 passes, follow the table in SPEC section 11.2 and the plan's milestone table. In one
line each:

- **M1 core:** state machine, compare-and-swap on the memory store, policy, fixed expiry with an
  injectable clock, nonce context token, hashed stamps, reason rule, emitter events. Gate: every
  row of SPEC section 6.4 has a test that fails without the behaviour.
- **M2 Lucid store:** migration stub, CAS plus audit event in one transaction, conformance suite
  on SQLite and PostgreSQL, prune command. Gate: a two-connection PostgreSQL race yields one winner
  and one event; SQLite busy-timeout and rollback cases pass.
- **M3 HTTP:** controllers, effective session guard, markers, context middleware with report and
  enforce modes, Edge share, error codes, `no-store` headers, `masquerade:routes`. Gate: T-CONTEXT
  and T-ACTIONS pass inside the M0 example app.
- **M4 release candidate:** `configure` command, docs, packed consumer at floor and latest
  dependency sets, requirement-to-test ledger. Gate: the ledger covers every retained FR, NFR and
  AC. Hand back to the owner for naming and publication.

Test families and the cases each must cover are in SPEC section 11.1. Treat a family label as a
checklist, not as evidence.

## What to report back

At the end of each milestone, record a reviewable handoff with:

- the gate from the table above and how it was met, naming the test files;
- any place where you chose between readings of the SPEC, and which you chose;
- anything in the SPEC you could not satisfy as written, with the smallest change that would
  make it satisfiable.

The owner reads the pull request, not the branch history, so put the evidence there.
