/** Pure mapping from DSH session-log events to heartbeat activities. */
import { argumentsKey, clip, type Activity } from './core.js'
export interface Outcome { name: string; failure?: string }

/** Minimal structural view of a `SessionEvent` (see dsh-session `SessionEventMap`). */
export interface LogEvent {
  readonly type: string
  readonly data: unknown
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? v as Record<string, unknown> : {})
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function contentText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content.map(b => (obj(b).type === 'text' ? str(obj(b).text) : '')).join(' ')
}

/**
 * Translate one appended session event. `names` maps callId -> tool name and is
 * updated on `tool/call` so the matching `tool/result` can be attributed.
 * Returns undefined for events that are not heartbeat-relevant.
 */
export function activityOf(event: LogEvent, names: Map<string, string>, outcomes = new Map<string, Outcome>()): Activity | undefined {
  const d = obj(event.data)
  switch (event.type) {
    case 'step/start':
      return { kind: 'step' }
    case 'assistant/message':
      return { kind: 'model' }
    case 'tool/call':
    case 'tool/ptc-dispatch-start': {
      const callId = str(d.subCallId) || str(d.callId), name = str(d.name) || '未知工具'
      names.set(callId, name)
      return { kind: 'tool-call', callId, name, argsKey: argumentsKey(typeof d.arguments === 'string' ? d.arguments : JSON.stringify(d.arguments) ?? '') }
    }
    case 'tool/result':
    case 'tool/ptc-dispatch': {
      const message = event.type === 'tool/result' ? obj(d.message) : d
      const callId = str(message.toolCallId) || str(d.subCallId)
      const observed = outcomes.get(callId)
      outcomes.delete(callId)
      const name = names.get(callId) ?? observed?.name ?? (str(d.name) || '未知工具')
      names.delete(callId)
      const canonical = observed?.name === name ? observed.failure : undefined
      const isError = message.isError === true || canonical !== undefined
      if (!isError) return { kind: 'tool-result', callId, name, isError: false }
      const error = obj(d.error)
      const reason = canonical || str(error.reason) || contentText(message.content)
      const code = str(error.code) || str(error.name)
      // Key on code + the start of the message so "same error" survives varying timestamps at the end.
      return { kind: 'tool-result', callId, name, isError: true, errorKey: `${code}:${clip(reason, 80)}`, errorText: `${name}：${clip(reason || code || '失败')}` }
    }
    case 'llm/retry': {
      const failure = obj(d.failure)
      const code = str(failure.code), message = str(failure.message)
      const attempt = typeof d.retry === 'number' ? d.retry : 0
      return { kind: 'retry', attempt, errorKey: `${code}:${clip(message, 80)}`, errorText: `模型请求 ${code || '失败'}：${clip(message || '无详情')}` }
    }
    case 'turn/end': {
      const reason = obj(d.reason)
      if (reason.kind !== 'error') return undefined
      const failure = obj(reason.error)
      const code = str(failure.code), message = str(failure.message)
      return { kind: 'error', errorKey: `${code}:${clip(message, 80)}`, errorText: `本轮失败 ${code}：${clip(message || '无详情')}` }
    }
    default:
      return undefined
  }
}
