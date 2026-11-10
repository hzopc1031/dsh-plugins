import type { Context } from '@deepseek-ai/cordis'
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands'
import z from '@deepseek-ai/schemastery'

export const name = 'html-deck-export'
export const inject = ['commands']
export const Config = z.object({})

const HELP = [
  'HTML Deck Export — local API / 本地 API',
  'The local export API is available; the DSH export tool is not connected yet. This command only displays help.',
  '已提供本地导出 API，DSH 导出工具尚未接入；此命令仅显示帮助。',
  'Export a finished local HTML deck in a supported format to an image-based 16:9 PPTX, with speaker notes and a per-page export report.',
  '将受支持格式的本地定稿 HTML 演示稿导出为 16:9 图片版 PPTX，附讲稿备注和逐页导出报告。',
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
