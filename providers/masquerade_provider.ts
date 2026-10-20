import type { ApplicationService } from '@adonisjs/core/types'

/** Registers the masquerade service in the container. Bindings are added in milestone M3. */
export default class MasqueradeProvider {
  constructor(protected app: ApplicationService) {}

  register(): void {}
}
