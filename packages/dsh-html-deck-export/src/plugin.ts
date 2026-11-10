import type { Context } from '@deepseek-ai/cordis'
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands'
import z from '@deepseek-ai/schemastery'

export const name = 'html-deck-export'
export const inject = ['commands']
export const Config = z.object({})

const HELP = [
  'HTML Deck Export — scaffold / 脚手架',
  'Export is not implemented yet; this command only displays help.',
  '导出尚未实现；此命令仅显示帮助。',
  'Planned: export a finished local HTML deck in a supported format to an image-based 16:9 PPTX, with speaker notes and a per-page export report.',
  '计划：将受支持格式的本地定稿 HTML 演示稿导出为 16:9 图片版 PPTX，附讲稿备注和逐页导出报告。',
  'HTML remains the source of truth. No deck generation, editable shapes, or preserved animations. Nothing is uploaded automatically.',
  'HTML 始终是源文件；不生成演示稿、不输出可编辑形状、不保留动画，也不会自动上传。',
].join('\n')

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.commands.register({
    definitionId: CommandDefinitionId('dsh-html-deck-export'),
    name,
    description: 'HTML deck image-PPTX export help / HTML 演示稿图片版 PPTX 导出帮助',
    recordInput: false,
    handler: () => ({ kind: 'success', text: HELP }),
  }))
}
