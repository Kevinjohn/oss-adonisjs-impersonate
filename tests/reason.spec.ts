import { test } from '@japa/runner'
import { normalizeReason } from '../src/reason.js'

test('normalizes reason in trim, CRLF then controls order', ({ assert }) => {
  assert.equal(normalizeReason(' \r\ncase\r\nnotes\t42\r\n '), 'case\nnotes\t42')
  assert.equal(normalizeReason('\r case \r'), 'case')
  assert.throws(() => normalizeReason('case\rnotes'), 'Invalid masquerade input')
})
for (const [name, value] of Object.entries({
  empty: '',
  whitespace: ' \t\n ',
  c0: 'a\u0000b',
  c1: 'a\u0085b',
  codepoints: 'a'.repeat(501),
  oversized: 'x'.repeat(10001),
  nonstring: 42,
}))
  test(`rejects reason ${name}`, ({ assert }) =>
    assert.throws(() => normalizeReason(value), 'Invalid masquerade input'))
test('counts Unicode code points and UTF8 bytes at the allowed boundaries', ({ assert }) => {
  assert.equal([...normalizeReason('😀'.repeat(500))].length, 500)
  assert.equal(Buffer.byteLength(normalizeReason('😀'.repeat(500))), 2000)
  assert.throws(() => normalizeReason('😀'.repeat(501)), 'Invalid masquerade input')
})

test('bounds the normalized reason after trimming arbitrary whitespace padding', ({ assert }) => {
  assert.equal(normalizeReason(' '.repeat(12000) + 'case' + '\n'.repeat(12000)), 'case')
})
