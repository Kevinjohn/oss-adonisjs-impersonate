import type { HttpContext } from '@adonisjs/core/http'

const marker = Symbol('masquerade.routeMarker')
type MarkerName = 'sensitive' | 'allowMutation'
type RouteMetadata = { middleware: { all(): Iterable<unknown> } }
type MarkedMiddleware = ((ctx: HttpContext, next: () => Promise<unknown>) => Promise<unknown>) & {
  [marker]?: MarkerName
}

/** Mark a route or route group as always blocked while a masquerade is active. */
export function sensitive(): MarkedMiddleware {
  return createMarker('sensitive')
}

/** Allow unsafe business actions while a masquerade is active, except sensitive routes. */
export function allowMutation(): MarkedMiddleware {
  return createMarker('allowMutation')
}

function createMarker(name: MarkerName): MarkedMiddleware {
  const middleware: MarkedMiddleware = async (_ctx, next) => next()
  Object.defineProperty(middleware, marker, { value: name })
  return middleware
}

/**
 * Classify from route middleware registered by the router, before global
 * middleware such as `silent_auth` can authenticate a default guard.
 */
export function isBusinessRoute(
  ctx: HttpContext,
  effectiveGuardName: string,
  effectiveGuardNames: readonly string[] = [effectiveGuardName]
): boolean {
  return routeGuards(ctx.route, effectiveGuardName).some((guard) =>
    effectiveGuardNames.includes(guard)
  )
}

/** Resolve omitted auth options once; an explicitly named "default" remains an ordinary guard. */
export function routeGuards(route: RouteMetadata | undefined, defaultGuardName: string): string[] {
  if (!route) return []
  const guards = new Set<string>()
  for (const middleware of route.middleware.all()) {
    if (typeof middleware !== 'object' || !middleware || !('name' in middleware)) continue
    const namedMiddleware = middleware as { name?: unknown; args?: unknown }
    if (namedMiddleware.name !== 'auth') continue
    const rawArgs = namedMiddleware.args
    const configured = Array.isArray(rawArgs) ? rawArgs[0] : rawArgs
    if (configured === undefined || configured === null) {
      guards.add(defaultGuardName)
      continue
    }
    if (typeof configured === 'object' && !Array.isArray(configured)) {
      const options = configured as { guards?: unknown }
      if (options.guards === undefined) {
        guards.add(defaultGuardName)
        continue
      }
      if (Array.isArray(options.guards)) {
        for (const guard of options.guards) if (typeof guard === 'string') guards.add(guard)
      }
      continue
    }
    if (Array.isArray(configured)) {
      if (configured.length === 0) guards.add(defaultGuardName)
      for (const guard of configured) if (typeof guard === 'string') guards.add(guard)
    }
  }
  return [...guards]
}

/** Read marker state from the actual matched route, including inherited group middleware. */
export function routeMarkers(ctx: { route?: RouteMetadata }): {
  sensitive: boolean
  allowMutation: boolean
} {
  let isSensitive = false
  let permitsMutation = false
  for (const middleware of ctx.route?.middleware.all() ?? []) {
    if (typeof middleware !== 'function') continue
    const name = (middleware as MarkedMiddleware)[marker]
    if (name === 'sensitive') isSensitive = true
    if (name === 'allowMutation') permitsMutation = true
  }
  return { sensitive: isSensitive, allowMutation: permitsMutation }
}
