# Clean self-setup validation

This record verifies setup from a clean package checkout and from a fresh, unconfigured AdonisJS host. It uses fictional accounts and disposable local SQLite data. It does not claim external usability testing, production readiness, or success for unmerged branches.

## Procedure

For each delivered path, record its exact source revision, clean starting state, Node/pnpm versions, operating system, package artifact SHA-256, commands, database and ports, browser outcomes, corrections, and privacy-safe evidence. Do not overwrite a tarball after recording its hash. Use a separate host directory and database for each path. Do not use `examples/native-session` as the fresh host: it is already configured.

### Native-session demo

1. Create a clean checkout at the candidate package commit. Confirm the example has no `node_modules/`, `.env`, or generated database.
2. Follow every command in `examples/native-session/README.md`. At the package root, build and pack the local artifact before installing the example.
3. In a real browser, sign in with the fictional operator, start a support mode, confirm the actor and effective customer are shown separately, read customer data, change and restore the reversible preference, verify the sensitive action is denied, submit a form rendered before a context transition and verify rejection, then stop through the raw actor session.
4. Record command results, HTTP outcomes, browser evidence, and any environment adjustment.

### Fresh Edge host

1. Use a clean copy of the official AdonisJS Hypermedia starter. Record its upstream repository, commit, and clean state. It must start without Masquerade installed or configured.
2. Install the exact package tarball made from the candidate commit. Record the artifact hash and lockfile result. Do not install a registry version or copy configuration from the native-session demo.
3. Follow [Install and configure](../../guide/setup.md) in order. Complete the host-owned model fields, identity callbacks and policy; reuse the exact provider object in the raw and effective guards; set context enforcement to `enforce` for the covered forms; apply the generated migration; order middleware; and add minimal host-owned routes, UI, and data.
4. With fictional accounts, verify start, separate actor/effective identities, customer read, a reversible preference, sensitive-action denial, a stale form rejected after another tab changes context, and stop through the raw actor session. Use browser journeys, not API calls alone.
5. If a setup gap appears, correct the public setup guide and repeat the material setup and journey from a fresh starter copy and database.

### Additional clients

Validate a client only when its setup path and runnable example exist at the candidate revision. Use a fresh host for each client; follow that client's setup and documentation; exercise the full journey in its browser when it has a browser UI. Record unsupported and untested paths explicitly. A recipe harness or already-wired demo is supporting evidence, not fresh-host evidence.

## Completion criteria

A path is **not delivered** when its example is absent from the tested revision, and **not run** when it exists but has not been exercised. A path passes only when its clean setup and required real-browser journey succeed, or a material blocker is explicitly recorded. Do not infer success for unmerged work from its pull request description. External participants and study recruitment are out of scope.

## Run index

- [Native-session demo and fresh Edge host](edge.md)
