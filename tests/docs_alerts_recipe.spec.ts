import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'

test.group('alerts recipe', () => {
  test('documents the listener module the native-session example type-checks', async ({
    assert,
  }) => {
    const page = await readFile(new URL('../docs/guide/alerts.md', import.meta.url), 'utf8')
    const example = await readFile(
      new URL('../examples/native-session/start/masquerade_alerts.ts', import.meta.url),
      'utf8'
    )
    const block = page.match(/<!-- host-recipe:masquerade-alerts -->\n\n```ts\n([\s\S]*?)```/)
    assert.isNotNull(block)
    assert.equal(block![1], example)
  })
})
