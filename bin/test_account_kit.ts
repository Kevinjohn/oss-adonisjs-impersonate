import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { cp, mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const fixture = join(root, 'examples/account-kit')
const template = join(root, 'examples/native-session')
const options = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=')
    return [key, value]
  })
)
const profile = options.get('profile') ?? 'all'
const database = options.get('database') ?? 'all'
const strategy = options.get('strategy') ?? 'all'
const sessionManagement = options.get('session-management') ?? 'all'
if (
  !['all', 'floor', 'latest'].includes(profile) ||
  !['all', 'sqlite', 'pg'].includes(database) ||
  !['all', 'session', 'access_tokens'].includes(strategy) ||
  !['all', 'on', 'off'].includes(sessionManagement)
)
  throw new Error(
    'Use --profile=floor|latest|all --database=sqlite|pg|all --strategy=session|access_tokens|all --session-management=on|off|all'
  )
if (Number(process.versions.node.split('.')[0]) !== 24)
  throw new Error('Account Kit consumer requires Node 24')

const published = process.env.ACCOUNT_KIT_ALPHA
const source = process.env.ACCOUNT_KIT_SOURCE
if (source && published) throw new Error('Set only ACCOUNT_KIT_ALPHA or ACCOUNT_KIT_SOURCE')
if (!source && !published)
  throw new Error(
    'Set ACCOUNT_KIT_ALPHA to an exact published adonisjs-account-kit alpha version; for interim evidence only, set ACCOUNT_KIT_SOURCE to an absolute local checkout'
  )
if (source && !source.startsWith('/'))
  throw new Error('ACCOUNT_KIT_SOURCE must be an absolute path')
if (published && !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?$/.test(published))
  throw new Error('ACCOUNT_KIT_ALPHA must be an exact version, not a range or dist-tag')

const output = resolve(
  process.env.ACCOUNT_KIT_EVIDENCE_DIR ?? (await mkdtemp(join(tmpdir(), 'masquerade-account-kit-')))
)
const logs = join(output, 'logs')
await mkdir(logs, { recursive: true })
const evidence: Record<string, unknown> = {
  mode: source ? 'local-source-interim' : 'published-alpha',
  requestedAlpha: published ?? null,
  node: process.versions.node,
  requested: { profile, database, strategy, sessionManagement },
  matrix: [],
  commands: [],
  status: 'running',
}
let interrupted: string | undefined
let activeChild: ChildProcess | undefined
let terminationGrace: ReturnType<typeof setTimeout> | undefined
function signalGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  if (!child.pid) return
  try {
    process.kill(-child.pid, signal)
  } catch {
    child.kill(signal)
  }
}
function terminateActive(signal: NodeJS.Signals): void {
  if (!activeChild) return
  signalGroup(activeChild, signal)
  if (!terminationGrace)
    terminationGrace = setTimeout(() => {
      if (activeChild) signalGroup(activeChild, 'SIGKILL')
    }, 5_000)
}
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    interrupted = signal
    terminateActive(signal)
  })
const baseEnv: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: 'test',
  TZ: 'UTC',
  HOST: '127.0.0.1',
  PORT: '3397',
  APP_URL: 'http://127.0.0.1:3397',
  APP_KEY: 'account_kit_consumer_fixture_key_0123456789',
  SESSION_DRIVER: 'database',
  DB_HOST: process.env.DB_HOST ?? '127.0.0.1',
  DB_PORT: process.env.DB_PORT ?? '55536',
  DB_USER: process.env.DB_USER ?? 'account_kit',
  DB_PASSWORD: process.env.DB_PASSWORD ?? '',
  DB_DATABASE: process.env.DB_DATABASE ?? 'account_kit_test',
  FORCE_COLOR: '0',
  NO_COLOR: '1',
}
delete baseEnv.ACCOUNT_KIT_SOURCE
delete baseEnv.ACCOUNT_KIT_ALPHA

