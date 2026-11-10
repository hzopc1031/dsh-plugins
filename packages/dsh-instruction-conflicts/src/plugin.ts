import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-session-query'
import type {} from '@deepseek-ai/dsh-fs'
import { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import { observeMessages, type AssemblyEvidence } from './adapter.js'
import { inventory } from './inventory.js'
import { buildReport, renderReport } from './core.js'
export const name = 'instruction-conflicts'
export const inject = ['commands', 'sessionQuery']
export const Config = z.object({})
export const HELP = '/instruction-conflicts [history|json|history-json]\n无参数：当前正文与疑似冲突摘要（有限显示）；history：完整历史正文和明确标记的历史对照；json/history-json：返回完整结构。\n读取当前会话，不发起模型请求，不修改指令文件。'
export function apply(ctx: Context): void {
  const evidence = new WeakMap<object, AssemblyEvidence[]>()
  const cache = new WeakMap<object, { events: readonly unknown[]; assemblies: unknown; messages: ReturnType<typeof observeMessages> }>()
  // Observe the official waterfall without assembling an extra prompt or changing its result.
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const result = await next()
    if (context.scope) {
      try {
        const snapshot: AssemblyEvidence = { prompt: renderPrompt(result), sections: result.sections.map(s => ({ name: s.name, text: renderPrompt({ ...result, sections: [s] }) })) }
        const recent = evidence.get(context.scope) ?? []
        evidence.set(context.scope, [...recent.filter(s => s.prompt !== snapshot.prompt), snapshot].slice(-4))
      } catch { /* Assembly failure is owned by the host. Never turn a candidate into injection evidence. */ }
    }
    return result
  }, { prepend: true })
  const inspect = async (agent: Agent, signal: AbortSignal, history: boolean) => {
    const observation = await ctx.sessionQuery.observeSession(agent.session.id, { signal, projectionMode: 'none' })
    try {
      signal.throwIfAborted()
      const events = observation.events
      const assemblies = evidence.get(agent)
      // Command audit rows do not participate in rc.5 surface folding. Keep all
      // other events, including projection/replacement records, as invalidators.
      const relevant = events.filter(e => e.type !== 'command/run' && e.type !== 'command/done')
      const prior = cache.get(agent.session)
      const same = prior && prior.assemblies === assemblies && prior.events.length === relevant.length && prior.events.every((e, i) => e === relevant[i])
      const messages = same ? prior.messages : observeMessages(events, assemblies ?? [])
      if (!same) cache.set(agent.session, { events: relevant, assemblies, messages })
      // A cwd move makes old relative file-to-disk mappings uncertain. Do not guess.
      const moved = events.some(e => String(e.type) === 'working-directory/change')
      const metadata = await inventory(ctx.get('fs'), moved ? undefined : observation.header.cwd, messages, signal)
      const report = buildReport(messages, metadata.files, history, observation.cursor)
      report.notices.push(...metadata.notices)
      if (moved) report.notices.push('会话存在工作目录变更；历史项目指令的当前磁盘位置不作猜测。')
      report.notices.push('system-prompt/assemble 仅提供候选来源名称；只在候选完整渲染与已入日志 system 正文逐字相等时标注。重启后未观察的来源保留为 system-prompt 整段。')
      return report
    } finally { observation[Symbol.dispose]() }
  }
  ctx.effect(() => ctx.commands.register({
    definitionId: CommandDefinitionId('dsh-instruction-conflicts'), name: 'instruction-conflicts',
    description: '解释规则正文疑似冲突、注入历史版本及当前上下文保留状态', recordInput: false,
    input: { hint: 'history | json | history-json | help' },
    handler: async ({ agent, rawInput, signal }) => {
      const arg = rawInput.trim()
      if (arg === 'help') return { kind: 'success', text: HELP }
      if (!['','history','json','history-json'].includes(arg)) return { kind: 'error', text: HELP }
      try {
        signal.throwIfAborted()
        const history = arg.startsWith('history')
        const report = await inspect(agent, signal, history)
        return { kind: 'success', text: arg.endsWith('json') ? JSON.stringify(report, null, 2) : renderReport(report, history, !history) }
      } catch {
        return { kind: 'error', text: signal.aborted ? '读取已取消。' : '无法验证会话上下文，请检查 Session Query 与会话格式；未将读取失败当成规则不存在。' }
      }
    },
  }))
}

