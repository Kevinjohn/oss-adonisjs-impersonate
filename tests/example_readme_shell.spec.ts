import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'

test('example shell blocks are safe to paste into an interactive terminal', async ({ assert }) => {
  const readme = await readFile(
    new URL('../examples/native-session/README.md', import.meta.url),
    'utf8'
  )
  const blocks = [...readme.matchAll(/```sh\n([\s\S]*?)```/g)].map(([, body]) => body)
  assert.isAbove(blocks.length, 0)
  // errexit or nounset would close the reader's shell on an expected 409/428 and lose the token.
  for (const block of blocks) assert.notMatch(block, /^\s*set\s+-[a-z]*[eu]/m)
})
