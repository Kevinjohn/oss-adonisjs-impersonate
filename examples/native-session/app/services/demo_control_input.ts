import type { HttpContext } from '@adonisjs/core/http'
import type { StartInput, StopInput } from 'adonisjs-masquerade/types'

const bodyLimit = 8 * 1024
const startKeys = new Set(['targetId', 'reason', 'access', '_masqueradeContext', '_csrf'])
const stopKeys = new Set(['_masqueradeContext', '_csrf'])

/** Keep the HTML forms within the canonical control input and audit boundary. */
export function demoStartInput(ctx: HttpContext): StartInput {
  const body = formBody(ctx, startKeys)
  if (!body) return invalidStartInput()
  return {
    targetId: body.targetId as StartInput['targetId'],
    reason: body.reason as StartInput['reason'],
    access: body.access as StartInput['access'],
    expectedContext: controlToken(ctx, body),
  }
}

export function demoStopInput(ctx: HttpContext): StopInput {
  const body = formBody(ctx, stopKeys)
  if (!body) return invalidStopInput()
  return { expectedContext: controlToken(ctx, body) }
}

function formBody(ctx: HttpContext, allowed: Set<string>): Record<string, unknown> | null {
  const contentType = ctx.request.header('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  const raw = ctx.request.raw()
  const body = ctx.request.body()
  if (contentType !== 'application/x-www-form-urlencoded') return null
  if (raw === null || Buffer.byteLength(raw, 'utf8') > bodyLimit) return null
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  if (Object.keys(body).some((key) => !allowed.has(key))) return null
  return body
}

function controlToken(ctx: HttpContext, body: Record<string, unknown>): string {
  const header = ctx.request.header('X-Masquerade-Context')
  const hidden = body._masqueradeContext
  if (header !== undefined && hidden !== undefined && header !== hidden) {
    return `0.${'0'.repeat(32)}`
  }
  const token = header ?? hidden
  return typeof token === 'string' ? token : ''
}

function invalidStartInput(): StartInput {
  return { __invalidHttpInput: true } as unknown as StartInput
}

function invalidStopInput(): StopInput {
  return { __invalidHttpInput: true } as unknown as StopInput
}
