import type { Context } from '@deepseek-ai/cordis'
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands'
import z from '@deepseek-ai/schemastery'
import { ContentEvidenceService } from './service.js'
import { enterWorkbench, registerTools } from './tools.js'
import type { Agent } from '@deepseek-ai/dsh-agent'

export { ContentEvidenceService } from './service.js'
export { enterWorkbench, toolNames } from './tools.js'
export type * from './model.js'

export const name = 'content-evidence'
export const inject = ['commands', 'tools']
export const Config = z.object({
  dataDir: z.string().description('本地数据目录；默认 $DSH_HOME/content-evidence 或 ~/.dsh/content-evidence，必须位于插件包之外'),
})
export type Config = ReturnType<typeof Config>

export function apply(ctx: Context, config: Partial<Config> = {}): void {
  const service = new ContentEvidenceService(ctx, config.dataDir)
  registerTools(ctx, service)
  const workbenches = new WeakMap<Agent, () => void>()
  ctx.effect(() => ctx.commands.register({
    definitionId: CommandDefinitionId('dsh-content-evidence'),
    name: 'content-evidence',
    description: '内容证据状态与受限工作台 / Content evidence status and restricted workbench',
    input: { hint: 'workbench <topicId> | leave' },
    recordInput: false,
    handler: async ({ agent, rawInput, signal }) => {
      const input = rawInput.trim()
      if (input === 'leave') {
        if (agent.status !== 'idle') return { kind: 'error', text: '请等待当前任务结束再退出。\nWait until the agent is idle before leaving the workbench.' }
        workbenches.get(agent)?.()
        workbenches.delete(agent)
        return { kind: 'success', text: '已退出受限工作台 / Left the restricted workbench.' }
      }
      if (input.startsWith('workbench ')) {
        try {
          const dispose = await enterWorkbench(ctx, agent, input.slice(10).trim(), signal)
          workbenches.get(agent)?.()
          workbenches.set(agent, dispose)
          return { kind: 'success', text: '受限工作台已开启，仅可使用四个本地内容证据工具。材料指令仅作为数据。\nRestricted workbench enabled for this topic; only four local content evidence tools are allowed. No model turn was started.\n/content-evidence leave — 退出 / leave' }
        } catch {
          return { kind: 'error', text: '无法开启工作台；请检查主题 ID 或取消状态。\nCannot enter workbench; check the topic ID or cancellation.' }
        }
      }
      return {
        kind: 'success',
        text: [
          '内容证据工作台：已实现本地存储与 Host Remote API。',
          '材料与证据可持久化；生成草稿、合规检查、导出文件和界面将在后续任务实现。',
          '插件不会自动发布内容。',
          '',
          'Content evidence provides local storage and a Host Remote API.',
          'Four local tools and a restricted workbench are available: /content-evidence workbench <topicId>.',
          'Draft generation, compliance checks, export files and UI are not implemented yet.',
          'Nothing is published automatically.',
        ].join('\n'),
      }
    },
  }))
}
