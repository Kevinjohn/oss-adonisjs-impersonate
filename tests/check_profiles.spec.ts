import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from '@japa/runner'
import { checkProfiles, selectedSteps } from '../bin/check_profiles.js'

const root = join(import.meta.dirname, '..')
const allSteps = Object.values(checkProfiles).flat()

function scripts(directory = ''): Record<string, string> {
  return JSON.parse(readFileSync(join(root, directory, 'package.json'), 'utf8')).scripts
}

test('every check step names an existing script', ({ assert }) => {
  const missing = allSteps.filter((step) => !(step.script in scripts(step.directory)))
  assert.deepEqual(missing, [])
})

test('the check profiles cover every pnpm script the CI workflows run', ({ assert }) => {
  const covered = new Set(allSteps.map((step) => step.script))
  const ignored = new Set(['install', 'dlx'])
  const uncovered = [
    'checks.yml',
    'e2e.yml',
    'account-kit.yml',
    'consumer.yml',
    'docs.yml',
  ].flatMap((workflow) =>
    [
      ...readFileSync(join(root, '.github/workflows', workflow), 'utf8').matchAll(
        /\bpnpm ([a-z][\w:-]*)/g
      ),
    ]
      .map((match) => match[1])
      .filter((script) => !ignored.has(script) && !covered.has(script))
      .map((script) => `${workflow}: ${script}`)
  )
  assert.deepEqual(uncovered, [])
})

test('profiles add to the quick profile and reject unknown flags', ({ assert }) => {
  assert.deepEqual(selectedSteps([]), checkProfiles.quick)
  assert.lengthOf(
    selectedSteps(['--full', '--browser']),
    checkProfiles.quick.length + checkProfiles.full.length + checkProfiles.browser.length
  )
  assert.throws(() => selectedSteps(['--fast']), /pnpm check/)
})
