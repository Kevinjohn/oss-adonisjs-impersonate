import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { test } from '@japa/runner'

const execFile = promisify(execFileCallback)
const appRoot = fileURLToPath(new URL('../../', import.meta.url))

test.group('test-only route registration boundary', () => {
  test('Ace route reports include probes only when NODE_ENV is test', async ({ assert }) => {
    const [normal, testEnvironment] = await Promise.all([
      routeReport('development'),
      routeReport('test'),
    ])

    assert.include(normal, '/masquerade/start')
    assert.notInclude(normal, '/business/form')
    assert.notInclude(normal, '/business/mutate')
    assert.notInclude(normal, '/members/status')

    assert.include(testEnvironment, '/masquerade/start')
    assert.include(testEnvironment, '/business/form')
    assert.include(testEnvironment, '/business/mutate')
    assert.include(testEnvironment, '/business/admitted-stop-form')
    assert.include(testEnvironment, '/members/status')
  })
})

async function routeReport(nodeEnv: 'development' | 'test'): Promise<string> {
  const { stdout, stderr } = await execFile(process.execPath, ['ace.js', 'masquerade:routes'], {
    cwd: appRoot,
    env: { ...process.env, NODE_ENV: nodeEnv },
  })
  return `${stdout}\n${stderr}`
}
