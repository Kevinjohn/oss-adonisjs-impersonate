import { test } from '@japa/runner'
import { fixture } from './helpers/core.js'
import { requestContext } from './helpers/http_context.js'
import { contextField, shareMasquerade } from '../http/edge.js'

test.group('masquerade HTTP boundary', () => {
  test('renders an escaped hidden context field from a safe view', ({ assert }) => {
    assert.equal(
      contextField({ isMasquerading: false, contextToken: '0.' + 'a'.repeat(64) }),
      `<input type="hidden" name="_masqueradeContext" value="0.${'a'.repeat(64)}">`
    )
  })

  test('shares Edge state from the memoized admission snapshot without rereading storage', async ({
    assert,
  }) => {
    const f = fixture()
    let reads = 0
    const read = f.store.read.bind(f.store)
    f.store.read = async (owner) => {
      reads++
      return read(owner)
    }
    const { ctx } = requestContext(f, { method: 'GET' })
    let shared: Record<string, unknown> | undefined
    ;(ctx as { view: { share(value: Record<string, unknown>): void } }).view = {
      share: (value) => {
        shared = value
      },
    }
    const mode = await shareMasquerade(ctx)
    assert.equal(reads, 1)
    assert.deepEqual(shared?.masquerade, mode)
  })
})
