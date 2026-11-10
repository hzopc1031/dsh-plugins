import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { ImpactStore } from './store.js'
import { ImpactError, fail, createPlan, renderScan, validId } from './core.js'

export function resolveDirectory(ctx: { get?(name: string): unknown }, session: { header: { cwd?: string } }): { path?: string; source: 'current' | 'fallback' | 'missing' } {
  const service = ctx.get?.('workingDirectory') as { get(session: unknown): string } | undefined
  if (service) {
    const path = service.get(session)
    return path ? { path, source: 'current' } : { source: 'missing' }
  }
  return session.header.cwd ? { path: session.header.cwd, source: 'fallback' } : { source: 'missing' }
}
export function directoryLine(info: { path?: string; source: string }): string {
  if (!info.path) return '没有可用的项目目录。'
  return info.source === 'current'
    ? '使用的根目录（当前执行目录，workingDirectory.get）：' + info.path
    : '使用的根目录（服务缺失，回退原始项目目录 header.cwd）：' + info.path
}

export const name = 'source-impact'
export const inject = ['commands', 'tools']
export const Config = z.object({})
export const HELP = [
  '资料更新影响分析：仅处理已登记的本地 .md / .csv 引用。',
  '/impact register <JSON> — 登记一条引用并保存初始基线（也可用会话头部「资料引用登记」表单）',
  '/impact list — 查看已登记的来源 → 引用 → 结论 → 产出位置',
  '/impact check [json] — 检查来源，列出三类可叠加状态及 scanId；json 为完整明细',
  '/impact plan <scanId> <id1,id2> — 仅为用户选中的引用生成可交给 DSH 的重查任务',
  '/impact accept <scanId> [id1,id2] — 重新核验后原子接受新基线并保留上一版；省略 id 时只接受已变化且可重新定位的引用',
  '/impact remove <id> — 移除引用；不删除来源及报告',
  '引用内容变化或无法定位需要人工复核，不代表结论错误；check / plan 不更新基线。accept 失败不会改写原登记。',
].join('\n')

function store(cwd: string | undefined): ImpactStore {
  if (!cwd) fail('当前会话没有项目目录，请先选择本地项目')
  return new ImpactStore(cwd)
}
export function apply(ctx: Context): void {
  const directoryOf = (session: { header: { cwd?: string } }) => resolveDirectory(ctx, session)

  ctx.effect(() => ctx.commands.register({
    definitionId: CommandDefinitionId('dsh-source-impact'),
    name: 'impact',
    description: '登记资料引用、检查更新影响、选择产出生成重查任务',
    input: { hint: 'register <JSON> | list | check | plan <scanId> <id1,id2> | accept <scanId> [id1,id2] | remove <id>' },
    recordInput: false,
    handler: async ({ agent, rawInput, signal }) => {
      try {
        signal.throwIfAborted()
        const input = rawInput.trim()
        if (!input || input === 'help') return { kind: 'success', text: HELP }
        const match = /^(\S+)(?:\s+([\s\S]*))?$/.exec(input)!
        const verb = match[1]!, arg = match[2]?.trim() ?? ''
        const location = directoryOf(agent.session)
        const footer = '\n' + directoryLine(location)
        const service = store(location.path)
        if (verb === 'register' && arg) {
          let value: unknown
          try { value = JSON.parse(arg) } catch { fail('register 参数必须是有效 JSON，示例见 README') }
          const registry = await service.add(value, signal)
          return { kind: 'success', text: '引用已登记；共 ' + registry.references.length + ' 条。来源和报告未被改写。' + footer }
        }
        if (verb === 'list' && !arg) {
          const registry = await service.load(signal)
          return { kind: 'success', text: JSON.stringify(registry.references.map(({ baseline: _baseline, ...r }) => r), null, 2) + footer }
        }
        if (verb === 'check' && (!arg || arg === 'json')) {
          const scan = await service.scan(signal)
          return { kind: 'success', text: (arg === 'json' ? JSON.stringify(scan, null, 2) : renderScan(scan)) + footer }
        }
        if (verb === 'plan') {
          const parts = arg.split(/\s+/)
          if (parts.length !== 2 || !/^[a-f0-9]{64}$/.test(parts[0]!)) fail('用法：/impact plan <check 返回的 scanId> <id1,id2>')
          const scan = await service.scan(signal)
          const plan = createPlan(scan, parts[1]!.split(','), parts[0]!)
          return { kind: 'success', text: '复制以下 JSON 到普通对话，要求 DSH 按 tasks 执行。此命令只生成清单，不启动任务。\n\n' + JSON.stringify(plan, null, 2) + footer }
        }
        if (verb === 'accept') {
          const parts = arg.split(/\s+/).filter(Boolean)
          if (!parts.length || !/^[a-f0-9]{64}$/.test(parts[0]!)) fail('用法：/impact accept <check 返回的 scanId> [id1,id2]')
          const ids = parts[1] ? parts[1].split(',').map(validId) : undefined
          if (parts.length > 2) fail('用法：/impact accept <scanId> [id1,id2]')
          const registry = await service.accept(parts[0]!, ids, signal)
          const accepted = registry.references.filter(r => r.previousBaseline?.acceptedFromScanId === parts[0]).map(r => r.id)
          return { kind: 'success', text: '已原子接受新基线并保留上一版：' + accepted.join(', ') + '。模型侧仍只读。' + footer }
        }
        if (verb === 'remove' && arg && !/\s/.test(arg)) {
          await service.remove(arg, signal)
          return { kind: 'success', text: '引用已移除；来源和产出文件未修改。' + footer }
        }
        return { kind: 'error', text: HELP }
      } catch (e) {
        return { kind: 'error', text: signal.aborted ? '操作已取消。' : e instanceof ImpactError ? e.message : '操作失败，请检查本地文件权限、文件格式或登记目录；没有改写报告。' }
      }
    },
  }))
  // The model-facing surface is deliberately read-only. Human selection lives in /impact plan.
  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'source_impact_check',
    description: '只读检查已登记 Markdown/CSV 来源变化。默认返回最多 20 条受影响状态摘要；details:true 返回完整引用、结论、产出及摘录 JSON。不得把变化视为结论错误。选择重查由用户通过 /impact plan 完成。',
    parameters: { details: { type: 'boolean', description: 'true 返回全部引用与摘录；默认仅返回最多 20 条状态摘要。' } },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args, exec) {
      const result = await store(exec.agent ? directoryOf(exec.agent.session).path : undefined).scan(exec.signal)
      if (args.details) return JSON.stringify(result)
      const affected = result.impacts.filter(i => i.statuses.length)
      return JSON.stringify({ scanId: result.scanId, total: result.impacts.length,
        affectedCount: affected.length,
        truncated: affected.length > 20,
        impacts: affected.slice(0, 20).map(i => ({ id: i.reference.id, source: i.reference.source, statuses: i.statuses, reason: i.reason,
          sourceVersionChanged: i.sourceVersionChanged, citationContentChanged: i.citationContentChanged, needsManualReview: i.needsManualReview })),
      })
    },
  })))
}
