import { z } from 'zod';
import { requestSchema, decodeValue, routeFor, routePath } from './ui-contract.js';
export class UiError extends Error {
    fields;
    constructor(message, fields) {
        super(message);
        this.fields = fields;
    }
}
/** Only an absent route may use the explicit legacy session adapter. Never
 * retry a mutation after a network timeout or malformed/success response. */
export function postCall(fetcher = (...args) => globalThis.fetch(...args), fallback) {
    return async (input) => {
        const request = requestSchema.parse(input);
        let response;
        try {
            response = await fetcher(routePath(routeFor(request.action)), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(60000) });
        }
        catch {
            throw new UiError('请求未完成；操作可能已提交，请刷新确认。');
        }
        if ((response.status === 404 || response.status === 405) && fallback)
            return fallback(request);
        if (!response.ok)
            throw new UiError('界面请求失败（HTTP ' + response.status + '），请重试。');
        try {
            const envelope = z.discriminatedUnion('ok', [
                z.object({ ok: z.literal(true), value: z.unknown() }),
                z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string(), fields: z.record(z.string(), z.string()).optional() }) }),
            ]).parse(await response.json());
            if (!envelope.ok)
                throw new UiError(envelope.error.message, envelope.error.fields);
            return decodeValue(request, envelope.value);
        }
        catch (e) {
            if (e instanceof UiError)
                throw e;
            throw new UiError('界面返回数据格式无效，请刷新重试。');
        }
    };
}
export function commandCall(execute, sessionId) {
    return async (request) => {
        requestSchema.parse(request);
        let timer;
        try {
            const response = await Promise.race([
                execute(sessionId, '/triage-ui ' + JSON.stringify(request), []),
                new Promise((_, reject) => { timer = setTimeout(() => reject(new UiError('界面请求超时；操作可能已提交，请刷新确认，避免重复提交。')), 60000); }),
            ]);
            if (!response?.ok)
                throw new UiError('界面接口调用失败：' + String(response?.error?.code ?? response?.error?.message ?? '未知原因').slice(0, 200));
            if (!response.value)
                throw new UiError('界面接口未注册（/triage-ui），请确认插件已启用，或重新打开会话。');
            if (response.value.result?.kind !== 'success')
                throw new UiError('界面接口出错：' + String(response.value.result?.text ?? '未知原因').slice(0, 200));
            const reply = JSON.parse(response.value.result.text ?? '');
            if (!reply.ok)
                throw new UiError(reply.error, reply.fields);
            return reply.data;
        }
        finally {
            clearTimeout(timer);
        }
    };
}
