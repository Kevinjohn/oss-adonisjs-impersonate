# Account Kit Ace startup fails at the declared AdonisJS Core 7.0.0 peer floor

Please investigate whether Account Kit's implementation or its declared Core peer floor needs to change. This is reproducible in Account Kit's own command import, before Masquerade's adapter or managed-route blocker runs.

## Source and environment

- Repository: https://github.com/Kevinjohn/oss-adonisjs-account-kit
- Account Kit source: `b2814006b83673346fb5533db8b3443a067d7d6c`, freshly archived, installed, built and packed; package manifest version `0.0.0`.
- Node `24.21.0`; pnpm `11.23.0`.
- Exact floor host: Core `7.0.0`, Auth `10.0.0`, Lucid `22.4.2`, Session `8.1.0`, Bouncer `4.0.0`, TypeScript `5.9.3`.
- SQLite and PostgreSQL hosts, session and access-token strategies, with session management enabled and disabled, are included in the consumer matrix.
- Account Kit declares `@adonisjs/core: ^7.0.0` as a peer, while its development dependency starts at `^7.0.1`.

## Failure

`commands/openapi.ts:4` imports:

```ts
import { configProvider } from '@adonisjs/core/config'
```

Core `7.0.0` does not export that symbol from this entry point. Ace loads Account Kit's command entry while booting its command kernel, so unrelated commands fail before their handlers run. The fresh consumer currently fails during `account-kit:admission:install`; `migration:run --force` has also reproduced the same import failure.

```text
SyntaxError: The requested module '@adonisjs/core/config' does not provide an export named 'configProvider'
```

The built stack points to the Account Kit OpenAPI command bundle, then the Ace kernel boot path. The source uses `configProvider.resolve(this.app, session)` at `commands/openapi.ts:69`.

## Minimal checks

In an AdonisJS 7 host with Core pinned to `7.0.0` and Account Kit's freshly packed artifact installed and configured:

```sh
pnpm exec node --input-type=module -e "const m = await import('@adonisjs/core/config'); console.log('configProvider' in m)"
pnpm exec node ace.js migration:run --force
```

The first prints `false`; the second fails on the Account Kit import during Ace boot. This can also be demonstrated directly, without invoking Masquerade:

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

## Integration boundary

Masquerade is continuing draft development against the approved local Account Kit source without patching Account Kit or increasing either package's peer floor. The floor failure remains visible in acceptance evidence. The published-alpha pin and published-package release gate are also pending separately because `adonisjs-account-kit` was unavailable from the public registry when checked. Please treat registry availability and this Core compatibility defect as separate questions.
