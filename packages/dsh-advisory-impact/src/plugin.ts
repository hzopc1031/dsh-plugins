import type { Context } from '@deepseek-ai/cordis'
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands'
import z from '@deepseek-ai/schemastery'

export const name = 'advisory-impact'
export const inject = ['commands']
export const Config = z.object({})

export const HELP = `官方公告影响核对（开发中：当前仅提供帮助命令与抓取库）
针对你填写的运行版本，在本地核对官方安全公告。
官方页面为判定依据；OSV 仅作第二来源，可能返回未收录（HTTP 404）。
官方 suppressions 单列为「扫描器报了，但官方说明不适用」。
默认关注 Kafka / Hadoop / Flink；没有默认运行版本，必须自行填写。
未填写运行版本，无法判断。
Flink 的 ASF 列表为实验性，说明覆盖 2023 年以来的公告，可能滞后官方 CVE 发布。
全过程无需模型调用或模型 API key，也不需要聊天轮次；这不是 lockfile 扫描器。
版本判定、OSV、缓存、报告与 DSH 原生面板将在后续任务接入。`

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.commands.register({
    definitionId: CommandDefinitionId('dsh-advisory-impact'),
    name,
    description: '官方公告影响核对：查看用途、来源与开发状态',
    recordInput: false,
    handler: () => ({ kind: 'success', text: HELP }),
  }))
  // Native UI hook: docs/dsh-api.md specifies main + sidebar.panellist; no chat/model dependency.
}
