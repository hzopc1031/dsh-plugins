import { requestSchema, fieldErrors, routeActions, routePath } from './ui-contract.js';
const reply = (body) => Response.json(body, { headers: { 'cache-control': 'no-store' } });
const failure = (code, message, fields) => reply({ ok: false, error: { code, message, fields } });
export function routeHandler(name, service) {
    return async (request) => {
        if (request.method !== 'POST')
            return new Response(null, { status: 405, headers: { Allow: 'POST' } });
        try {
            const text = await request.text();
            if (new TextEncoder().encode(text).length > 150000)
                return failure('too-large', '请求过大');
            let body;
            try {
                body = JSON.parse(text);
            }
            catch {
                return failure('bad-json', '请求必须为有效 JSON');
            }
            const parsed = requestSchema.safeParse(body);
            if (!parsed.success)
                return failure('validation', '请检查表单中的字段格式和范围。', fieldErrors(parsed.error));
            if (!routeActions[name].includes(parsed.data.action))
                return failure('wrong-route', '操作与路由不匹配');
            const result = await service(parsed.data);
            return result.ok ? reply({ ok: true, value: result.data }) : failure('operation', result.error, result.fields);
        }
        catch {
            return failure('internal', '界面服务暂不可用，请重试。');
        }
    };
}
export function mountRoutes(ctx, service) {
    ctx.inject(['connection'], c => {
        const connection = c.get('connection');
        if (typeof connection?.fetch?.register !== 'function')
            return;
        for (const name of Object.keys(routeActions))
            c.effect(() => connection.fetch.register({ path: routePath(name), methods: ['POST'], requestBody: 'buffered', fetch: routeHandler(name, service) }), 'github-triage: ' + name);
    });
}
