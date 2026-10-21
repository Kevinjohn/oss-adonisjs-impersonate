# Masquerade for AdonisJS

[![checks](https://github.com/Kevinjohn/oss-adonisjs-impersonate/actions/workflows/checks.yml/badge.svg?branch=main)](https://github.com/Kevinjohn/oss-adonisjs-impersonate/actions/workflows/checks.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE.md)
[![Node.js 24+](https://img.shields.io/badge/node-%3E%3D24-339933)](package.json)
[![AdonisJS 7](https://img.shields.io/badge/AdonisJS-7-5a45ff)](https://adonisjs.com)

Masquerade lets an authorized support operator use an application through a customer's account
without signing in as that customer. The operator stays authenticated as the actor; covered
business routes resolve the customer as the effective identity for ordinary Auth and Bouncer
checks.

**v1 supports the AdonisJS native session guard only.** One server-side mode is shared across all
valid integrated sessions for the operator account, has a fixed duration, and can be explicitly
stopped. The package does not create customer credentials or combine actor and customer
permissions.

**Status: pre-release candidate.** Version `0.0.0` is not published.

## Choose a path

### Try it

See [Add user impersonation to AdonisJS](docs/guide/walkthrough.md) for an illustrated support
journey with the working application.

Run the [fictional native-session demo](examples/native-session/README.md). Its setup guide builds
the package from this checkout, seeds one operator and two customers, and starts the working
application. The support workspace shows the signed-in operator separately from the effective
customer, the fixed deadline, and the stop control.

### Integrate it

- [Install and configure](docs/guide/setup.md): add the provider and migration, reuse the host's
  session provider, and wire the raw and effective guards and protected routes.
- [Use a support mode](docs/guide/usage.md): follow the complete status, start, customer-work,
  stop, and recovery recipes for JSON controls and Edge forms.
- [Supported package imports](docs/api-reference.md#supported-package-imports): find each public
  entry point and its API reference.

### Security and operations

- [Security boundaries](docs/guide/security.md): actor and customer identity, account-wide
  sessions, authorization, context tokens, expiry, audit, and external work.
- [Custom authorities](docs/guide/custom-authorities.md) and [custom stores](docs/guide/custom-stores.md):
  preserve account security epochs and implement the control-store contract.
- [Pruning and retention](docs/guide/operations.md) and [route coverage review](docs/guide/route-report.md):
  operate bounded cleanup and review the host's effective-route coverage.

Access-token transport is planned for v1.1; the Account Kit adapter is v1.2; JWT support is out of
scope.

Start with Node.js 24 and pnpm. The setup guide creates files for you to review; you keep control of
authorization, language, route policy, retention, and user-facing UI. Masquerade does not sign in as
the customer, issue customer credentials, or grant the operator's permissions to the customer.

The accepted boundaries are recorded in [DEVELOPMENT-PLAN.md](DEVELOPMENT-PLAN.md), the technical
contract in [SPEC-impersonation.md](SPEC-impersonation.md), and product requirements in
[PRD-impersonation.md](PRD-impersonation.md). For contribution checks, see
[CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
