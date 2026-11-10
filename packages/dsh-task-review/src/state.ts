import { appendPluginRecord, pluginRecordOf, type Session, type SessionEvent } from '@deepseek-ai/dsh-session'
import { argumentSummary, defaults, pathsFrom, text, type Call, type Change, type Segment } from './core.js'
import { callStatus } from './bash.js'

export interface Boundary { version: 1; to: number; file: string }
declare module '@deepseek-ai/dsh-session/types' {
  interface PluginRecordMap {
    'plugin:task-review/call': Call
    'plugin:task-review/boundary': Boundary
  }
}
function isCall(value: unknown): value is Call {
  if (!value || typeof value !== 'object') return false
  const c = value as Partial<Call>
  return typeof c.id === 'string' && typeof c.name === 'string' && typeof c.args === 'string' && Array.isArray(c.paths) && c.paths.every(p => typeof p === 'string') && typeof c.started === 'number' && (c.duration === null || typeof c.duration === 'number') && ['success', 'failure', 'pending', 'unknown'].includes(c.status ?? '') && Array.isArray(c.changes) && c.changes.every(f => typeof f?.path === 'string' && ['新建', '修改', '删除', '变更（类型不可用）'].includes(f?.kind))
}
export function boundary(events: readonly SessionEvent[]): number {
  let to = 0
  for (const e of events) {
    const r = pluginRecordOf(e)
    if (r?.type !== 'plugin:task-review/boundary' || !r.data || typeof r.data !== 'object') continue
    const b = r.data as Partial<Boundary>
    if (b.version === 1 && Number.isSafeInteger(b.to) && b.to! >= 0 && b.to! <= e.seq) to = Math.max(to, b.to!)
  }
  return to
}
export function mark(session: Session, to: number, file: string): void {
  appendPluginRecord(session, 'plugin:task-review/boundary', { version: 1, to, file })
}
/** Read only the unreviewed suffix; inherited fork prefixes are excluded. */
export function segment(session: Session, now = Date.now()): Segment | null {
  const events = session.snapshotEvents(), from = Math.max(boundary(events), session.inheritedEventCount)
  const slice = events.filter(e => e.seq >= from)
  const meaningful = slice.filter(e => ['user/message', 'tool/call', 'tool/ptc-dispatch-start', 'assistant/message', 'assistant/attempt'].includes(e.type) || pluginRecordOf(e)?.type === 'plugin:task-review/call')
  if (!meaningful.length) return null
  const calls: Call[] = [], changes: Change[] = []
  for (const e of slice) {
    const record = pluginRecordOf(e)
    if (record?.type === 'plugin:task-review/call' && isCall(record.data)) { calls.push(record.data); changes.push(...record.data.changes) }
  }
  // Tool-call evidence without a final observed result remains visibly unfinished.
  for (const e of slice) if (e.type === 'tool/call' || e.type === 'tool/ptc-dispatch-start') {
    const id = e.type === 'tool/call' ? e.data.callId : e.data.subCallId
    if (calls.some(c => c.id === id)) continue
    let args: unknown = {}
    try { args = typeof e.data.arguments === 'string' ? JSON.parse(e.data.arguments) : e.data.arguments } catch { /* Invalid JSON is not copied. */ }
    const result = slice.find(r => r.seq > e.seq && (r.type === 'tool/result' && r.data.message.source.callId === id || r.type === 'tool/ptc-dispatch' && r.data.subCallId === id))
    const failed = result?.type === 'tool/result' ? result.data.message.isError : result?.type === 'tool/ptc-dispatch' ? result.data.isError : false
    calls.push({ id, name: text(e.data.name), args: argumentSummary(args), paths: pathsFrom(args), started: e.time, duration: null, status: result ? callStatus(e.data.name, {isError:failed}) : 'pending', changes: [] })
  }
  calls.sort((a, b) => a.started - b.started)
  const user = slice.find(e => e.type === 'user/message' && e.data.source.kind === 'user')
  const goal = user?.type === 'user/message' ? user.data.content.filter(b => b.type === 'text').map(b => b.type === 'text' ? b.text : '').join(' ') : ''
  const settlements = slice.filter(e => e.type === 'assistant/message')
  // Final authoritative usage only. Failed-attempt accounting is explicitly unavailable.
  const usageEvents = settlements.filter(e => e.type === 'assistant/message' && e.data.usage)
  const usage = usageEvents.length ? ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'totalTokens'].map(key => {
    const values = usageEvents.map(e => e.type === 'assistant/message' ? e.data.usage?.[key as keyof NonNullable<typeof e.data.usage>] : undefined)
    return `${key}=${values.every(v => v !== undefined) ? values.reduce<number>((a, v) => a + (v ?? 0), 0) : '不可用'}`
  }).join(', ') + `（仅 ${usageEvents.length}/${settlements.length} 条最终消息；失败尝试用量不可用）` : '不可用'
  const end = slice.findLast(e => e.type === 'turn/end')
  return { goal: text(goal), calls, changes: [...new Map(changes.map(f => [f.path, f])).values()], started: meaningful[0].time, ended: now, usage, outcome: end?.type === 'turn/end' ? `最后一轮状态 ${end.data.reason.kind}` : '本段尚无轮次结束证据', from, to: events.length }
}
export { defaults }
