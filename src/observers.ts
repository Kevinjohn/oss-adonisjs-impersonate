import type { AuditEvent, ServiceDependencies } from './types.js'

export type ObserverDependencies = Pick<
  ServiceDependencies<unknown, unknown>,
  'emitter' | 'logger' | 'observerErrorHandler'
>

/** Never await untrusted observers, including the failure reporter itself. */
export function observe(dependencies: ObserverDependencies, event: AuditEvent): void {
  const safe = { ...event }
  delete safe.reason
  const projection = Object.freeze(safe)
  const report = (error: unknown) => {
    try {
      Promise.resolve(dependencies.observerErrorHandler?.(error)).catch(() => {})
    } catch {}
  }
  const invoke = (callback: () => unknown) => {
    try {
      Promise.resolve(callback()).catch(report)
    } catch (error) {
      report(error)
    }
  }
  invoke(() => dependencies.emitter?.emit(`masquerade:${event.kind}`, projection))
  invoke(() => dependencies.logger?.info(projection))
}
export function reportUnknown(dependencies: ObserverDependencies, transitionId: string): void {
  try {
    Promise.resolve(
      dependencies.logger?.error({ code: 'E_MASQUERADE_UNAVAILABLE', transitionId })
    ).catch((error) => {
      try {
        Promise.resolve(dependencies.observerErrorHandler?.(error)).catch(() => {})
      } catch {}
    })
  } catch (error) {
    try {
      Promise.resolve(dependencies.observerErrorHandler?.(error)).catch(() => {})
    } catch {}
  }
}
