import type { HttpContext } from '@adonisjs/core/http'
import { MasqueradeError } from '../src/errors.js'

/** Render only package errors; framework, CSRF, limiter, and host errors remain native. */
export function renderMasqueradeError(ctx: HttpContext, error: unknown): boolean {
  if (!(error instanceof MasqueradeError)) return false
  ctx.response.header('Cache-Control', 'no-store')
  ctx.response.vary(['Accept', 'X-Masquerade-Context'])
  ctx.response.status(error.status).json({
    errors: [{ code: error.code, message: error.message }],
  })
  return true
}
