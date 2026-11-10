import { deriveEventMessage, foldSurface, isSurfaceEvent } from '@deepseek-ai/dsh-session';
import { currentSessionMessageProjections } from '@deepseek-ai/dsh-session-format-catalog/message-projections';
/** Same canonical fold/interpreters as rc.5 Session Query; no raw-log membership guesses. */
export function observeMessages(events, assemblies = []) {
    const folded = foldSurface(events, currentSessionMessageProjections);
    const current = new Set(folded.nodes);
    const out = [];
    for (const event of events) {
        if (!isSurfaceEvent(event))
            continue;
        const message = deriveEventMessage(event, folded.projectedMessages);
        if (!message || !['system', 'developer', 'user'].includes(message.role))
            continue;
        const body = message.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
        const source = { ...message.source };
        if (message.role === 'system') {
            const evidence = assemblies.find(a => a.prompt === body);
            if (evidence)
                source.observedSystemSections = evidence.sections;
        }
        out.push({ seq: event.seq, time: event.time, role: message.role, source, body, current: current.has(event.seq) });
    }
    return out;
}
