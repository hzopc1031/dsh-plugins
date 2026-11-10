import type { Context } from '@deepseek-ai/cordis'
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands'
import z from '@deepseek-ai/schemastery'
import { ContentEvidenceService } from './service.js'

export { ContentEvidenceService } from './service.js'
export type * from './model.js'

export const name = 'content-evidence'
export const inject = ['commands']
export const Config = z.object({
  dataDir: z.string().description('本地数据目录；默认 $DSH_HOME/content-evidence 或 ~/.dsh/content-evidence，必须位于插件包之外'),
})
export type Config = ReturnType<typeof Config>

export function apply(ctx: Context, config: Partial<Config> = {}): void {
  new ContentEvidenceService(ctx, config.dataDir)
  ctx.effect(() => ctx.commands.register({
    definitionId: CommandDefinitionId('dsh-content-evidence'),
    name: 'content-evidence',
    description: '查看内容证据工作台的开发状态 / Show content evidence development status',
    recordInput: false,
    handler: () => ({
      kind: 'success',
      text: [
        '内容证据工作台：已实现本地存储与 Host Remote API。',
        '材料与证据可持久化；生成草稿、合规检查、导出文件和界面将在后续任务实现。',
        '插件不会自动发布内容。',
        '',
        'Content evidence provides local storage and a Host Remote API.',
        'Draft generation, compliance checks, export files and UI are not implemented yet.',
        'Nothing is published automatically.',
      ].join('\n'),
    }),
  }))
}
