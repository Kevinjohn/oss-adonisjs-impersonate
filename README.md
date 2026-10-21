# Masquerade for AdonisJS

[![checks](https://github.com/Kevinjohn/oss-adonisjs-impersonate/actions/workflows/checks.yml/badge.svg?branch=main)](https://github.com/Kevinjohn/oss-adonisjs-impersonate/actions/workflows/checks.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE.md)
[![Node.js 24+](https://img.shields.io/badge/node-%3E%3D24-339933)](package.json)
[![AdonisJS 7](https://img.shields.io/badge/AdonisJS-7-5a45ff)](https://adonisjs.com)

Masquerade lets an authorized support operator use an application through a customer's account
without signing in as that customer. The operator stays authenticated as the actor; covered
business routes resolve the customer as the effective identity for ordinary Auth and Bouncer
checks.

**V1.1 adds AdonisJS opaque access-token transport alongside native sessions.** Both transports
share one server-side mode for the same operator account, with a fixed duration and explicit stop.
An access token needs the configured `masquerade` ability to use integrated routes. The package
does not create customer credentials or combine actor and customer permissions.

**Status: early alpha for local self-testing.** Version `0.0.0` is not published, and there is no
registry package for this baseline. Select and rebuild a tagged baseline as described in the
[setup guide](docs/guide/setup.md#generate-the-starter-files).

## Choose a path

### Try it

See [Add user impersonation to AdonisJS](docs/guide/walkthrough.md) for an illustrated support
journey with the working application.

With Node 24 and pnpm installed, run `pnpm demo` from this checkout to build, seed and start the
[fictional session and bearer demo](examples/native-session/README.md#one-command-demo). For setup
failures or a manual launch, use the [explicit setup instructions](examples/native-session/README.md#local-setup). The support workspace shows the signed-in operator separately from the effective
customer, the fixed deadline, and the stop control. Follow the
[runnable bearer API lifecycle](examples/native-session/README.md#bearer-api-lifecycle) to issue a
restricted local token and exercise status, start, customer read, stop, and revocation.

### Integrate it

- [Get started](docs/guide/getting-started.md): choose the demo or an existing-session application
  and follow the delivered frontend path.
- [Inertia Vue example](examples/inertia-vue/README.md) and [integration guide](docs/guide/clients/vue.md):
  run the support workflow with context-bound forms and identity-safe page recovery.
- [Install and configure](docs/guide/setup.md): add the provider and migration, reuse the host's
  session provider, and wire the raw and effective guards and protected routes.
- [Use a support mode](docs/guide/usage.md): follow the complete status, start, customer-work,
  stop, and recovery recipes for JSON controls and Edge forms.
- [Session JSON client](docs/guide/clients/json.md): try the runnable browser client alongside
  the Edge demo, with native session cookies and context-bound actions.
- [Inertia React](docs/guide/clients/react.md): launch the runnable React example with native
  session authentication and context-bound support forms.
- [Opaque access-token guide](docs/guide/access-tokens.md): configure mixed or token-only transport
  and follow the runnable bearer API lifecycle in the existing example.
- [Supported package imports](docs/api-reference.md#supported-package-imports): find each public
  entry point and its API reference.

### Security and operations

- [Troubleshooting](docs/guide/troubleshooting.md): diagnose setup, context, admission and storage
  failures, with safe recovery steps.
- [Security boundaries](docs/guide/security.md): actor and customer identity, account-wide
  sessions, authorization, context tokens, expiry, audit, and external work.
- [Custom authorities](docs/guide/custom-authorities.md) and [custom stores](docs/guide/custom-stores.md):
  preserve account security epochs and implement the control-store contract.
- [Pruning and retention](docs/guide/operations.md) and [route coverage review](docs/guide/route-report.md):
  operate bounded cleanup and review the host's effective-route coverage.

The [access-token guide](docs/guide/access-tokens.md) covers token-only or mixed session/token
configuration. Account Kit integration remains v1.2; JWT support is out of scope.

Start with Node.js 24 and pnpm. The setup guide creates files for you to review; you keep control of
authorization, language, route policy, retention, and user-facing UI. Masquerade does not sign in as
the customer, issue customer credentials, or grant the operator's permissions to the customer.

The accepted boundaries are recorded in [DEVELOPMENT-PLAN.md](DEVELOPMENT-PLAN.md), the technical
contract in [SPEC-impersonation.md](SPEC-impersonation.md), and product requirements in
[PRD-impersonation.md](PRD-impersonation.md). For contribution checks, see
[CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
