# Masquerade documentation

Masquerade v1 lets an authorized support operator use an AdonisJS application through a customer's
account while remaining authenticated as the operator. The mode is account-wide across valid
integrated sessions, has a fixed duration, and can be explicitly stopped. V1 uses the native
session guard only.

## Get started

Start with [Getting started](guide/getting-started.md) to choose a runnable demo or integrate
Masquerade into an existing application. The [native-session demo](https://github.com/Kevinjohn/oss-adonisjs-impersonate/blob/main/examples/native-session/README.md)
shows the operator as the authenticated actor, the customer as the effective identity, the fixed
deadline, and how to stop the mode.

[Add user impersonation to AdonisJS](guide/walkthrough.md) follows the fictional support journey
with real application screenshots.

## Guides

- [Inertia Vue](guide/clients/vue.md): run the fictional support workflow with Vue forms and
  page recovery after an identity change.
- [Troubleshooting](guide/troubleshooting.md): diagnose setup and boot problems, missing or stale
  context, denied actions, expiry, and storage failures.
- [Install and configure](guide/setup.md): scaffold the package files, preserve the existing
  session provider, and wire callbacks, middleware, and host-protected routes.
- [Use a support mode](guide/usage.md): follow the complete status, start, customer-work, stop, and
  Edge form recipes.
- [Session JSON client](guide/clients/json.md): run same-origin fetch controls and customer
  actions with session cookies, CSRF, captured context, and deliberate recovery.
- [Inertia React](guide/clients/react.md): run the React support workflow with captured form
  context, refreshed customer pages, and deliberate recovery.
- [Supported package imports](api-reference.md#supported-package-imports): map public package
  entry points to their API references.

## Security and operations

- [Security boundaries](guide/security.md): actor and customer identity, sessions, authorization,
  context tokens, expiry, audit, and side effects.
- [Custom authorities](guide/custom-authorities.md): provide coherent account identity and
  security-stamp values.
- [Custom stores](guide/custom-stores.md): implement and verify the control-store contract.
- [Pruning and retention](guide/operations.md): schedule bounded cleanup and apply retention safely.
- [Route coverage review](guide/route-report.md): inspect the effective and raw routes in the host
  application.

The package is an early alpha for local self-testing and has not been published to a package
registry. Build the selected tagged baseline and install its local tarball as described in the
[setup guide](guide/setup.md#generate-the-starter-files). The accepted v1 boundaries are
in the [development plan](https://github.com/Kevinjohn/oss-adonisjs-impersonate/blob/main/DEVELOPMENT-PLAN.md),
the [technical specification](https://github.com/Kevinjohn/oss-adonisjs-impersonate/blob/main/SPEC-impersonation.md),
and the [product requirements](https://github.com/Kevinjohn/oss-adonisjs-impersonate/blob/main/PRD-impersonation.md).
See [maintainer records](https://github.com/Kevinjohn/oss-adonisjs-impersonate/tree/main/docs/maintainers)
for repository and verification guidance.
