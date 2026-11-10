import type { SubprocessRuntime, SubprocessHandle } from '@deepseek-ai/dsh-subprocess'
import path from 'node:path'
import { dllName, safeLocalPath } from './pe.js'

export type Runner = (argv: readonly string[], signal?: AbortSignal) => Promise<string>
export type ProcessService = Pick<SubprocessRuntime, 'spawn'>
export const OUTPUT_LIMIT = 256 * 1024
/** Only fixed argument arrays reach the service; no shell, no spill files. */
export async function runBounded(service: ProcessService, argv: readonly string[], cwd: string, signal?: AbortSignal, timeoutMs = 5000, maxBytes = OUTPUT_LIMIT): Promise<string> {
  signal?.throwIfAborted()
  const abort = new AbortController()
  let child: SubprocessHandle | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let poll: ReturnType<typeof setInterval> | undefined
  let cancel!: () => void
  const stopped = new Promise<never>((_, reject) => {
    const stop = (message: string) => { abort.abort(); child?.terminate(); reject(new Error(message)) }
    cancel = () => stop('已取消。')
    timer = setTimeout(() => stop('子进程超时。'), timeoutMs)
    signal?.addEventListener('abort', cancel, { once: true })
    poll = setInterval(() => {
      if (child && [child.collected.stdout, child.collected.stderr].some(r => {
        const v = r?.readFrom(0)
        return v && (v.lossy || v.nextOffset > maxBytes || Buffer.byteLength(v.text) > maxBytes)
      })) stop('子进程输出超过上限。')
    }, 10)
  })
  try {
    child = service.spawn({ argv, cwd, signal: abort.signal, graceMs: 200,
      stdio: { stdin: 'ignore', stdout: { maxBytes }, stderr: { maxBytes } } })
    const outcome = await Promise.race([child.done, stopped])
    const stdout = child.collected.stdout?.readFrom(0), stderr = child.collected.stderr?.readFrom(0)
    if ([stdout, stderr].some(v => v && (v.lossy || v.nextOffset > maxBytes || Buffer.byteLength(v.text) > maxBytes))) throw new Error('子进程输出超过上限。')
    if (outcome.exitCode !== 0) throw new Error('子进程读取失败。')
    return stdout?.text ?? ''
  } finally {
    clearTimeout(timer); clearInterval(poll)
    signal?.removeEventListener('abort', cancel)
    abort.abort(); child?.terminate()
  }
}
export const FALLBACK_KNOWN = ['ntdll.dll', 'kernel32.dll', 'kernelbase.dll', 'user32.dll', 'gdi32.dll', 'gdi32full.dll', 'advapi32.dll', 'sechost.dll', 'rpcrt4.dll', 'ole32.dll', 'oleaut32.dll', 'combase.dll', 'msvcrt.dll', 'ws2_32.dll', 'shell32.dll', 'shlwapi.dll', 'imm32.dll', 'normaliz.dll', 'psapi.dll', 'win32u.dll']
export function parseKnownDLLs(text: string): Set<string> {
  if (Buffer.byteLength(text) > OUTPUT_LIMIT) throw new Error('KnownDLLs 输出过大。')
  const names = new Set<string>()
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*\S+\s+REG_(?:SZ|EXPAND_SZ)\s+(.+?)\s*$/i)
    if (match && /\.dll$/i.test(match[1]) && dllName(match[1])) names.add(match[1].toLowerCase())
  }
  if (!names.size) throw new Error('KnownDLLs 输出为空或无效。')
  return names
}
export interface KnownDLLs { names: Set<string>; source: 'registry' | 'fallback' }
export async function knownDLLs(run: Runner, windows: string, signal?: AbortSignal): Promise<KnownDLLs> {
  try {
    const text = await run([path.join(windows, 'System32', 'reg.exe'), 'query', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\KnownDLLs'], signal)
    return { names: parseKnownDLLs(text), source: 'registry' }
  } catch (error) {
    signal?.throwIfAborted()
    return { names: new Set(FALLBACK_KNOWN), source: 'fallback' }
  }
}
/** Dependencies -json -imports emits { Imports: [{ Name, ImportList: [...] }] }. */
export function parseDependencies(text: string): string[] {
  if (Buffer.byteLength(text) > OUTPUT_LIMIT) throw new Error('Dependencies 输出过大。')
  const value: unknown = JSON.parse(text.replace(/^\uFEFF/, ''))
  if (!value || typeof value !== 'object' || !('Imports' in value) || !Array.isArray(value.Imports) || value.Imports.length > 512) throw new Error('Dependencies 输出格式无效。')
  return value.Imports.map((item: unknown) => {
    if (!item || typeof item !== 'object' || !('Name' in item) || typeof item.Name !== 'string' || !dllName(item.Name)) throw new Error('Dependencies 导入名称无效。')
    return item.Name
  })
}
export async function supplement(run: Runner, executable: string, file: string, signal?: AbortSignal): Promise<string[]> {
  safeLocalPath(executable)
  if (!path.isAbsolute(executable) || path.basename(executable).toLowerCase() !== 'dependencies.exe') throw new Error('请配置 Dependencies.exe 的绝对路径。')
  // Reject redirects to UNC/device locations before launching the explicitly trusted helper.
  const { realpath, stat } = await import('node:fs/promises')
  safeLocalPath(await realpath(executable))
  if (!(await stat(executable)).isFile()) throw new Error('Dependencies 路径不是文件。')
  return parseDependencies(await run([executable, '-json', '-imports', file], signal))
}
