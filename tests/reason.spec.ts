import { test } from '@japa/runner'
import { normalizeReason, parseStartReason } from '../src/reason.js'

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

test('optional reason stores absent, null and blank input as null', ({ assert }) => {
  for (const value of [undefined, null, '', ' \t\r\n '])
    assert.isNull(parseStartReason(value, 'optional'))
  assert.equal(parseStartReason(' case\r\n42 ', 'optional'), 'case\n42')
})

test('optional reason still rejects invalid supplied reasons', ({ assert }) => {
  for (const value of [42, 'a\u0000b', 'a'.repeat(501)])
    assert.throws(() => parseStartReason(value, 'optional'), 'Invalid masquerade input')
})

test('required reason rejects absent, null and blank input', ({ assert }) => {
  for (const value of [undefined, null, '', ' \t '])
    assert.throws(() => parseStartReason(value, 'required'), 'Invalid masquerade input')
  assert.equal(parseStartReason(' case ', 'required'), 'case')
})
