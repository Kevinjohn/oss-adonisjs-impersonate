import { invalidInput } from './errors.js'

export function normalizeReason(value: unknown): string {
  if (typeof value !== 'string') throw invalidInput()
  const reason = value.trim().replace(/\r\n/g, '\n')
  if (
    !reason ||
    // Only LF and TAB are permitted inside a normalised reason.
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/u.test(reason) ||
    [...reason].length > 500 ||
    Buffer.byteLength(reason) > 2000
  )
    throw invalidInput()
  return reason
}
