# Masquerade documentation

Masquerade v1 lets an authorized support operator use an AdonisJS application through a customer's
account while remaining authenticated as the operator. The mode is account-wide across valid
integrated sessions, has a fixed duration, and can be explicitly stopped. V1 uses the native
session guard only.

## Try it

Follow the [fictional native-session demo instructions](https://github.com/Kevinjohn/oss-adonisjs-impersonate/blob/main/examples/native-session/README.md)
to run the working application with one operator and two customers. The support workspace shows the
operator as the authenticated actor, the customer as the effective identity, the deadline, and how
to stop the mode.

## Integrate it

- [Install and configure](guide/setup.md): scaffold the package files, preserve the existing
  session provider, and wire callbacks, middleware, and host-protected routes.
- [Use a support mode](guide/usage.md): follow the complete status, start, customer-work, stop, and
  recovery recipes for JSON controls and Edge forms.
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

The package is a pre-release candidate and has not been published. The accepted v1 boundaries are
in the [development plan](https://github.com/Kevinjohn/oss-adonisjs-impersonate/blob/main/DEVELOPMENT-PLAN.md),
the [technical specification](https://github.com/Kevinjohn/oss-adonisjs-impersonate/blob/main/SPEC-impersonation.md),
and the [product requirements](https://github.com/Kevinjohn/oss-adonisjs-impersonate/blob/main/PRD-impersonation.md).
See [maintainer records](https://github.com/Kevinjohn/oss-adonisjs-impersonate/tree/main/docs/maintainers)
for repository and verification guidance.
