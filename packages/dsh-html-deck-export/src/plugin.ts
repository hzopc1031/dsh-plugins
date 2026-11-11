import { realpath, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands'
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'
import { captureDeck } from './adapters.js'
import { exportCapturedDeck } from './export.js'
import { confinedPath, isWithinRoot } from './paths.js'

export const name = 'html-deck-export'
export const inject = ['commands', 'tools']
export const Config = z.object({})
const TOOL = 'html_deck_export'
const HELP = [
  'HTML Deck Export — local image-based 16:9 PPTX / 本地图片版 PPTX',
  '/html-deck-export start — enter an export-only workbench in this conversation, rooted at the current project directory.',
  '/html-deck-export stop — cancel active exports and restore this conversation’s tools.',
  '先 start 进入当前项目的导出工作台；stop 取消导出并恢复本会话工具。无参数仅显示帮助。',
  'Use DSH native tool mode; the export workbench denies code-execution transports / 请使用原生工具模式。',
  'Ask DSH to call html_deck_export with inputPath and an existing exportDirectory; fileName defaults to deck.pptx.',
  'Supported: 歸藏 preview, #/N hash, ?slide=N query, fixed canvas, and section.slide decks. Other HTML is refused.',
  '支持歸藏预览、hash/query 翻页、固定画布和 section.slide；不支持的 HTML 会被拒绝。',
  'PPTX + export-report.json + export-report.md are written inside the selected project directory; failed pages retain evidence and preserve an earlier PPTX.',
  '输入、素材与输出限于当前项目目录，输出目录须已存在；失败报告保留逐页证据，原有 PPTX 不被失败导出覆盖。',
  'Network is blocked by default; only explicit allowNetwork:true permits remote assets. scale:1|2, format:png|jpeg, quality:1..100 (jpeg only).',
  '默认禁止联网；仅 allowNetwork:true 可加载远程素材。中文报告列出字体回退、失败页原因和截图证据路径。',
  'HTML remains the source of truth. No deck generation, editable shapes, or preserved animations. Nothing is uploaded automatically.',
  'HTML 始终是源文件；不生成演示稿、不输出可编辑形状、不保留动画，也不会自动上传。',
].join('\n')

export function apply(ctx: Context): void {
  const workbenches = new Map<Agent, { root: string; controller: AbortController; dispose(): void }>()
  const stop = (agent: Agent) => {
    const workbench = workbenches.get(agent)
    workbenches.delete(agent)
    workbench?.controller.abort(new Error('HTML deck export workbench closed'))
    workbench?.dispose()
  }
  ctx.on('agent/disposed', ({ agent }) => stop(agent))
  ctx.effect(() => () => { for (const agent of workbenches.keys()) stop(agent) })
  ctx.effect(() => ctx.tools.guard(exec => exec.name === TOOL && (!exec.agent || !workbenches.has(exec.agent))
    ? 'Enter the project export workbench with /html-deck-export start first' : undefined))

  ctx.effect(() => ctx.commands.register({
    definitionId: CommandDefinitionId('dsh-html-deck-export'),
    name,
    description: 'HTML deck image-PPTX export help and workbench / HTML 图片版 PPTX 导出工作台',
    input: { hint: 'start | stop' },
    recordInput: false,
    handler: async ({ agent, rawInput, signal }) => {
      try {
        signal.throwIfAborted()
        const action = rawInput.trim()
        if (!action || action === 'help') return { kind: 'success', text: HELP }
        if (action === 'stop') {
          stop(agent)
          return { kind: 'success', text: 'Export workbench closed / 导出工作台已关闭。' }
        }
        if (action !== 'start') return { kind: 'error', text: HELP }
        const directory = ctx.get('workingDirectory') as { get(session: Agent['session']): string } | undefined
        const cwd = directory ? directory.get(agent.session) : agent.session.header.cwd
        if (!cwd) throw new Error('Select a local project directory before starting / 请先选择本地项目目录')
        const root = await realpath(cwd)
        if (!(await stat(root)).isDirectory()) throw new Error('Project root must be an existing directory')
        signal.throwIfAborted()
        if (workbenches.has(agent)) return { kind: 'success', text: 'Export workbench root: ' + workbenches.get(agent)!.root }
        // Scope this mask to the requesting agent; the plugin root would mask every conversation.
        const unrestrict = agent.ctx.tools.restrict({ allow: [TOOL] })
        let unguard: () => void
        try {
          unguard = agent.ctx.tools.guard(exec => exec.name !== TOOL ? 'Export workbench permits only ' + TOOL : undefined)
        } catch (error) { unrestrict(); throw error }
        workbenches.set(agent, { root, controller: new AbortController(), dispose() { unguard(); unrestrict() } })
        return { kind: 'success', text: 'Export-only workbench root / 导出工作台根目录: ' + root + '\n' + HELP }
      } catch (error) {
        return { kind: 'error', text: signal.aborted ? 'Operation cancelled / 操作已取消。' : (error as Error).message }
      }
    },
  }))

  ctx.effect(() => ctx.tools.register(defineTool({
    name: TOOL,
    description: 'Export a finished trusted local HTML deck to image-based 16:9 PPTX, notes, export-report.json and Chinese export-report.md. Requires /html-deck-export start. All paths/assets stay within that project root. No generation or uploads. Network blocked unless allowNetwork:true. Inspect report warnings/failures.',
    parameters: {
      inputPath: { type: 'string', required: true, description: 'Local HTML file or directory with index.html, relative to the workbench root or absolute within it.' },
      exportDirectory: { type: 'string', required: true, description: 'Existing directory within the workbench root, outside the installed plugin package. Use one directory per job.' },
      fileName: { type: 'string', description: 'Plain .pptx filename; default deck.pptx. No directory components.' },
      scale: { type: 'integer', enum: [1, 2], description: 'Pixel density; default 2 at 1920×1080 viewport.' },
      format: { type: 'string', enum: ['png', 'jpeg'], description: 'Default png; jpeg can reduce output size.' },
      quality: { type: 'integer', description: 'JPEG only: integer 1..100.' },
      allowNetwork: { type: 'boolean', description: 'Default false. Explicit true permits remote HTTP(S) assets; recorded in report.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: String(value.summary) }],
    },
    async execute(args, exec) {
      const workbench = exec.agent && workbenches.get(exec.agent)
      if (!workbench) throw new Error('Enter the project export workbench with /html-deck-export start first')
      for (const key of Object.keys(args)) {
        if (!['inputPath', 'exportDirectory', 'fileName', 'scale', 'format', 'quality', 'allowNetwork'].includes(key)) {
          throw new Error('Unsupported export argument: ' + key)
        }
      }
      const signal = AbortSignal.any([exec.signal, workbench.controller.signal])
      signal.throwIfAborted()
      const input = await confinedPath(workbench.root, args.inputPath)
      const output = await confinedPath(workbench.root, args.exportDirectory)
      if (!(await stat(output)).isDirectory()) throw new Error('Export directory must be an existing directory')
      const packageRoot = await realpath(fileURLToPath(new URL('../', import.meta.url)))
      // The package is replaceable on upgrade; reports belong to the user's project.
      if (isWithinRoot(packageRoot, output)) {
        throw new Error('Export reports must be stored outside the installed plugin package')
      }
      const capture = await captureDeck(input, {
        resourceRoot: workbench.root, scale: args.scale, format: args.format,
        quality: args.quality, allowNetwork: args.allowNetwork ?? false, signal,
      })
      return JSON.parse(JSON.stringify(await exportCapturedDeck(capture, output, { fileName: args.fileName, signal })))
    },
  })))
}
