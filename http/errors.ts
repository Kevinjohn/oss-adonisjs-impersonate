import type { HttpContext } from '@adonisjs/core/http'
import { MasqueradeError } from '../src/errors.js'

/** Render only package errors; framework, CSRF, limiter, and host errors remain native. */
export function renderMasqueradeError(ctx: HttpContext, error: unknown): boolean {
  if (!(error instanceof MasqueradeError)) return false
  error.handle(error, ctx)
  return true
}
