import type { Context } from '@deepseek-ai/cordis'
import path from 'node:path'
import z from '@deepseek-ai/schemastery'
import { appendPluginRecord, type Session } from '@deepseek-ai/dsh-session'
import { CommandDefinitionId, type CommandResult } from '@deepseek-ai/dsh-commands'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ToolExecutionToken } from '@deepseek-ai/dsh-tools'
import type { WorkspaceChanges } from '@deepseek-ai/dsh-workspace-changes'
import { archive, argumentSummary, defaults, eligible, pathsFrom, render, reportDirectory, text, type Call, type Change, type Settings } from './core.js'
import { mark, segment } from './state.js'

export const name = 'task-review'
export const inject = ['tools', 'commands', 'sessions']
export const Config = z.object({
  auto: z.boolean().default(true).description('工作停止时自动复盘'),
  toolThreshold: z.number().min(1).step(1).default(10),
  fileThreshold: z.number().min(1).step(1).default(3),
  durationMinutes: z.number().min(0.001).default(10),
  reportDir: z.string().default('.dsh/reports').description('相对项目目录，或绝对路径（例如 DSH_HOME 下）'),
})
/** Only known file-tool domain results establish a mutation, never tool-name guesses. */
export function fileChanges(name: string, value: unknown): Change[] {
  if (!['write', 'edit', 'str_replace_editor'].includes(name) || !value || typeof value !== 'object') return []
  const v = value as Record<string, unknown>
  if (typeof v.path !== 'string') return []
  if ('before' in v && 'after' in v && typeof v.after === 'string') return [{ path: text(v.path, 500), kind: v.before === null ? '新建' : '修改' }]
  return []
}
export function apply(ctx: Context, input: Partial<Settings> = {}): void {
  const config = { ...defaults, ...input }
  for (const n of [config.toolThreshold, config.fileThreshold]) if (!Number.isSafeInteger(n) || n < 1) throw new Error('门槛必须为正整数')
  if (!Number.isFinite(config.durationMinutes) || config.durationMinutes <= 0 || !config.reportDir.trim()) throw new Error('耗时或目录配置无效')
  const starts = new WeakMap<ToolExecutionToken, number>()
  const queues = new Map<Session, Promise<unknown>>()
  const automatic = new Map<Session, Promise<unknown>>()
  let workspace: WorkspaceChanges | undefined
  ctx.inject(['workspaceChanges'], child => {
    workspace = child.workspaceChanges
    child.effect(() => () => { workspace = undefined })
  })
  const snapshot = async (session: Session) => {
    const s = segment(session)
    const normalize = (file: string) => session.header.cwd ? path.relative(session.header.cwd, path.resolve(session.header.cwd, file)).split(path.sep).join('/') : path.normalize(file)
    if (s) s.changes = s.changes.map(f => ({ ...f, path: normalize(f.path) }))
    if (s && workspace) for (const e of session.snapshotEvents()) {
      if (e.seq < s.from || e.seq >= s.to || e.type !== 'workspace/changes') continue
      const host = workspace.summary(session.id, e.seq)
      for (const [index, f] of (host?.files ?? []).entries()) {
        let kind: Change['kind'] = '变更（类型不可用）'
        try {
          const diff = await workspace.diff(session.id, e.seq, index, new AbortController().signal)
          if (diff?.kind === 'text') kind = !diff.before ? '新建' : !diff.after ? '删除' : '修改'
        } catch { /* Missing comparisons do not invalidate the observed changed-file list. */ }
        const item = { path: normalize(text(f.path, 500)), kind }
        const existing = s.changes.findIndex(c => c.path === item.path)
        if (existing < 0) s.changes.push(item)
        else if (kind !== '变更（类型不可用）') s.changes[existing] = item
      }
    }
    if (s) s.changes = [...new Map(s.changes.map(f => [process.platform === 'win32' ? f.path.toLowerCase() : f.path, f])).values()]
    return s
  }
  let disposed = false
  const schedule = <T>(session: Session, fn: () => Promise<T>): Promise<T> => {
    const previous = queues.get(session) ?? Promise.resolve()
    const operation = previous.catch(() => {}).then(fn)
    queues.set(session, operation)
    const retire = () => { if (queues.get(session) === operation) queues.delete(session) }
    operation.then(retire, retire)
    return operation
  }
  ctx.on('tools/pre-execute', async (exec, next) => { starts.set(exec.token, Date.now()); return next() }, { prepend: true })
  ctx.on('tools/result', (exec, result) => {
    const session = exec.agent?.session
    if (!session || disposed) return
    const now = Date.now(), started = starts.get(exec.token)
    const call: Call = { id: exec.callId, name: text(exec.name), args: argumentSummary(exec.arguments), paths: pathsFrom(exec.arguments), started: started ?? now, duration: started === undefined ? null : Math.max(0, now - started), status: result.isError ? 'failure' : 'success', changes: result.isError ? [] : fileChanges(exec.name, result.value) }
    appendPluginRecord(session, 'plugin:task-review/call', call)
    return undefined
  })
  const review = (agent: Agent): Promise<CommandResult> => schedule(agent.session, async () => {
    if (disposed) return { kind: 'error', text: '复盘插件已停止。' }
    const s = await snapshot(agent.session)
    if (!s) return { kind: 'success', text: '没有尚未复盘的新内容。' }
    const markdown = render(s)
    try {
      const file = await archive(reportDirectory(agent.session.header.cwd, config.reportDir), s.goal || agent.id, s.ended, markdown)
      mark(agent.session, s.to, file)
      return { kind: 'success', text: `任务复盘：${s.calls.length} 次调用 / ${s.changes.length} 项变更 / ${s.calls.filter(c => c.status === 'failure').length} 次失败\n\n${markdown}\n存档：${text(file, 1000)}` }
    } catch {
      // Error strings may include OS paths or credentials; do not copy them into the log.
      return { kind: 'error', text: '报告存档失败，复盘边界未推进。请检查 reportDir 权限并重试 /review。' }
    }
  })
  ctx.effect(() => ctx.commands.register({ definitionId: CommandDefinitionId('dsh-task-review'), name: 'review', description: '生成本段任务复盘并存档 Markdown', recordInput: false, handler: invocation => invocation.rawInput.trim() ? { kind: 'error', text: '用法：/review（无参数）' } : review(invocation.agent) }))
  ctx.on('agent/status', ({ agent, status }) => {
    if (status !== 'idle' || !config.auto || disposed || automatic.has(agent.session)) return
    // The status event may still be publishing; defer command lifecycle appends.
    const job = Promise.resolve().then(async () => {
      const s = await snapshot(agent.session)
      if (!s || !eligible(s, config) || disposed || agent.status !== 'idle') return
      await ctx.commands.execute(agent, '/review', [], new AbortController().signal)
    }).catch(() => { ctx.logger.warn('自动复盘失败；可用 /review 重试') }).finally(() => {
      automatic.delete(agent.session)
    })
    automatic.set(agent.session, job)
  })
  ctx.on('session/flush', async session => { await automatic.get(session); await queues.get(session) })
  ctx.effect(() => async () => { disposed = true; await Promise.allSettled([...automatic.values(), ...queues.values()]) })
}
