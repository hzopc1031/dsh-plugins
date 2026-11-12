import { deriveEventMessage, foldSurface, isSurfaceEvent, type SessionEvent } from '@deepseek-ai/dsh-session'
import { currentSessionMessageProjections } from '@deepseek-ai/dsh-session-format-catalog/message-projections'
import type { ObservedMessage } from './core.js'
export interface AssemblyEvidence { prompt: string; sections: { name: string; text: string }[] }
/** Same canonical fold/interpreters as rc.5 Session Query; no raw-log membership guesses. */
export function observeMessages(events: readonly SessionEvent[], assemblies: readonly AssemblyEvidence[] = []): ObservedMessage[] {
  const folded = foldSurface(events, currentSessionMessageProjections)
  const current = new Set(folded.nodes)
  const out: ObservedMessage[] = []
  for (const event of events) {
    if (!isSurfaceEvent(event)) continue
    const message = deriveEventMessage(event, folded.projectedMessages)
    if (!message || !['system', 'developer', 'user'].includes(message.role)) continue
    const body = message.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
    const source: Record<string, unknown> = { ...message.source }
    if (message.role === 'system') {
      const evidence = assemblies.find(a => a.prompt === body)
      if (evidence) source.observedSystemSections = evidence.sections
    }
    out.push({ seq: event.seq, time: event.time, role: message.role, source, body, current: current.has(event.seq) })
  }
  return out
}
