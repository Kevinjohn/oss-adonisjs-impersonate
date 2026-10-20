import { assert } from '@japa/assert'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import { apiClient } from '@japa/api-client'
import { authApiClient } from '@adonisjs/auth/plugins/api_client'
import { sessionApiClient } from '@adonisjs/session/plugins/api_client'
import { shieldApiClient } from '@adonisjs/shield/plugins/api_client'
import type { Config } from '@japa/runner/types'

export const plugins: Config['plugins'] = [
  assert(),
  pluginAdonisJS(app),
  apiClient(),
  authApiClient(app),
  sessionApiClient(app),
  shieldApiClient(),
]

export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [],
  teardown: [],
}

export const configureSuite: Config['configureSuite'] = (suite) => {
  if (suite.name === 'functional') return suite.setup(() => testUtils.httpServer().start())
}
