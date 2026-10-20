import PruneCommand from './prune.js'

type CommandMetadata = ReturnType<typeof PruneCommand.serialize>

/** Metadata consumed by AdonisJS Ace command discovery. */
export async function getMetaData(): Promise<CommandMetadata[]> {
  return [PruneCommand.serialize()]
}

/** Resolve the registered command by the same contract used by AdonisJS core. */
export async function getCommand(metaData: CommandMetadata) {
  if (metaData.commandName !== PruneCommand.commandName) return null
  return PruneCommand
}
