interface MountedRoute {
  name?: string
  methods: string[]
  pattern: string
}
interface RegisteredRoute {
  name: string
  method: string
  path: string
}

/** Check names and method/path pairs across every committed router domain. */
export function assertManagedRouteRegistration(
  domains: Record<string, MountedRoute[]>,
  registration: { routes: readonly RegisteredRoute[] } | undefined
): void {
  const expected = new Map(
    registration?.routes.map((route) => [`accountKit.${route.name}`, route]) ?? []
  )
  for (const routes of Object.values(domains)) {
    for (const route of routes) {
      if (!route.name?.startsWith('accountKit.')) continue
      const entry = expected.get(route.name)
      const allowed = entry?.method === 'GET' ? ['GET', 'HEAD'] : [entry?.method]
      if (
        !entry ||
        route.pattern !== entry.path ||
        !route.methods.includes(entry.method) ||
        route.methods.some((method) => !allowed.includes(method))
      )
        throw new TypeError(`Account Kit managed route ${route.name} is not registered`)
    }
  }
}
