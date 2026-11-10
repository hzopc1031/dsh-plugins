import type { Context } from '@deepseek-ai/cordis'
import { CommandDefinitionId, type CommandInvocation, type CommandResult } from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-working-directory'
import type {} from '@deepseek-ai/dsh-subprocess'
import { validateProjectFile } from './paths.js'
import { queryHolders, type Observation } from './query.js'

export const name = 'file-holder'
export const inject = ['commands', 'workingDirectory', 'subprocess']

export function formatObservation(result: Observation, file: string): string {
  const rows = result.processes.length
    ? result.processes.map(row => row.name + ' | PID ' + row.pid + ' | 应用类型 ' + row.applicationType +
      (row.serviceName ? ' | 服务 ' + row.serviceName : '')).join('\n')
    : '未查到占用进程'
  return ['文件：' + file, '观察时间：' + result.observedAt, rows,
    '重新检查：再次执行 /file-holder "' + file + '"',
    '结果仅代表本次观察，可能遗漏进程，不能据此保证文件可写。'].join('\n')
}

export function apply(ctx: Context): void {
  const lifetime = new AbortController()
  ctx.effect(() => () => lifetime.abort())
  ctx.effect(() => ctx.commands.register({
    definitionId: CommandDefinitionId('dsh-file-holder'),
    name: 'file-holder', description: '查询项目内指定文件的占用程序（Windows）',
    input: { hint: '<项目内文件>' }, recordInput: false,
    handler: async ({ agent, rawInput, signal }: CommandInvocation): Promise<CommandResult> => {
      if (process.platform !== 'win32') return { kind: 'error', text: '暂不支持（仅 Windows）' }
      const combined = AbortSignal.any([signal, lifetime.signal])
      try {
        combined.throwIfAborted()
        const target = await validateProjectFile(rawInput, ctx.workingDirectory.get(agent.session))
        combined.throwIfAborted()
        const result = await queryHolders(ctx.subprocess, target, { signal: combined })
        return { kind: 'success', text: formatObservation(result, target.file) }
      } catch (error: unknown) {
        return { kind: 'error', text: combined.aborted ? '查询已取消。' :
          error instanceof Error ? error.message : '查询失败。' }
      }
    },
  }))
}
