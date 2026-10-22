# Historical: Account Kit Ace startup failure at the Core 7.0.0 peer floor

**Status:** Resolved upstream in Account Kit `0.1.1`; retained as reproduction context. The
Masquerade floor/latest matrix against this release has passed; see the
[acceptance evidence](requirement-ledger.md#v12-account-kit-acceptance-t-kit-and-t-kit-http).

The original report below records the Core `7.0.0` startup failure observed with Account Kit source
commit `b2814006b83673346fb5533db8b3443a067d7d6c` (manifest version `0.0.0`). Account Kit release
`0.1.1` now imports `configProvider` from the Core package root in both `commands/openapi.ts` and
`src/http/session_store_protection.ts`, and declares support for Core `7.0.0`. The correction is
available in source commit `b1ae0d48fda29ff75a2edc9f021c61eff3b1267b` and the pinned GitHub artifact
documented in the [integration guide](../guide/account-kit.md). This resolves the reported upstream
import incompatibility; the full Masquerade database/strategy matrix has since passed.

## Source and environment

- Repository: https://github.com/Kevinjohn/oss-adonisjs-account-kit
- Account Kit source: `b2814006b83673346fb5533db8b3443a067d7d6c`, freshly archived, installed, built and packed; package manifest version `0.0.0`.
- Node `24.21.0`; pnpm `11.23.0`.
- Exact floor host: Core `7.0.0`, Auth `10.0.0`, Lucid `22.4.2`, Session `8.1.0`, Bouncer `4.0.0`, TypeScript `5.9.3`.
- SQLite and PostgreSQL hosts, session and access-token strategies, with session management enabled and disabled, are included in the consumer matrix.
- At the time of the report, Account Kit declared `@adonisjs/core: ^7.0.0` as a peer, while its
  development dependency started at `^7.0.1`.

## Original report (superseded by Account Kit 0.1.1)

## Failure

`commands/openapi.ts:4` imports:

```ts
import { configProvider } from '@adonisjs/core/config'
```

Core `7.0.0` did not export that symbol from this entry point. Ace loaded Account Kit's command entry while booting its command kernel, so unrelated commands failed before their handlers ran. The original fresh consumer failed during `account-kit:admission:install`; `migration:run --force` also reproduced the same import failure.

```text
SyntaxError: The requested module '@adonisjs/core/config' does not provide an export named 'configProvider'
```

The built stack pointed to the Account Kit OpenAPI command bundle, then the Ace kernel boot path. The affected source used `configProvider.resolve(this.app, session)` at `commands/openapi.ts:69`.

## Minimal checks

In an AdonisJS 7 host with Core pinned to `7.0.0` and the then-current Account Kit artifact installed and configured:

```sh
pnpm exec node --input-type=module -e "const m = await import('@adonisjs/core/config'); console.log('configProvider' in m)"
pnpm exec node ace.js migration:run --force
```

The first printed `false`; the second failed on the Account Kit import during Ace boot. This was also demonstrated directly, without invoking Masquerade:

```sh
pnpm exec node --input-type=module -e "import { configProvider } from '@adonisjs/core/config'; console.log(configProvider)"
```

Use the package's normal configure step to register its commands/providers. This report does not depend on calling the OpenAPI command itself.

## Expected result and questions

A host satisfying Account Kit's declared peer range should boot Ace and run its normal setup/migration commands. Please establish:

1. Is Core `7.0.0` intended to be supported? If so, how should this command resolve the session configuration using APIs available at that floor?
2. If a later Core version is required, what is the earliest verified compatible release, and should the peer floor and documentation be raised to it?
3. Can a floor-pinned packed-consumer regression test cover normal Ace startup, an unrelated command, and the OpenAPI command, so a newer development dependency cannot conceal this mismatch?

Core `7.6.0` exports the symbol and allows the consumer to proceed. Intermediate releases have not been bisected, so `7.6.0` is a known working comparison, not a proposed minimum. Making the OpenAPI command lazy could reduce unrelated-command impact, but would not alone make that command compatible with the declared Core 7.0.0 floor.

## Integration boundary (original report)

At report time, Masquerade continued draft development against the approved local Account Kit source
without patching Account Kit or increasing either package's peer floor. The defect and registry
availability were tracked separately. Current status is summarized at the top of this historical
report; public registry publication remains separate from use of the pinned GitHub artifact.
