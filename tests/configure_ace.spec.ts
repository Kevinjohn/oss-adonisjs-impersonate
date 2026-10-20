import { test } from '@japa/runner'
import { IgnitorFactory } from '@adonisjs/core/factories'
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

test.group('Masquerade configure scaffold', () => {
  test('loads and executes the package hook through native Ace', async ({ assert }) => {
    const root = await mkdtemp(join(tmpdir(), 'masquerade-ace-configure-'))
    const previousProcessExitCode = process.exitCode
    try {
      await mkdir(join(root, 'config'), { recursive: true })
      await mkdir(join(root, 'start'), { recursive: true })
      await mkdir(join(root, 'node_modules'), { recursive: true })
      await writeFile(join(root, 'config/auth.ts'), 'export default {}')
      await writeFile(join(root, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}\n')
      await writeFile(
        join(root, 'adonisrc.ts'),
        `import { defineConfig } from '@adonisjs/core'
export default defineConfig({
  providers: [() => import('#providers/host_provider')],
  commands: [() => import('#commands/host_command')],
})\n`
      )
      await symlink(
        join(process.cwd(), 'node_modules/@adonisjs'),
        join(root, 'node_modules/@adonisjs'),
        'dir'
      )
      await symlink(process.cwd(), join(root, 'node_modules/adonisjs-masquerade'), 'dir')

      const ignitor = new IgnitorFactory()
        .withCoreProviders()
        .withCoreConfig()
        .merge({ rcFileContents: { commands: [configureCommandLoader] } })
        .create(pathToFileURL(root + '/'))
      await ignitor
        .ace()
        .configure(async (app) => {
          app.import = async (specifier: string) => {
            if (specifier === 'adonisjs-masquerade') return import('adonisjs-masquerade')
            if (specifier === '@adonisjs/lucid') return import('@adonisjs/lucid')
            if (specifier === '@adonisjs/assembler/code_transformer')
              return import('@adonisjs/assembler/code_transformer')
            throw new Error('Unexpected package import: ' + specifier)
          }
        })
        .handle(['configure', 'adonisjs-masquerade', '--namespace=ace_app', '--guard=web'])
      assert.equal(process.exitCode, 0)
      process.exitCode = previousProcessExitCode

      await ignitor
        .ace()
        .configure(async (app) => {
          app.import = async (specifier: string) => {
            if (specifier === 'adonisjs-masquerade') return import('adonisjs-masquerade')
            if (specifier === '@adonisjs/lucid') return import('@adonisjs/lucid')
            if (specifier === '@adonisjs/assembler/code_transformer')
              return import('@adonisjs/assembler/code_transformer')
            throw new Error('Unexpected package import: ' + specifier)
          }
        })
        .handle([
          'configure',
          'adonisjs-masquerade',
          '--namespace=ace_app',
          '--guard=web',
          '--force',
        ])
      assert.equal(process.exitCode, 0)

      assert.include(
        await readFile(join(root, 'config/masquerade.ts'), 'utf8'),
        'namespace: "ace_app"'
      )
      assert.include(
        await readFile(join(root, 'app/services/masquerade_user_provider.ts'), 'utf8'),
        'sessionUserProvider'
      )
      const migrations = await readdir(join(root, 'database/migrations'))
      assert.equal(migrations.length, 1)
      const rcFile = await readFile(join(root, 'adonisrc.ts'), 'utf8')
      assert.include(rcFile, "'#providers/host_provider'")
      assert.include(rcFile, "'#commands/host_command'")
      assert.isBelow(
        rcFile.indexOf('#providers/masquerade_native_provider'),
        rcFile.indexOf('adonisjs-masquerade/providers/masquerade_provider')
      )
      assert.equal(rcFile.match(/adonisjs-masquerade\/providers\/masquerade_provider/g)?.length, 1)
      assert.equal(rcFile.match(/adonisjs-masquerade\/commands/g)?.length, 1)
      assert.include(rcFile, '#providers/masquerade_native_provider')

      const middlewareModule = await import(
        pathToFileURL(join(root, 'app/middleware/masquerade_context_middleware.ts')).href
      )
      assert.equal(typeof middlewareModule.default, 'function', JSON.stringify(middlewareModule))
      assert.equal(typeof middlewareModule.default.prototype.handle, 'function')
      const middleware = new middlewareModule.default()
      let continued = false
      await middleware.handle(
        { route: undefined, auth: { defaultGuard: 'web' } } as never,
        async () => {
          continued = true
        }
      )
      assert.isTrue(
        continued,
        'generated middleware class should load and invoke the package handler'
      )
    } finally {
      process.exitCode = previousProcessExitCode
      await rm(root, { recursive: true, force: true })
    }
  })
    .timeout(10_000)
    // The generated app imports the compiled package; `pnpm test:built-exports` runs this after build.
    .skip(process.env.TEST_BUILT_EXPORTS !== '1', 'requires the built package')
})

async function configureCommandLoader() {
  const configureModule = await import('@adonisjs/core/commands/configure')
  const ConfigureCommand = configureModule.default
  return {
    async getMetaData() {
      return [ConfigureCommand.serialize()]
    },
    async getCommand(metaData: ReturnType<typeof ConfigureCommand.serialize>) {
      return metaData.commandName === ConfigureCommand.commandName ? ConfigureCommand : null
    },
  }
}
