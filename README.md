# Masquerade for AdonisJS

[![checks](https://github.com/Kevinjohn/oss-adonisjs-impersonate/actions/workflows/checks.yml/badge.svg?branch=main)](https://github.com/Kevinjohn/oss-adonisjs-impersonate/actions/workflows/checks.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE.md)
[![Node.js 24+](https://img.shields.io/badge/node-%3E%3D24-339933)](package.json)
[![AdonisJS 7](https://img.shields.io/badge/AdonisJS-7-5a45ff)](https://adonisjs.com)

Let a support operator act as another account without logging in as them. The operator stays
authenticated as themselves; the application sees the target as the effective user; every start
and stop is recorded.

**Status: pre-release.** The repository holds the design and the scaffold. Nothing is published
yet. [DEVELOPMENT-PLAN.md](DEVELOPMENT-PLAN.md) is the accepted v1 plan,
[SPEC-impersonation.md](SPEC-impersonation.md) the technical contract and
[PRD-impersonation.md](PRD-impersonation.md) the product requirements.

## What v1 will do

- One server-side mode per operator account, shared by every session of that account, with a fixed
  expiry and an explicit stop.
- An effective Auth guard so `auth.user` and Bouncer see the target on business routes while the
  raw session guard still reports the operator.
- Deny-by-default: the application's own callback approves each operator and target pair; unsafe
  methods are blocked while a mode is active unless a route opts in; sensitive routes stay blocked.
- A context token on unsafe requests so a form rendered under one identity cannot submit under
  another.
- Durable, atomic audit of every transition in SQLite or PostgreSQL through Lucid, behind a store
  contract you can implement for another database.

Access tokens and the Account Kit adapter follow in later minor versions.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, checks and the project principles, and
[SECURITY.md](SECURITY.md) for reporting vulnerabilities.
