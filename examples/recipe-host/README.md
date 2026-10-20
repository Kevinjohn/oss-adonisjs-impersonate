# Fresh host recipe fixture

This is a small conventional AdonisJS 7 native-session host **before** Masquerade is configured.
It has a numeric `User`, a separate `members` guard, session options, Auth type augmentation,
Shield CSRF, Lucid and SQLite/PostgreSQL configuration. It has no package provider, generated
configuration, context middleware, or Masquerade routes. `pnpm test:recipe` copies this template
into a temporary directory and applies the public setup and usage recipe there.

The fixture is deliberately separate from `examples/native-session`, which is an already wired
reference app and consumer matrix fixture.
