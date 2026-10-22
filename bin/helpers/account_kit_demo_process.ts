import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

export function groupExists(pid: number): boolean {
  try {
    process.kill(-pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

export function signalGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
  }
}

async function cleanupGroup(pid: number): Promise<void> {
  signalGroup(pid, 'SIGTERM')
  for (let attempt = 0; attempt < 30; attempt++) {
    if (!groupExists(pid)) return
    await delay(100)
  }
  signalGroup(pid, 'SIGKILL')
  for (let attempt = 0; attempt < 20; attempt++) {
    if (!groupExists(pid)) return
    await delay(100)
  }
  throw new Error(`Owned process group ${pid} did not exit after SIGKILL`)
}

export async function runDemoCommand(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  signal?: AbortSignal
): Promise<void> {
  signal?.throwIfAborted()
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  })
  const exited = new Promise<{ code: number | null; exitSignal: NodeJS.Signals | null }>(
    (resolve, reject) => {
      child.once('error', reject)
      child.once('exit', (code, exitSignal) => resolve({ code, exitSignal }))
    }
  )
  let cleanup: Promise<void> | undefined
  let rejectCleanup: (reason?: unknown) => void = () => {}
  const cleanupFailed = new Promise<never>((_, reject) => {
    rejectCleanup = reject
  })
  const stop = () => {
    if (cleanup || child.pid === undefined) return
    if (process.platform === 'win32') {
      child.kill('SIGTERM')
      cleanup = (async () => {
        const stopped = await Promise.race([
          exited.then(() => true),
          delay(3_000).then(() => false),
        ])
        if (!stopped) child.kill('SIGKILL')
        await exited
      })()
    } else {
      cleanup = cleanupGroup(child.pid)
    }
    // Bound the wait for exit even if the owned group cannot be cleared after SIGKILL.
    void cleanup.catch(rejectCleanup)
  }
  signal?.addEventListener('abort', stop, { once: true })
  try {
    let result: { code: number | null; exitSignal: NodeJS.Signals | null }
    try {
      result = await Promise.race([exited, cleanupFailed])
    } catch (error) {
      stop()
      if (cleanup) await cleanup
      throw error
    }
    if (
      signal?.aborted ||
      result.code !== 0 ||
      (child.pid !== undefined && process.platform !== 'win32' && groupExists(child.pid))
    ) {
      stop()
      if (cleanup) await cleanup
    }
    signal?.throwIfAborted()
    if (result.code !== 0)
      throw new Error(
        `${command} ${args.join(' ')} exited with ${result.code ?? result.exitSignal}`
      )
  } finally {
    signal?.removeEventListener('abort', stop)
    if (cleanup) await cleanup
  }
}
