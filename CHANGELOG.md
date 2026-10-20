# Changelog

## Unreleased

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

Repository scaffold. No package behaviour yet; see [DEVELOPMENT-PLAN.md](https://github.com/Kevinjohn/oss-adonisjs-impersonate/blob/main/DEVELOPMENT-PLAN.md) for
the milestones.
