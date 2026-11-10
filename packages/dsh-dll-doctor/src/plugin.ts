import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-working-directory'
import type {} from '@deepseek-ai/dsh-subprocess'
import { analyze, render } from './core.js'
import { runBounded } from './process.js'

export const name = 'dll-doctor'
export const inject = ['commands', 'workingDirectory', 'subprocess']
export const Config = z.object({ dependenciesExe: z.string().default('').description('可选：可信的 Dependencies.exe CLI 绝对路径；留空禁用，不下载。') })
export interface Settings { dependenciesExe?: string }
export function parseInput(input: string): { file: string; depth: number } {
  if (input.length > 4096) throw new Error('参数过长。')
  const match = input.match(/^\s*(?:"([^"\r\n]+)"|'([^'\r\n]+)'|([^\s"']+))(?:\s+--depth\s+([1-3]))?\s*$/)
  if (!match) throw new Error('用法：/dll-check "EXE或DLL路径" [--depth 1–3]（含空格的路径请加引号）')
  return { file: match[1] || match[2] || match[3], depth: Number(match[4] || 1) }
}
export function apply(ctx: Context, settings: Settings = {}): void {
  const lifetime = new AbortController()
  let busy = false
  ctx.effect(() => () => lifetime.abort())
  ctx.effect(() => ctx.commands.register({
    definitionId: CommandDefinitionId('dsh-dll-doctor'), name: 'dll-check',
    description: '只读诊断 Windows EXE/DLL 的静态 DLL 依赖与架构',
    input: { hint: '"C:\\path\\app.exe" [--depth 1–3]' }, recordInput: false,
    handler: async invocation => {
      if (process.platform !== 'win32') return { kind: 'error', text: '暂不支持（仅 Windows）。' }
      if (busy) return { kind: 'error', text: '已有 DLL 诊断正在运行，请等待完成或取消。' }
      busy = true
      try {
        const { file, depth } = parseInput(invocation.rawInput)
        const cwd = ctx.workingDirectory.get(invocation.agent.session)
        const signal = AbortSignal.any([invocation.signal, lifetime.signal])
        const report = await analyze(file, { cwd, depth, signal, dependenciesExe: settings.dependenciesExe,
          run: (argv, cancel) => runBounded(ctx.subprocess, argv, cwd, cancel),
        })
        return { kind: 'success', text: render(report) }
      } catch (error) {
        const message = error instanceof Error ? error.message : ''
        const expected = /^(用法|参数|拒绝|请选择|暂不支持|已取消|PE 格式无效|目标不是|文件超过|文件读取中|达到|depth)/.test(message)
        return { kind: 'error', text: invocation.signal.aborted || lifetime.signal.aborted ? 'DLL 诊断已取消。' : expected ? message : '无法读取或分析目标文件，请检查路径、文件类型和读取权限。' }
      } finally { busy = false }
    },
  }))
}
