# Masquerade for AdonisJS

[![checks](https://github.com/Kevinjohn/oss-adonisjs-impersonate/actions/workflows/checks.yml/badge.svg?branch=main)](https://github.com/Kevinjohn/oss-adonisjs-impersonate/actions/workflows/checks.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE.md)
[![Node.js 24+](https://img.shields.io/badge/node-%3E%3D24-339933)](package.json)
[![AdonisJS 7](https://img.shields.io/badge/AdonisJS-7-5a45ff)](https://adonisjs.com)

Let an authorized support operator act through another account without logging in as that user.
The operator stays authenticated as themselves; covered business routes use the target as the
effective principal. Masquerade is a server-side account mode shared across the operator's valid
sessions, with a fixed expiry and explicit stop.

**Status: pre-release candidate.** Version `0.0.0` is not published. The v1 adapter supports the
AdonisJS native session guard, with Lucid SQLite and PostgreSQL storage. Access-token transport is
planned for v1.1; the Account Kit adapter is v1.2. JWT support is out of scope.

## Get started

- [Install and configure](docs/guide/setup.md): scaffold the package files, connect the existing
  session provider, wire middleware and mount routes behind host protections.
- [Security and operations](docs/guide/security.md): actor/target identity, cross-device behavior,
  context tokens, route policy, audit, retention and asynchronous work.
- [API reference](https://kevinjohn.github.io/oss-adonisjs-impersonate/api/): generated package exports.

Start with Node 24 and pnpm. Configure requires Lucid for its default store and creates a migration
that you review and run yourself. The command leaves routes and middleware ordering to the host.

## Behavior

- Native auth continues to authenticate the actor. Target credentials are never created, and actor
  permissions are never added to the target's permissions.
- The host must explicitly allow each actor-target pair. Unsafe active-mode routes are denied unless
  marked with `allowMutation()`; `sensitive()` always blocks and the host must use it for billing
  and other sensitive actions.
- Every covered unsafe business request carries an owner-bound context token, including while idle.
  Report mode supports migration; enforce mode rejects missing or stale intent.
- Starts, stops and invalidations use atomic revisioned storage and durable audit. The host owns
  retention, localization, rate limits, roles, tenants and UI.

The accepted boundaries are in [DEVELOPMENT-PLAN.md](DEVELOPMENT-PLAN.md), the technical contract
in [SPEC-impersonation.md](SPEC-impersonation.md), and product requirements in
[PRD-impersonation.md](PRD-impersonation.md). For project setup and contribution checks, see
[CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
