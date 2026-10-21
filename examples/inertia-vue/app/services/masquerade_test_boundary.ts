import type { LucidControlStore } from 'adonisjs-masquerade/stores/lucid'
import {
  setMasqueradeStoreUnavailable,
  withFixtureControlStore as wrapFixtureControlStore,
} from '#services/fixture_control_store'

export { setMasqueradeStoreUnavailable }

export function withFixtureControlStore(store: LucidControlStore) {
  return wrapFixtureControlStore(store)
}
