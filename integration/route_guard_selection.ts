import { routeGuards } from './route_guards.js'
import { MasqueradeError } from '../src/errors.js'

type RouteMetadata = { middleware: { all(): Iterable<unknown> } }
export type RouteGuardSelection = { kind: 'none' | 'raw' | 'effective'; raw: string }

/** Resolve a route to one credential transport before authenticating or reading mode state. */
export function selectRouteGuard(
  route: RouteMetadata | undefined,
  defaultGuard: string,
  effectiveRawGuards: Readonly<Record<string, string>>,
  registeredRawGuards: readonly string[],
  primaryRawGuard = effectiveRawGuards[defaultGuard]
): RouteGuardSelection {
  const guards = routeGuards(route, defaultGuard)
  if (guards.length === 0) {
    if (
      route &&
      [...route.middleware.all()].some(
        (entry) =>
          typeof entry === 'object' && entry !== null && 'name' in entry && entry.name === 'auth'
      )
    )
      throw new MasqueradeError('E_MASQUERADE_UNAVAILABLE')
    if (!primaryRawGuard) throw new MasqueradeError('E_MASQUERADE_UNAVAILABLE')
    return { kind: 'none', raw: primaryRawGuard }
  }
  let selection: RouteGuardSelection | undefined
  for (const guard of guards) {
    const effectiveRaw = Object.hasOwn(effectiveRawGuards, guard)
      ? effectiveRawGuards[guard]
      : undefined
    const kind = effectiveRaw ? 'effective' : 'raw'
    const raw = effectiveRaw ?? guard
    if (!registeredRawGuards.includes(raw)) throw new MasqueradeError('E_MASQUERADE_UNAVAILABLE')
    if (selection && (selection.kind !== kind || selection.raw !== raw))
      throw new MasqueradeError('E_MASQUERADE_UNAVAILABLE')
    selection = { kind, raw }
  }
  return selection!
}
