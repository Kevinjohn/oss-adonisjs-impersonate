# Native session guard fixture

This fixture starts from the official AdonisJS 7 hypermedia starter kit at commit
[`449d77c`](https://github.com/adonisjs/starter-kits/commit/449d77cc25dd08e036f442d2d39b760d43ccfbd3).
It keeps the starter's SQLite users table, `web` session guard and globally registered
`silent_auth` middleware, then adds an in-memory effective guard and identity-focused functional
tests for the M0 seam. It is a disposable proof fixture, not package code.

Use Node 24 and pnpm:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
```

`tests/functional/effective_guard.spec.ts` maps its seven cases to the M0 requirements. The test
environment uses a synthetic key in `.env.test`; it is not a credential.
