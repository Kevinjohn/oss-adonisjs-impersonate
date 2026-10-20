import { test } from '@japa/runner'
import { validateSubject } from '../src/subject_validation.js'
import { fixture } from './helpers/core.js'

test('validates bounded canonical IDs and immutable incarnations against authority mapping', ({
  assert,
}) => {
  const f = fixture()
  const user = f.users.get('a')!
  const subject = { id: 'a', incarnation: 'a', user }
  assert.strictEqual(validateSubject(subject, f.config.authority), subject)
  for (const patch of [
    { id: '' },
    { id: 'x'.repeat(256) },
    { id: ['a'] },
    { incarnation: 'x'.repeat(129) },
    { incarnation: 'different' },
    { incarnation: ['a'] },
  ])
    assert.throws(
      () => validateSubject({ ...subject, ...patch } as never, f.config.authority),
      'Masquerade is unavailable'
    )
  assert.strictEqual(
    validateSubject(subject, { ...f.config.authority, incarnation: 'id' }),
    subject
  )
})
