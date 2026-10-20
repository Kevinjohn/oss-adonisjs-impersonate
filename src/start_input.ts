import { boundedString } from './bounded_string.js'
import { invalidInput } from './errors.js'
import { normalizeReason } from './reason.js'
import type { StartInput } from './types.js'

export function validateStartInputShape(input: StartInput): void {
  if (
    !input ||
    Object.keys(input).some(
      (key) => !['targetId', 'reason', 'durationSeconds', 'expectedContext'].includes(key)
    )
  )
    throw invalidInput()
}

/** Parse the selection only after context freshness and existing mode checks. */
export function parseStartSelection(
  input: StartInput,
  actorId: string,
  defaultDuration: number,
  maxDuration: number
): { targetId: string; reason: string; duration: number } {
  const reason = normalizeReason(input.reason)
  if (!(
    typeof input.targetId === 'string' ||
    (typeof input.targetId === 'number' && Number.isSafeInteger(input.targetId))
  ))
    throw invalidInput()
  const targetId = String(input.targetId)
  if (!boundedString(targetId, 255) || targetId === actorId) throw invalidInput()
  const duration = input.durationSeconds === undefined ? defaultDuration : input.durationSeconds
  if (!Number.isInteger(duration) || duration < 60 || duration > maxDuration) throw invalidInput()
  return { targetId, reason, duration }
}
