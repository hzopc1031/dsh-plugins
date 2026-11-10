import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { rm, appendFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

export type CaptureResult = 'success' | 'cancelled' | 'save-failed' | 'failed' | 'timeout'
export interface CaptureJob { readonly done: Promise<CaptureResult>; cancel(): void }
export type CaptureRunner = (file: string) => CaptureJob
export type SpawnCapture = (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess

export function exitResult(code: number | null): CaptureResult {
  return code === 0 ? 'success' : code === 2 ? 'cancelled' : code === 6 ? 'save-failed' : 'failed'
}

// Do not log capabilities, file contents, user paths, or subprocess output.
export function logError(event: string): void {
  void appendFile(join(tmpdir(), 'dsh-screenshot.log'), `${new Date().toISOString()} dsh-snip-attach: ${event}\n`).catch(() => {})
}

export function capture(file: string, options: {
  spawn?: SpawnCapture; timeoutMs?: number; log?: (event: string) => void
} = {}): CaptureJob {
  const launch = options.spawn ?? spawn
  const log = options.log ?? logError
  let child: ChildProcess | undefined
  let settled = false
  let cancelled = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let finish!: (result: CaptureResult) => void
  const done = new Promise<CaptureResult>(resolve => { finish = resolve })
  const settle = (result: CaptureResult) => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    if (result !== 'success' && result !== 'cancelled') log(`capture ${result}`)
    finish(result)
  }
  const cancel = () => {
    cancelled = true
    try { child?.kill() } catch { log('capture kill failed') }
    settle('timeout')
  }
  try {
    child = launch('powershell.exe', [
      '-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File',
      fileURLToPath(new URL('../capture.ps1', import.meta.url)), '-OutFile', file,
    ], { windowsHide: true, stdio: 'ignore', shell: false })
    child.once('error', () => { settle('failed') })
    child.once('close', code => {
      settle(exitResult(code))
      // A killed child may have completed a save just before exiting.
      if (cancelled) void rm(file, { force: true }).catch(() => { log('late file cleanup failed') })
    })
    timer = setTimeout(cancel, options.timeoutMs ?? 150_000)
    timer.unref()
  } catch { settle('failed') }
  return { done, cancel }
}