async function run(
  cwd: string,
  args: string[],
  label: string,
  env: NodeJS.ProcessEnv = baseEnv,
  cleanup = false
): Promise<string> {
  if (interrupted && !cleanup) throw new Error(`Interrupted by ${interrupted}`)
  let contents = ''
  let failure: unknown
  try {
    contents = await new Promise<string>((resolveText, reject) => {
      const child = spawn('pnpm', args, {
        cwd,
        env,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      activeChild = child
      let text = ''
      let timedOut = false
      const timeout = setTimeout(() => {
        timedOut = true
        terminateActive('SIGTERM')
      }, 10 * 60_000)
      child.stdout?.on('data', (part) => {
        text += part
      })
      child.stderr?.on('data', (part) => {
        text += part
      })
      child.on('error', (error) => {
        failure = error
      })
      child.on('close', (code, signal) => {
        clearTimeout(timeout)
        if (terminationGrace) clearTimeout(terminationGrace)
        terminationGrace = undefined
        activeChild = undefined
        contents = text
        if (failure) reject(failure)
        else if (timedOut) reject(new Error(`${label} timed out after 10 minutes`))
        else if (interrupted && !cleanup) reject(new Error(`Interrupted by ${interrupted}`))
        else if (code !== 0)
          reject(
            new Error(`${label} failed (code ${code}, signal ${signal}):\n${text.slice(-5000)}`)
          )
        else resolveText(text)
      })
    })
  } catch (error) {
    failure = error
  }
  const log = join(logs, `${label}.log`)
  await writeFile(log, contents + (failure ? `\nRUNNER ERROR: ${String(failure)}\n` : ''))
  ;(evidence.commands as unknown[]).push({
    label,
    args,
    log,
    result: failure ? 'failed' : 'passed',
    tail: failure ? contents.slice(-3000) : undefined,
  })
  if (failure) throw failure
  console.log(`[account-kit] PASS ${label}`)
  return contents
}

async function overlay(sourceDir: string, destinationDir: string): Promise<void> {
  for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
    const from = join(sourceDir, entry.name)
    const to = join(destinationDir, entry.name)
    if (entry.isDirectory()) {
      await mkdir(to, { recursive: true })
      await overlay(from, to)
    } else if (entry.isFile()) await cp(from, to)
  }
}

async function replace(path: string, oldText: string, newText: string) {
  const before = await readFile(path, 'utf8')
  if (!before.includes(oldText)) throw new Error(`Fixture seam changed: ${path}: ${oldText}`)
  await writeFile(path, before.replace(oldText, newText))
}

async function setupPostgres(
  app: string,
  schema: string,
  action: 'create' | 'drop',
  env: NodeJS.ProcessEnv,
  cleanup = false
) {
  const sql =
    action === 'create' ? `create schema ${schema}` : `drop schema if exists ${schema} cascade`
  await run(
    app,
    [
      'exec',
      'node',
      '--input-type=module',
      '--eval',
      `import pg from 'pg'; const c=new pg.Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_DATABASE}); await c.connect(); try {await c.query(${JSON.stringify(sql)})} finally {await c.end()}`,
    ],
    `${schema}_${action}`,
    env,
    cleanup
  )
}

try {
  let kitArtifact: string | undefined
  if (source) {
    const checkout = resolve(source)
    const baseline = 'b2814006b83673346fb5533db8b3443a067d7d6c'
    const selectedRevision = process.env.ACCOUNT_KIT_SOURCE_REVISION ?? baseline
    const head = execFileSync('git', ['-C', checkout, 'rev-parse', selectedRevision], {
      encoding: 'utf8',
    }).trim()
    const changed = execFileSync('git', ['-C', checkout, 'diff', '--name-only', baseline, head], {
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter(Boolean)
    if (head !== baseline && head !== 'fb2ac430b5fe1cf1da2949c37fb3ac32aa62b193')
      throw new Error(`Unapproved Account Kit revision ${head}`)
    if (changed.some((name) => name !== 'package.json'))
      throw new Error(`Account Kit source differs from approved baseline: ${changed.join(', ')}`)
    const baselineManifest = JSON.parse(
      execFileSync('git', ['-C', checkout, 'show', `${baseline}:package.json`], {
        encoding: 'utf8',
      })
    )
    const headManifest = JSON.parse(
      execFileSync('git', ['-C', checkout, 'show', `${head}:package.json`], { encoding: 'utf8' })
    )
    for (const key of ['name', 'version']) {
      delete baselineManifest[key]
      delete headManifest[key]
    }
    if (JSON.stringify(baselineManifest) !== JSON.stringify(headManifest))
      throw new Error('Account Kit metadata differs beyond name/version')
    const dirty = execFileSync('git', ['-C', checkout, 'status', '--porcelain'], {
      encoding: 'utf8',
    }).trim()
    evidence.localSourceRevision = head
    evidence.localSourceBaseline = baseline
    evidence.localSourceDirtyIgnored = dirty.length > 0
    evidence.localSourceRequestedRevision = selectedRevision
    const kitCopy = join(output, 'kit-source')
    await mkdir(kitCopy)
    const archive = join(output, 'account-kit-source.tar')
    execFileSync('git', ['-C', checkout, 'archive', '--format=tar', '--output', archive, head])
    execFileSync('tar', ['-xf', archive, '-C', kitCopy])
    await run(kitCopy, ['install', '--frozen-lockfile'], 'local_kit_install')
    await run(kitCopy, ['build'], 'local_kit_build')
    kitArtifact = join(output, 'account-kit.tgz')
    await run(
      kitCopy,
      ['--config.verify-deps-before-run=false', 'pack', '--out', kitArtifact],
      'local_kit_pack'
    )
  }
  const kitSpec = kitArtifact ? `file:${kitArtifact}` : published!
  const pnpmVersion = await run(root, ['--version'], 'pnpm_version')
  evidence.pnpm = pnpmVersion.trim()
  await run(root, ['build'], 'masquerade_build')
  const masqueradeArtifact = join(output, 'masquerade.tgz')
  await run(root, ['pack', '--out', masqueradeArtifact], 'masquerade_pack')
  evidence.archives = Object.fromEntries(
    await Promise.all(
      [
        ['masquerade', masqueradeArtifact],
        ...(kitArtifact ? [['accountKit', kitArtifact]] : []),
      ].map(async ([name, path]) => [
        name,
        createHash('sha256')
          .update(await readFile(path))
          .digest('hex'),
      ])
    )
  )

  const floor: Record<string, string> = {
    '@adonisjs/core': '7.0.0',
    '@adonisjs/auth': '10.0.0',
    '@adonisjs/lucid': '22.4.2',
    '@adonisjs/session': '8.1.0',
    '@adonisjs/bouncer': '4.0.0',
    'typescript': '5.9.3',
  }
  const peerRanges = (
    JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
      peerDependencies: Record<string, string>
    }
  ).peerDependencies
  matrixLoop: for (const selectedProfile of profile === 'all' ? ['floor', 'latest'] : [profile]) {
    const versions = { ...floor }
    if (selectedProfile === 'latest')
      for (const name of Object.keys(versions)) {
        const listed = JSON.parse(
          await run(
            root,
            ['view', `${name}@${peerRanges[name]}`, 'version', '--json'],
            `view_${name.replaceAll('/', '_')}`
          )
        ) as string | string[]
        versions[name] = Array.isArray(listed) ? listed.at(-1)! : listed
      }
    for (const selectedDb of database === 'all' ? ['sqlite', 'pg'] : [database]) {
      for (const selectedStrategy of strategy === 'all'
        ? ['session', 'access_tokens']
        : [strategy]) {
        for (const selectedManagement of sessionManagement === 'all'
          ? ['on', 'off']
          : [sessionManagement]) {
          const label = `${selectedProfile}_${selectedDb}_${selectedStrategy}_${selectedManagement}`
          const app = join(output, label)
          await cp(template, app, {
            recursive: true,
            filter: (path) =>
              !relative(template, path)
                .split('/')
                .some((part) =>
                  ['node_modules', 'build', 'tmp', '.adonisjs', 'pnpm-lock.yaml'].includes(part)
                ),
          })
          await mkdir(join(app, 'tmp'), { recursive: true })
          await cp(masqueradeArtifact, join(app, 'masquerade.tgz'))
          if (kitArtifact) await cp(kitArtifact, join(app, 'account-kit.tgz'))
          const manifest = JSON.parse(await readFile(join(app, 'package.json'), 'utf8'))
          for (const [name, version] of Object.entries(versions))
            (name === 'typescript' ? manifest.devDependencies : manifest.dependencies)[name] =
              version
          if (selectedProfile === 'floor') manifest.dependencies['@adonisjs/vite'] = '6.0.1'
          manifest.dependencies['adonisjs-masquerade'] = 'file:./masquerade.tgz'
          manifest.dependencies['adonisjs-account-kit'] = kitArtifact
            ? 'file:./account-kit.tgz'
            : kitSpec
          await writeFile(join(app, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
          await writeFile(
            join(app, 'pnpm-workspace.yaml'),
            JSON.stringify({ overrides: versions, allowBuilds: manifest.allowScripts }, null, 2) +
              '\n'
          )
          const schema = `kit_${randomUUID().replaceAll('-', '')}`
          const env = {
            ...baseEnv,
            DB_CLIENT: selectedDb,
            DB_SCHEMA: schema,
            ACCOUNT_KIT_AUTH_STRATEGY: selectedStrategy,
            MASQUERADE_TRANSPORT: selectedStrategy === 'access_tokens' ? 'tokens' : 'session',
            ACCOUNT_KIT_SESSION_MANAGEMENT: selectedManagement === 'on' ? 'true' : 'false',
          }
          const cell: Record<string, unknown> = {
            profile: selectedProfile,
            database: selectedDb,
            strategy: selectedStrategy,
            sessionManagement: selectedManagement,
            result: 'running',
          }
          ;(evidence.matrix as unknown[]).push(cell)
          try {
            let schemaAttempted = false
            let primaryError: unknown
            try {
              await run(app, ['install', '--no-frozen-lockfile'], `${label}_install`, env)
              const resolvedKit = JSON.parse(
                await readFile(join(app, 'node_modules/adonisjs-account-kit/package.json'), 'utf8')
              ).version
              const resolvedMasquerade = JSON.parse(
                await readFile(join(app, 'node_modules/adonisjs-masquerade/package.json'), 'utf8')
              ).version
              const resolvedPeers = Object.fromEntries(
                await Promise.all(
                  Object.keys(versions).map(async (name) => [
                    name,
                    JSON.parse(
                      await readFile(join(app, 'node_modules', name, 'package.json'), 'utf8')
                    ).version,
                  ])
                )
              )
              Object.assign(cell, {
                accountKit: resolvedKit,
                masquerade: resolvedMasquerade,
                resolvedPeers,
              })
              if (published && resolvedKit !== published)
                throw new Error(`Expected Account Kit ${published}, installed ${resolvedKit}`)
              if (selectedDb === 'pg') {
                const pgVersion = await run(
                  app,
                  [
                    'exec',
                    'node',
                    '--input-type=module',
                    '--eval',
                    "import pg from 'pg'; const c=new pg.Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_DATABASE}); await c.connect(); try { const r=await c.query('show server_version'); console.log(r.rows[0].server_version) } finally { await c.end() }",
                  ],
                  `${label}_postgres_version`,
                  env
                )
                cell.postgresVersion = pgVersion.trim()
                if (!/^16\./m.test(pgVersion.trim()))
                  throw new Error(`PostgreSQL 16 required; found ${pgVersion.trim()}`)
                schemaAttempted = true
                await setupPostgres(app, schema, 'create', env)
              }
              await run(
                app,
                [
                  'exec',
                  'node',
                  'ace.js',
                  'configure',
                  'adonisjs-account-kit',
                  '--users-table=users',
                  '--user-id-type=integer',
                ],
                `${label}_configure`,
                env
              )
              await run(
                app,
                [
                  'exec',
                  'node',
                  'ace.js',
                  'account-kit:admission:install',
                  '--users-table=users',
                  '--user-id-type=integer',
                ],
                `${label}_admission_install`,
                env
              )
              await overlay(fixture, app)
              await replace(
                join(app, 'start/routes.ts'),
                "import './demo_json_routes.js'",
                "import './demo_json_routes.js'\nimport './account_kit_routes.js'\nimport './account_kit_fixture_routes.js'"
              )
              await replace(
                join(app, 'config/auth.ts'),
                ': guards) as typeof guards,',
                ': { web: guards.web, web_effective: guards.web_effective, members: guards.members }) as unknown as typeof guards,'
              )
              await replace(
                join(app, 'config/session.ts'),
                "import { defineConfig, stores } from '@adonisjs/session'",
                "import { defineConfig, stores } from '@adonisjs/session'\nimport { protectManagedSessionConfig } from 'adonisjs-account-kit/http'"
              )
              await replace(
                join(app, 'config/session.ts'),
                'export default sessionConfig',
                "export default protectManagedSessionConfig(sessionConfig, {\n  verifyStore: (actual) => typeof actual === 'object' && actual !== null && actual.constructor.name === 'DatabaseStore',\n})"
              )
              await replace(
                join(app, 'start/kernel.ts'),
                "  () => import('@adonisjs/auth/initialize_auth_middleware'),",
                "  () => import('@adonisjs/auth/initialize_auth_middleware'),\n  () => import('adonisjs-masquerade/account-kit/middleware'),\n  () => import('#middleware/account_kit_admission_middleware'),"
              )
              await replace(
                join(app, 'config/shield.ts'),
                '(routeName && bearerRouteNames.has(routeName)) ||',
                "(routeName && bearerRouteNames.has(routeName)) ||\n        (process.env.ACCOUNT_KIT_AUTH_STRATEGY === 'access_tokens' &&\n          ((routeName && routeName.startsWith('accountKit.')) || routePath === '/account/password' || routePath?.startsWith('/account/sessions/'))) ||"
              )
              await replace(
                join(app, 'adonisrc.ts'),
                "    () => import('adonisjs-masquerade/providers/masquerade_provider'),",
                "    () => import('adonisjs-masquerade/providers/masquerade_provider'),\n    () => import('adonisjs-masquerade/account-kit/provider'),\n    () => import('adonisjs-account-kit/admission/provider'),"
              )
              await run(
                app,
                ['exec', 'node', 'ace.js', 'migration:run', '--force'],
                `${label}_migrate`,
                env
              )
              await run(app, ['exec', 'node', 'ace.js', 'codegen'], `${label}_codegen`, env)
              await run(app, ['typecheck'], `${label}_typecheck`, env)
              await run(app, ['exec', 'node', 'ace.js', 'list:routes'], `${label}_routes`, env)
              const report = await run(
                app,
                ['exec', 'node', 'ace.js', 'masquerade:routes'],
                `${label}_route_report`,
                env
              )
              const kitLines = report.split('\n').filter((line) => line.includes('/kit/'))
              if (
                !kitLines.some((line) =>
                  line.includes('Account Kit managed (blocked while active)')
                ) ||
                !kitLines.some(
                  (line) =>
                    line.includes('/kit/account/logout') &&
                    line.includes('Account Kit managed (exempt)')
                ) ||
                (selectedStrategy === 'session' &&
                  !kitLines.some(
                    (line) =>
                      line.includes('/kit/auth/csrf') &&
                      line.includes('Account Kit managed (exempt)')
                  )) ||
                kitLines.some((line) => line.includes('UNCLASSIFIED'))
              )
                throw new Error(
                  `${label}: route report lacks managed classifications or exemptions`
                )
              const functionalFiles = await readdir(join(app, 'tests/functional'))
              const specFiles = functionalFiles
                .filter((name) => /^account_kit_.*\.spec\.ts$/.test(name))
                .sort()
              if (specFiles.length === 0) throw new Error(`${label}: no Account Kit cases found`)
              cell.specFiles = specFiles
              const caseOutputs: string[] = []
              const caseFailures: string[] = []
              for (const name of specFiles) {
                const caseLabel = `${label}_${name.replace(/\.spec\.ts$/, '')}`
                try {
                  const result = await run(
                    app,
                    ['exec', 'node', 'ace.js', 'test', `--files=tests/functional/${name}`],
                    caseLabel,
                    env
                  )
                  if (result.includes('NO TESTS EXECUTED'))
                    throw new Error(`${caseLabel}: Ace selected no tests`)
                  caseOutputs.push(result)
                } catch (error) {
                  caseFailures.push(`${name}: ${String(error)}`)
                  if (interrupted) break
                }
              }
              if (caseFailures.length)
                throw new Error(`${label}: Account Kit cases failed:\n${caseFailures.join('\n')}`)
              const journey = caseOutputs.join('\n')
              const timing = journey
                .split('\n')
                .filter((line) => line.includes('ACCOUNT_KIT_TIMING '))
                .map(
                  (line) =>
                    JSON.parse(line.split('ACCOUNT_KIT_TIMING ')[1]) as Record<string, unknown>
                )
              const requiredTiming = [
                'authenticated_idle_status_http',
                'idle_business_http',
                'active_business_http',
              ]
              const operations = timing.map((sample) => sample.operation)
              if (
                timing.length !== requiredTiming.length ||
                requiredTiming.some(
                  (name) => operations.filter((operation) => operation === name).length !== 1
                )
              )
                throw new Error(
                  `${label}: journey omitted a named timing operation: ${operations.join(', ')}`
                )
              for (const sample of timing) {
                if (
                  sample.strategy !== selectedStrategy ||
                  sample.database !== selectedDb ||
                  !Array.isArray(sample.samplesMs) ||
                  sample.samplesMs.length === 0 ||
                  sample.samplesMs.some(
                    (duration) =>
                      typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0
                  )
                )
                  throw new Error(
                    `${label}: malformed timing evidence for ${String(sample.operation)}`
                  )
              }
              const contention = journey
                .split('\n')
                .filter((line) => line.includes('ACCOUNT_KIT_CONTENTION '))
                .map(
                  (line) =>
                    JSON.parse(line.split('ACCOUNT_KIT_CONTENTION ')[1]) as Record<string, unknown>
                )
              if (selectedDb === 'sqlite') {
                if (contention.length !== 1)
                  throw new Error(`${label}: missing SQLite contention evidence`)
                const measure = contention[0]
                if (
                  measure.schema !== 'account-kit-contention.v1' ||
                  measure.database !== 'sqlite' ||
                  measure.strategy !== selectedStrategy ||
                  measure.sessionManagement !== (selectedManagement === 'on') ||
                  measure.measurement !== 'combined_http_and_kit_transactions'
                )
                  throw new Error(`${label}: malformed SQLite contention identity`)
                const states = measure.states as Record<string, Record<string, unknown>> | undefined
                if (
                  !states ||
                  !states.idle ||
                  !states.active ||
                  measure.concurrency !== 4 ||
                  measure.requestsPerState !== 8 ||
                  ['idle', 'active'].some(
                    (name) => states[name].failures !== 0 || states[name].successes !== 8
                  )
                )
                  throw new Error(`${label}: incomplete SQLite contention states`)
              } else if (contention.length !== 0)
                throw new Error(`${label}: unexpected PostgreSQL contention record`)
              Object.assign(cell, {
                cases: journey.split('\n').filter((line) => /[✔✖✓✗]/.test(line)),
                timing,
                contention: contention[0] ?? null,
                result: 'passed',
              })
            } catch (error) {
              primaryError = error
            } finally {
              if (schemaAttempted)
                try {
                  await setupPostgres(app, schema, 'drop', env, true)
                } catch (error) {
                  cell.cleanupError = String(error)
                  if (!primaryError) primaryError = error
                }
            }
            if (primaryError) throw primaryError
          } catch (error) {
            const caseNames = (cell.specFiles as string[] | undefined) ?? []
            const caseLogs = await Promise.all(
              caseNames.map(async (name) => {
                try {
                  return await readFile(
                    join(logs, `${label}_${name.replace(/\.spec\.ts$/, '')}.log`),
                    'utf8'
                  )
                } catch {
                  return ''
                }
              })
            )
            Object.assign(cell, {
              result: 'failed',
              error: String(error),
              cases: caseLogs
                .join('\n')
                .split('\n')
                .filter((line) => /[✔✖✓✗]/.test(line)),
            })
            process.exitCode = 1
            if (interrupted) break matrixLoop
          }
        }
      }
    }
  }
  evidence.status = process.exitCode ? 'failed' : 'passed'
} catch (error) {
  evidence.status = 'failed'
  evidence.error = String(error)
  process.exitCode = 1
} finally {
  const selectedProfiles = profile === 'all' ? ['floor', 'latest'] : [profile]
  const selectedDatabases = database === 'all' ? ['sqlite', 'pg'] : [database]
  const selectedStrategies = strategy === 'all' ? ['session', 'access_tokens'] : [strategy]
  const selectedManagementModes = sessionManagement === 'all' ? ['on', 'off'] : [sessionManagement]
  for (const p of selectedProfiles)
    for (const d of selectedDatabases)
      for (const st of selectedStrategies)
        for (const sm of selectedManagementModes) {
          if (
            !(evidence.matrix as Record<string, unknown>[]).some(
              (cell) =>
                cell.profile === p &&
                cell.database === d &&
                cell.strategy === st &&
                cell.sessionManagement === sm
            )
          )
            (evidence.matrix as unknown[]).push({
              profile: p,
              database: d,
              strategy: st,
              sessionManagement: sm,
              result: 'unrun',
              reason: String(evidence.error ?? interrupted ?? 'setup failed'),
            })
        }
  if (interrupted) {
    evidence.interrupted = interrupted
    evidence.status = 'failed'
    process.exitCode = 1
  }
  await writeFile(join(output, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n')
  console.log(`[account-kit] Evidence: ${join(output, 'evidence.json')}`)
}
