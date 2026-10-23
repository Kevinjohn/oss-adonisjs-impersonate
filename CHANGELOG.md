# Changelog

## Unreleased

- The package tarball now contains only the build output, README, licence, changelog and security
  policy. The guides are no longer packed; read them on the documentation site or GitHub.
- Make `pnpm test:consumer` rebuild and repack the package before installing it, and stop when
  the build or pack fails, so a failed build can no longer leave an older tarball to be tested.
  `--package=<path>` still installs the given tarball as is.
- Move the design documents to `docs/design/` and the integration notes for code agents to
  `docs/guide/agents.md`, which is now part of the documentation site.
- Rename the repository to `Kevinjohn/oss-adonisjs-masquerade` and move the documentation site to
  <https://kevinjohn.github.io/oss-adonisjs-masquerade/>. Old repository links redirect; the old
  documentation address does not. The design documents are now `PRD-masquerade.md` and
  `SPEC-masquerade.md`.
- Add `masqueradeAuditFields(ctx)` to `adonisjs-masquerade/http`, returning the safe actor and
  effective identity fields to spread into a host business audit record, and document a host-owned
  page for reviewing the `masquerade_events` ledger.
- Make the start reason optional by default with a `reason: 'optional' | 'required'` config
  option. An optional start without a reason stores a null reason on the active row and omits it
  from the audit event; `'required'` keeps the previous behaviour. Custom stores must accept a
  null reason on active rows to pass the updated conformance suite.
- Document setup, support workflow, persistent local data, and reset for the Account Kit demo.
- Add a prerelease Account Kit integration preview pinned to GitHub release artifact `0.1.1`, with installation instructions, optional adapter, actor and target admission gates, managed-route blocker, route report, and floor/latest SQLite/PostgreSQL matrix evidence for both strategies. Public registry publication remains a separate release step.
- Add view-only-by-default starts with optional per-start edit access gated by `canEdit`, include
  `access` in active mode and audit projections, and return typed `blockedBy` details for blocked
  actions. Add nullable `access` columns to the mode and event tables by editing the unpublished
  create migration in place; recreate existing demo and example databases before running the
  updated package. Custom stores must persist access and reject event/row access mismatches to
  pass the updated conformance suite. Examples now offer View only and Can edit at start and
  explain blocked actions in host-owned pages.
- Add a runnable bearer API lifecycle to the native-session example, including token issuance,
  effective customer reads, shared browser mode, stop, and native revocation.
- Add v1.1 opaque access-token authentication that shares account mode with native sessions and
  requires an explicit per-token `masquerade` ability on integrated routes.
- Add a runnable Inertia Vue support workflow, integration guide and packed-example checks.
- Add a runnable Inertia React support-workflow example with context-bound forms and recovery.
- Add a same-origin session JSON client for the fictional support workflow and customer actions.
- Add a one-command launcher for the fictional native-session demo, preserving existing local configuration and data.
- Add an illustrated masquerade walkthrough captured from the fictional native-session demo.
- Organize adoption guidance by integration task and add safe troubleshooting paths.

Add documentation, native-session recipe, and browser checks to pull-request validation.

Organize the README and documentation landing page around the demo, integration guides, and
security and operations paths.

Map supported package imports to generated API symbols and remove edit links from generated pages.

Add a fresh native-session host recipe check for the documented wiring and SQLite/PostgreSQL HTTP journey.

Exercise the native-session support workspace in isolated browser journeys, including stale forms,
account-wide sessions, expiry and recovery.

Document the native-session support-mode journey with JSON controls, Edge adapters, business guards and recovery guidance.

Add a browser support workspace to the native-session example, with raw status and stop recovery,
customer-scoped read and reversible preference, and a sensitive-action denial.

Attach independent actor-keyed rate limits to native-session start and stop controls.

Expand native-session setup guidance for additive auth wiring, provider sharing, and policy callback lifecycle.

Distinguish name-inferred host controls from positively recognized package controls in the route
coverage report.

Add repeatable local demo setup with a fictional operator, two customers and a bounded reset
command.

Separate native-session application routes and configuration from explicitly enabled test probes.

Log bounded, privacy-safe diagnostics for core operational failures and control denials.

Add stable field-aware setup diagnostics for invalid configuration and store contracts.

Preserve the native session unauthorized error when `getUserOrFail()` follows an unsuccessful
effective guard authentication attempt.

Point the PostgreSQL helper diagnostic to the documented external-server test instructions.

Pass package errors to the host exception handler and retain generic JSON responses as the default.

Return unavailable without writing a contradictory denial when idle-stop audit acknowledgement fails.

Allow native-session flash alerts to opt out of the five-second auto-dismiss timeout while
preserving their delayed reveal and manual dismissal behavior.

Render native-session production error pages when unmatched requests have no initialized auth or
session context, preserving the original HTTP status.

Fix the native-session example dashboard's logout form so authenticated pages render successfully,
and render its production error pages through the registered marketing layout.

Add a fail-closed configure scaffold, setup and security guides, a complete requirement ledger,
and an isolated packed-consumer harness for the supported dependency floor and latest versions
on SQLite and PostgreSQL.

Add the native session authority and effective guard, HTTP controls, route markers, context
enforcement with a report mode, safe Edge helpers, and the `masquerade:routes` coverage report.

Add the Lucid control store for SQLite and PostgreSQL, a portable migration schema, and the
`masquerade:prune` command for bounded expiry and audit retention housekeeping.

Add the core state machine, revision-bound context tokens, hashed security stamps, fixed expiry,
policy checks, atomic memory store and control-store conformance helpers. Keep mode and audit
projections separate from user records and isolate observer failures from committed transitions.

Reject malformed UTF-16 in provider identifiers, account incarnations and security stamps, and
reject control-store transitions whose audit event does not match the committed owner and row.

Add a native-session starter fixture that proves the effective guard, raw actor identity,
lazy Bouncer resolution, silent authentication, native error rendering, Japa login and operator
isolation before package implementation.

Repository scaffold. No package behaviour yet; see [DEVELOPMENT-PLAN.md](https://github.com/Kevinjohn/oss-adonisjs-masquerade/blob/main/docs/design/DEVELOPMENT-PLAN.md) for
the milestones.
