import type { SubprocessRuntime, SubprocessHandle } from '@deepseek-ai/dsh-subprocess'
import { fileURLToPath } from 'node:url'
import type { ProjectFile } from './paths.js'

export const TIMEOUT_MS = 15_000
export const STDOUT_LIMIT = 65_536
export const STDERR_LIMIT = 8_192
export interface Holder {
  readonly name: string
  readonly pid: number
  readonly applicationType: number
  readonly serviceName: string
}
export interface Observation {
  readonly observedAt: string
  readonly processes: readonly Holder[]
}
type JsonObject = Record<string, unknown>
function object(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function shortString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max && !/[\x00-\x1f\x7f]/u.test(value)
}

export function parseOutput(output: string): Observation {
  let value: unknown
  try { value = JSON.parse(output.replace(/^\uFEFF/u, '').trim()) }
  catch { throw new Error('助手输出不是有效 JSON。') }
  if (!object(value) || value.version !== 1 || typeof value.ok !== 'boolean') throw new Error('助手输出格式错误。')
  if (!value.ok) {
    if (!shortString(value.error, 256) || !value.error) throw new Error('助手错误输出格式错误。')
    throw new Error('查询失败：' + value.error)
  }
  if (!shortString(value.observedAt, 40) || !/^\d{4}-\d{2}-\d{2}T.*Z$/u.test(value.observedAt) ||
    !Number.isFinite(Date.parse(value.observedAt)) || !Array.isArray(value.processes) || value.processes.length > 1024) {
    throw new Error('助手输出格式错误。')
  }
  const processes: Holder[] = value.processes.map((row: unknown) => {
    if (!object(row) || !shortString(row.name, 255) || !row.name.trim() ||
      !Number.isSafeInteger(row.pid) || (row.pid as number) < 0 || (row.pid as number) > 0xffffffff ||
      !Number.isInteger(row.applicationType) || (row.applicationType as number) < 0 || (row.applicationType as number) > 1000 ||
      !shortString(row.serviceName, 63)) throw new Error('助手进程信息格式错误。')
    return { name: row.name, pid: row.pid as number, applicationType: row.applicationType as number, serviceName: row.serviceName }
  })
  return { observedAt: value.observedAt, processes }
}

export async function queryHolders(runtime: Pick<SubprocessRuntime, 'spawn'>, target: ProjectFile, options: {
  signal: AbortSignal; platform?: NodeJS.Platform; timeoutMs?: number
}): Promise<Observation> {
  if ((options.platform ?? process.platform) !== 'win32') throw new Error('暂不支持（仅 Windows）')
  if (options.signal.aborted) throw new Error('查询已取消。')
  const controller = new AbortController()
  let rejectStopped!: (error: Error) => void
  const stopped = new Promise<never>((_, reject) => { rejectStopped = reject })
  void stopped.catch(() => {}) // Also contain abort during a synchronous provider failure.
  let stopReason: Error | undefined
  const stop = (message: string) => {
    if (stopReason) return
    stopReason = new Error(message)
    controller.abort()
    rejectStopped(stopReason)
  }
  const onAbort = () => { stop('查询已取消。') }
  options.signal.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => { stop('查询超时（15 秒上限）。') }, options.timeoutMs ?? TIMEOUT_MS)
  let child: SubprocessHandle | undefined
  try {
    child = runtime.spawn({
      argv: ['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File',
        fileURLToPath(new URL('../file-holder.ps1', import.meta.url)), '-Path', target.file],
      cwd: target.root, stdio: { stdin: 'ignore', stdout: { maxBytes: STDOUT_LIMIT }, stderr: { maxBytes: STDERR_LIMIT } },
      graceMs: 500, signal: controller.signal,
    })
    const outcome = await Promise.race([child.done, stopped])
    if (stopReason) throw stopReason
    const stdout = child.collected.stdout?.readFrom(0)
    const stderr = child.collected.stderr?.readFrom(0)
    if (!stdout || !stderr) throw new Error('助手输出通道不可用。')
    if (stdout.lossy || stderr.lossy || stdout.nextOffset > STDOUT_LIMIT || stderr.nextOffset > STDERR_LIMIT ||
      Buffer.byteLength(stdout.text, 'utf8') > STDOUT_LIMIT || Buffer.byteLength(stderr.text, 'utf8') > STDERR_LIMIT) {
      throw new Error('助手输出超过上限，已截断；本次结果不可用。')
    }
    if (outcome.exitCode !== 0 || outcome.signal !== null) {
      // Structured helper failures are useful; never echo raw stderr/provider errors.
      if (stdout.text.trim()) parseOutput(stdout.text)
      throw new Error('助手执行失败；未取得有效查询结果。')
    }
    if (stderr.text.trim()) throw new Error('助手返回诊断错误；本次结果不可用。')
    return parseOutput(stdout.text)
  } catch (error: unknown) {
    if (stopReason) throw stopReason
    if (error instanceof Error && /^(助手|查询失败：)/u.test(error.message)) throw error
    throw new Error('助手启动或运行失败；请检查 PowerShell、Add-Type 与系统策略。')
  } finally {
    clearTimeout(timer)
    options.signal.removeEventListener('abort', onAbort)
    // Only the plugin-owned helper is cancelled; observed processes are never controlled.
    if (child && stopReason) {
      try { child.terminate() } catch { /* The signal already requested provider cleanup. */ }
    }
  }
}
