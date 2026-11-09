import { appendPluginRecord, pluginRecordOf } from '@deepseek-ai/dsh-session';
import { argumentSummary, defaults, pathsFrom, text } from './core.js';
function isCall(value) {
    if (!value || typeof value !== 'object')
        return false;
    const c = value;
    return typeof c.id === 'string' && typeof c.name === 'string' && typeof c.args === 'string' && Array.isArray(c.paths) && c.paths.every(p => typeof p === 'string') && typeof c.started === 'number' && (c.duration === null || typeof c.duration === 'number') && ['success', 'failure', 'pending'].includes(c.status ?? '') && Array.isArray(c.changes) && c.changes.every(f => typeof f?.path === 'string' && ['新建', '修改', '删除', '变更（类型不可用）'].includes(f?.kind));
}
export function boundary(events) {
    let to = 0;
    for (const e of events) {
        const r = pluginRecordOf(e);
        if (r?.type !== 'plugin:task-review/boundary' || !r.data || typeof r.data !== 'object')
            continue;
        const b = r.data;
        if (b.version === 1 && Number.isSafeInteger(b.to) && b.to >= 0 && b.to <= e.seq)
            to = Math.max(to, b.to);
    }
    return to;
}
export function mark(session, to, file) {
    appendPluginRecord(session, 'plugin:task-review/boundary', { version: 1, to, file });
}
/** Read only the unreviewed suffix; inherited fork prefixes are excluded. */
export function segment(session, now = Date.now()) {
    const events = session.snapshotEvents(), from = Math.max(boundary(events), session.inheritedEventCount);
    const slice = events.filter(e => e.seq >= from);
    const meaningful = slice.filter(e => ['user/message', 'tool/call', 'assistant/message', 'assistant/attempt'].includes(e.type) || pluginRecordOf(e)?.type === 'plugin:task-review/call');
    if (!meaningful.length)
        return null;
    const calls = [], changes = [];
    for (const e of slice) {
        const record = pluginRecordOf(e);
        if (record?.type === 'plugin:task-review/call' && isCall(record.data)) {
            calls.push(record.data);
            changes.push(...record.data.changes);
        }
    }
    // Tool-call evidence without a final observed result remains visibly unfinished.
    for (const e of slice)
        if (e.type === 'tool/call' && !calls.some(c => c.id === e.data.callId)) {
            let args = {};
            try {
                args = JSON.parse(e.data.arguments);
            }
            catch { /* Invalid JSON is not copied. */ }
            const result = slice.find(r => r.type === 'tool/result' && r.data.message.source.callId === e.data.callId);
            calls.push({ id: e.data.callId, name: text(e.data.name), args: argumentSummary(args), paths: pathsFrom(args), started: e.time, duration: null, status: result?.type === 'tool/result' ? result.data.message.isError ? 'failure' : 'success' : 'pending', changes: [] });
        }
    calls.sort((a, b) => a.started - b.started);
    const user = slice.find(e => e.type === 'user/message' && e.data.source.kind === 'user');
    const goal = user?.type === 'user/message' ? user.data.content.filter(b => b.type === 'text').map(b => b.type === 'text' ? b.text : '').join(' ') : '';
    const settlements = slice.filter(e => e.type === 'assistant/message');
    // Final authoritative usage only. Failed-attempt accounting is explicitly unavailable.
    const usageEvents = settlements.filter(e => e.type === 'assistant/message' && e.data.usage);
    const usage = usageEvents.length ? ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'totalTokens'].map(key => {
        const values = usageEvents.map(e => e.type === 'assistant/message' ? e.data.usage?.[key] : undefined);
        return `${key}=${values.every(v => v !== undefined) ? values.reduce((a, v) => a + (v ?? 0), 0) : '不可用'}`;
    }).join(', ') + `（仅 ${usageEvents.length}/${settlements.length} 条最终消息；失败尝试用量不可用）` : '不可用';
    const end = slice.findLast(e => e.type === 'turn/end');
    return { goal: text(goal), calls, changes: [...new Map(changes.map(f => [f.path, f])).values()], started: meaningful[0].time, ended: now, usage, outcome: end?.type === 'turn/end' ? `最后一轮状态 ${end.data.reason.kind}` : '本段尚无轮次结束证据', from, to: events.length };
}
export { defaults };
