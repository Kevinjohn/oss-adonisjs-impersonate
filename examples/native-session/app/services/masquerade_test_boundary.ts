import type { LucidControlStore } from 'adonisjs-masquerade/stores/lucid'
import {
  FixtureControlStore,
  masqueradeFixtureDiagnostics,
  resetMasqueradeFixtureDiagnostics,
  resetMasqueradeReadCount,
  setMasqueradeStoreUnavailable,
} from '#services/fixture_control_store'

export {
  masqueradeFixtureDiagnostics,
  resetMasqueradeFixtureDiagnostics,
  resetMasqueradeReadCount,
  setMasqueradeStoreUnavailable,
}

export function withFixtureControlStore(store: LucidControlStore) {
  return new FixtureControlStore(store)
}
