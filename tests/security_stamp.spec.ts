import { test } from '@japa/runner'
import { stampHash } from '../src/security_stamp.js'

test('hashes opaque stamps with a512 UTF8 byte bound without storing plaintext', ({ assert }) => {
  assert.match(stampHash('secret'), /^[a-f0-9]{64}$/)
  assert.equal(stampHash('secret'), stampHash('secret'))
  assert.notEqual(stampHash('secret'), stampHash('other'))
  assert.match(stampHash('\u0000\r\nopaque'), /^[a-f0-9]{64}$/)
  assert.match(stampHash('😀'.repeat(128)), /^[a-f0-9]{64}$/)
  for (const value of [
    '',
    undefined,
    ['secret'],
    'a'.repeat(513),
    '😀'.repeat(129),
    '\uD800',
    '\uDC00',
    'a\uD800b',
  ])
    assert.throws(() => stampHash(value), 'Masquerade is unavailable')
})
