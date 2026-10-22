import { test } from '@japa/runner'
import type { MasqueradeBlockedBy } from '../index.js'
import { MasqueradeError } from '../src/errors.js'
import { fixture } from './helpers/core.js'
import { requestContext } from './helpers/http_context.js'

const allowedBlock: MasqueradeBlockedBy = 'view_only'
void allowedBlock
const allBlockedByValues: MasqueradeBlockedBy[] = ['sensitive', 'view_only', 'mutation_not_allowed']
void allBlockedByValues

// @ts-expect-error Every blocked action needs a cause.
new MasqueradeError('E_MASQUERADE_ACTION_BLOCKED')
// @ts-expect-error Other error codes do not accept blockedBy options.
new MasqueradeError('E_MASQUERADE_NOT_ALLOWED', { blockedBy: 'sensitive' })
const blockedError = new MasqueradeError('E_MASQUERADE_ACTION_BLOCKED', {
  blockedBy: 'sensitive',
})
// @ts-expect-error blockedBy is readonly.
blockedError.blockedBy = 'view_only'

test.group('MasqueradeError', () => {
  test('includes the blocked cause and preserves no-store cache headers', ({ assert }) => {
    const { ctx, responseState } = requestContext(fixture(), {})
    const error = new MasqueradeError('E_MASQUERADE_ACTION_BLOCKED', {
      blockedBy: 'mutation_not_allowed',
    })

    error.handle(error, ctx)

    assert.deepEqual(responseState.json, {
      errors: [
        {
          code: 'E_MASQUERADE_ACTION_BLOCKED',
          message: 'Action is blocked while masquerading',
          blockedBy: 'mutation_not_allowed',
        },
      ],
    })
    assert.equal(responseState.headers.get('cache-control'), 'no-store')
    assert.deepEqual(responseState.varies, [['Accept', 'X-Masquerade-Context']])
  })

  test('keeps other error payloads unchanged and omits blockedBy', ({ assert }) => {
    const { ctx, responseState } = requestContext(fixture(), {})
    const error = new MasqueradeError('E_MASQUERADE_CONTEXT_REQUIRED')
    Object.defineProperty(error, 'blockedBy', { value: 'sensitive' })
    error.handle(error, ctx)

    assert.deepEqual(responseState.json, {
      errors: [{ code: 'E_MASQUERADE_CONTEXT_REQUIRED', message: 'Masquerade context required' }],
    })
    assert.equal(responseState.headers.get('cache-control'), 'no-store')
    assert.equal('blockedBy' in (responseState.json as { errors: object[] }).errors[0]!, false)
  })
})
