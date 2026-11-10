/** Pure mapping from DSH session-log events to heartbeat activities. */
import { argumentsKey, clip } from './core.js';
const obj = (v) => (v && typeof v === 'object' ? v : {});
const str = (v) => (typeof v === 'string' ? v : '');
function contentText(content) {
    if (!Array.isArray(content))
        return '';
    return content.map(b => (obj(b).type === 'text' ? str(obj(b).text) : '')).join(' ');
}
/**
 * Translate one appended session event. `names` maps callId -> tool name and is
 * updated on `tool/call` so the matching `tool/result` can be attributed.
 * Returns undefined for events that are not heartbeat-relevant.
 */
export function activityOf(event, names) {
    const d = obj(event.data);
    switch (event.type) {
        case 'step/start':
            return { kind: 'step' };
        case 'assistant/message':
            return { kind: 'model' };
        case 'tool/call': {
            const callId = str(d.callId), name = str(d.name) || '未知工具';
            names.set(callId, name);
            return { kind: 'tool-call', callId, name, argsKey: argumentsKey(str(d.arguments)) };
        }
        case 'tool/result': {
            const message = obj(d.message);
            const callId = str(message.toolCallId);
            const name = names.get(callId) ?? '未知工具';
            names.delete(callId);
            const isError = message.isError === true;
            if (!isError)
                return { kind: 'tool-result', callId, name, isError: false };
            const error = obj(d.error);
            const reason = str(error.reason) || contentText(message.content);
            const code = str(error.code) || str(error.name);
            // Key on code + the start of the message so "same error" survives varying timestamps at the end.
            return { kind: 'tool-result', callId, name, isError: true, errorKey: `${code}:${clip(reason, 80)}`, errorText: `${name}：${clip(reason || code || '失败')}` };
        }
        case 'llm/retry': {
            const failure = obj(d.failure);
            const code = str(failure.code), message = str(failure.message);
            const attempt = typeof d.retry === 'number' ? d.retry : 0;
            return { kind: 'retry', attempt, errorKey: `${code}:${clip(message, 80)}`, errorText: `模型请求 ${code || '失败'}：${clip(message || '无详情')}` };
        }
        case 'turn/end': {
            const reason = obj(d.reason);
            if (reason.kind !== 'error')
                return undefined;
            const failure = obj(reason.error);
            const code = str(failure.code), message = str(failure.message);
            return { kind: 'error', errorKey: `${code}:${clip(message, 80)}`, errorText: `本轮失败 ${code}：${clip(message || '无详情')}` };
        }
        default:
            return undefined;
    }
}
