# Native session integration fixture

This is an AdonisJS 7 hypermedia starter fixture based on the official starter kit at commit
[`449d77c`](https://github.com/adonisjs/starter-kits/commit/449d77cc25dd08e036f442d2d39b760d43ccfbd3).
It exercises the built `adonisjs-masquerade` package through a real SQLite Lucid store, session
guard, provider, middleware, controllers, Edge form and HTTP requests. The starter's `web` guard
and global `silent_auth` middleware remain in place. Fixture data uses synthetic users and a
synthetic test-only application key.

Use Node 24 and pnpm. From the repository root, build and pack the package first:

```sh
pnpm build
pnpm pack:fixture
```

Then run the fixture checks:

```sh
cd examples/native-session
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:report
```

The package dependency is the generated `../../tmp/native-session-package.tgz`; packing before
installation ensures the fixture exercises the current built exports. The test command runs four
M0 identity-seam proofs and ten M3 real-request integration cases in `tests/functional/`. The
report-mode route test is separate because it starts the same app with context enforcement set to
`report`. Two intentionally mixed raw/effective guard routes exercise fail-closed middleware
classification and appear as coverage warnings; they are adversarial fixture cases, not examples
of recommended route configuration.
