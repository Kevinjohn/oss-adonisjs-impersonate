# Fresh AdonisJS Inertia Vue host

## Source and environment

- Official starter: [`adonisjs/starter-kits`](https://github.com/adonisjs/starter-kits), `inertia-vue/`, commit `46d235932e3eb6472a16b740fa0b47b5f69fc6fc`; `pnpm-lock.yaml` SHA-256 `e1c2d6e1d8143ea194d55cb2cc4b12a2d571921153d48db9827ce68034c68ad8`.
- The [app-owned Vue integration](https://github.com/Kevinjohn/oss-adonisjs-masquerade/tree/1f224c6f4f9695bdf566a6a96634f8b664c80464/examples/inertia-vue) and [Vue guide](https://github.com/Kevinjohn/oss-adonisjs-masquerade/blob/1f224c6f4f9695bdf566a6a96634f8b664c80464/docs/guide/clients/vue.md) used for this run are candidate commit `1f224c6f4f9695bdf566a6a96634f8b664c80464`. They are separate from the official starter and from the package artifact below.
- Runtime: macOS, Node `v24.21.0`, pnpm `11.23.0`; host SQLite databases at `tmp/db.sqlite3` and `tmp/test.sqlite3`.
- The clean starter copy initially had no Masquerade dependency, provider, config, routes, or migrations. It contained the starter's ordinary session auth and Lucid SQLite setup.
- All browser accounts were fictional: `operator@example.test`, `customer-one@example.test`, and `customer-two@example.test`.

## Rebuild the package artifact

The host used the package artifact built from commit `7117345a94d6679d046b060b659bdb8bad40679b` (version `0.0.0`), not the Vue candidate's app code. Start these commands at the root of the checkout containing this report. The checked-in Vue source and package artifact are distinct inputs.

```sh
VALIDATION_CHECKOUT="$(pwd)"
PACKAGE_SOURCE="$(mktemp -d)/package"
git -C "$VALIDATION_CHECKOUT" worktree add --detach "$PACKAGE_SOURCE" 7117345a94d6679d046b060b659bdb8bad40679b
cd "$PACKAGE_SOURCE"
nvm use
pnpm install --frozen-lockfile
pnpm build
pnpm pack:fixture
shasum -a 256 tmp/native-session-package.tgz
```

With Node `v24.21.0` and pnpm `11.23.0`, the clean rebuild produced SHA-256 `d251eecf42ef41fcd0b1226fb61b07741757bc3ce0ac7e2a6c6e2320047e867b`. Copy that file into the fresh host root as `native-session-package.tgz` and confirm the hash before installing it.

## Recreate the fresh host

Start from an empty directory and materialize the exact official starter revision:

```sh
HOST_PARENT="$(mktemp -d)"
git clone https://github.com/adonisjs/starter-kits.git "$HOST_PARENT/starter-kits"
git -C "$HOST_PARENT/starter-kits" checkout 46d235932e3eb6472a16b740fa0b47b5f69fc6fc
mkdir "$HOST_PARENT/fresh-vue-host"
cp -R "$HOST_PARENT/starter-kits/inertia-vue/." "$HOST_PARENT/fresh-vue-host/"
cp "$PACKAGE_SOURCE/tmp/native-session-package.tgz" "$HOST_PARENT/fresh-vue-host/native-session-package.tgz"
cd "$HOST_PARENT/fresh-vue-host"
pnpm install --frozen-lockfile
cp .env.example .env
node ace generate:key
```

After copying the verified `native-session-package.tgz` into `fresh-vue-host/`, install and configure it, add the Vue example's host dependencies, and apply [the host assembly patch](vue-fresh-host.patch):

```sh
pnpm add file:./native-session-package.tgz
node ace configure adonisjs-masquerade --namespace=vue_validation --guard=web
pnpm add @adonisjs/bouncer@4.0.1 @adonisjs/limiter@3.0.1
git apply --unidiff-zero --check "$VALIDATION_CHECKOUT/docs/maintainers/adoption-validation/vue-fresh-host.patch"
git apply --unidiff-zero "$VALIDATION_CHECKOUT/docs/maintainers/adoption-validation/vue-fresh-host.patch"
node ace migration:run
node ace demo:seed
pnpm build
pnpm typecheck
pnpm lint
```

The patch hash is `0a709d8ebccf0365ca5017723f5dfc0204d0f2366a950b6ae667df103eae9668`. It contains the app-owned auth/configuration, edits to generated account callbacks, model fields, migrations, support controllers and routes, Inertia pages, and demo seed command. It leaves the generated package provider, context middleware, and control-store migration in place and excludes the package tarball and dependency lock; `configure` creates those package files, and the commands above install the dependencies. The patch uses zero-context hunks, so the `--unidiff-zero` flag is required. This exact patch passed both check and application on a second clean checkout at the same starter revision after package configuration. Build before typechecking to generate the starter's route indexes.

The host reuses one native session guard factory and provider for raw `web` and effective `web_effective`; the effective guard is the business default, while silent authentication explicitly selects raw `web`. Context middleware runs after authentication and before silent authentication. The host supplies stable account incarnation and security-stamp callbacks, eligibility and operator policy, and a reversible customer preference. `isActive` normalizes SQLite's numeric `1` with `Boolean(user.active)`. The completed stale-form guarantee uses `contextEnforcement: 'enforce'`.

The generated package provider validates that the effective guard is the default. Consequently, running migrations immediately after `configure`, before adding the host auth wiring, fails with `The default auth guard must be the effective session guard`. Run migrations after applying the host patch. The final host retained the starter's original encryption-key configuration; no `.release()` normalization was needed, and Node 24 type checking passed.

## Validation results

The fresh host ran under Node `v24.21.0` and pnpm `11.23.0`. Its resolved direct versions included `@adonisjs/core` `7.5.2`, `@adonisjs/auth` `10.1.0`, `@adonisjs/inertia` `5.0.1`, `@adonisjs/lucid` `22.4.2`, `@adonisjs/session` `8.1.0`, `@adonisjs/bouncer` `4.0.1`, `@adonisjs/limiter` `3.0.1`, Vue `3.5.43`, `@inertiajs/vue3` `3.7.1`, Vite `8.3.0`, and `better-sqlite3` `13.0.3`.

The final host lockfile after the local package and host dependencies were added had SHA-256 `a590a66ae0c2ed401f679dcfbf1717e62e7edf5c27d3a50fd4fb03c448d8b020`. The original unversioned Bouncer/Limiter add resolved the versions above; the replay commands request those versions explicitly. Compare the resulting dependency versions and lock hash before treating a later install as the same tested dependency set.

`node ace migration:run`, `node ace demo:seed`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` completed successfully. The final lint run reported 45 warnings from generated Vue assets in `public/assets` and no errors. An early typecheck before route indexes were regenerated reported missing route names; `node ace build` generated the indexes, and typecheck then passed both before and after the final build. The clean package artifact rebuild also passed `pnpm build` and `pnpm pack:fixture` with the recorded hash.

The development server ran on `127.0.0.1:3374`. The browser journey showed the operator and effective customer as separate identities, read customer data, changed the preference Off → On → Off, denied a sensitive action, rejected a stale form after switching context while the original tab remained open, and stopped the mode through the raw operator session. The stale mutation returned Inertia `409` and showed the recovery page. Inertia handles the sensitive denial by navigating to recovery (`409` with `X-Inertia-Location`); a same-origin raw fetch of the same denied action returned the underlying `403`. Stop returned the workspace to idle.

To repeat the journey, run `PORT=3374 HOST=127.0.0.1 node ace serve --hmr`, sign in as the demo operator, then open `/support`. Start support mode for customer one, save the preference On, and submit the sensitive-action form. Reload `/support/customer`, use a same-origin form request to the same sensitive route to observe the raw `403`, and save the preference Off. Keep that customer page open; in a second tab stop support mode and start it for customer two. Submit the still-open first tab's preference form and confirm the `409` recovery response, then stop support mode from the second tab and confirm the workspace is idle.

Evidence from the final browser run:

- [Operator and effective customer identities](evidence/fresh_vue_active_customer.png)
- [Preference changed to On](evidence/fresh_vue_preference_on.png) and [restored to Off](evidence/fresh_vue_preference_off.png)
- [Sensitive action recovery UI](evidence/fresh_vue_sensitive_denied.png)
- [Stale form rejected with `409`](evidence/fresh_vue_stale_form_409.png)
- [Idle after stop through the raw session](evidence/fresh_vue_idle_after_stop.png)
