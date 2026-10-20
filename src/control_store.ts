import { unavailable } from './errors.js'
import type { ControlStore } from './types.js'

/** Resolve the host store and validate the capabilities needed by its caller. */
export async function openControlStore(
  factory: () => Promise<ControlStore>,
  environment: string,
  required: readonly (keyof ControlStore)[]
): Promise<ControlStore> {
  let store: ControlStore
  try {
    store = await factory()
  } catch {
    throw unavailable()
  }
  if (
    !store ||
    (store.testOnly && environment !== 'test') ||
    !required.every((name) => typeof store[name] === 'function')
  )
    throw new TypeError('Invalid masquerade store for environment')
  return store
}
