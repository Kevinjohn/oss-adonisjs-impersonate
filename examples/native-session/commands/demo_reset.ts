import { BaseCommand } from '@adonisjs/core/ace'
import { resetDemoAccounts } from '#services/demo_accounts'

/** Remove only the reserved fictional accounts from the local SQLite database. */
export default class DemoResetCommand extends BaseCommand {
  static commandName = 'demo:reset'
  static description = 'Remove only the fictional local demo accounts'
  static options = { startApp: true }

  async run(): Promise<void> {
    await resetDemoAccounts({
      nodeEnv: this.app.getEnvironment(),
      dbClient: process.env.DB_CLIENT,
    })
    this.logger.info('Removed the demo accounts and their masquerade data.')
  }
}
