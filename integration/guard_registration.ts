/** Registration identifies package factories without inspecting private auth state. */
const effectiveFactories = new WeakSet<object>()
export function markEffectiveFactory<Factory extends (...args: never[]) => unknown>(
  factory: Factory
): Factory {
  effectiveFactories.add(factory)
  return factory
}
export function isEffectiveFactory(factory: unknown): boolean {
  return typeof factory === 'function' && effectiveFactories.has(factory)
}
