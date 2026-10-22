import { readFile } from 'node:fs/promises'
import { delimiter, dirname } from 'node:path'

export function parseDemoEnv(source: string, location: string): Record<string, string> {
  const values: Record<string, string> = {}
  for (const [index, raw] of source.split(/\r?\n/).entries()) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!match) throw new Error(`${location}:${index + 1} has an invalid environment assignment`)
    let value = match[2].trim()
    if (value.startsWith('"') || value.startsWith("'")) {
      const quote = value[0]
      if (value.length < 2 || value.at(-1) !== quote)
        throw new Error(`${location}:${index + 1} has an unterminated quoted value`)
      value = value.slice(1, -1)
      if (quote === '"')
        value = value
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')
    } else value = value.replace(/\s+#.*$/, '').trim()
    values[match[1]] = value
  }
  return values
}

export async function readDemoEnv(path: string): Promise<Record<string, string> | undefined> {
  try {
    return parseDemoEnv(await readFile(path, 'utf8'), path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

export function validateDemoEnv(
  fileValues: Record<string, string>,
  ambient: NodeJS.ProcessEnv,
  port: number
): NodeJS.ProcessEnv {
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('Demo port must be between 1 and 65535')
  const env: NodeJS.ProcessEnv = { ...ambient, ...fileValues }
  for (const [key, value] of Object.entries(ambient)) if (value !== undefined) env[key] = value
  for (const name of Object.keys(env)) {
    if (name.startsWith('ACCOUNT_KIT_') || name.startsWith('MASQUERADE_'))
      throw new Error(`The demo refuses ${name}; remove it and retry`)
  }
  env.HOST ??= '127.0.0.1'
  env.PORT ??= String(port)
  env.NODE_ENV ??= 'development'
  env.DB_CLIENT ??= 'sqlite'
  env.SESSION_DRIVER ??= 'database'
  if (env.HOST !== '127.0.0.1') throw new Error('The demo requires HOST=127.0.0.1')
  if (env.PORT !== String(port)) throw new Error(`The demo requires PORT=${port}`)
  if (env.NODE_ENV !== 'development') throw new Error('The demo requires NODE_ENV=development')
  if (env.DB_CLIENT !== 'sqlite') throw new Error('The demo requires DB_CLIENT=sqlite')
  if (env.SESSION_DRIVER !== 'database')
    throw new Error('The demo requires SESSION_DRIVER=database')
  const expectedUrl = `http://127.0.0.1:${port}`
  if (env.APP_URL === 'http://${HOST}:${PORT}') env.APP_URL = expectedUrl
  env.APP_URL ??= expectedUrl
  if (env.APP_URL !== expectedUrl) throw new Error(`The demo requires APP_URL=${expectedUrl}`)
  return env
}

export function childDemoEnv(
  fileValues: Record<string, string>,
  ambient: NodeJS.ProcessEnv,
  port: number
): NodeJS.ProcessEnv {
  const env = validateDemoEnv(fileValues, ambient, port)
  const nodeDirectory = dirname(process.execPath)
  env.PATH = `${nodeDirectory}${delimiter}${env.PATH ?? ''}`
  return env
}
