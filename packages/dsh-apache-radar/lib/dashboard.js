import { validDirectory } from './local-files.js';
export function dashboardHandler(run, directories) {
    return async (request) => {
        const json = (value, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store' } });
        try {
            const body = await request.json();
            if (!body || Array.isArray(body) || typeof body !== 'object'
                || Object.keys(body).some(key => !['directory', 'action', 'project'].includes(key)))
                throw new Error('无效的面板请求。');
            const { directory, action = 'read', project } = body;
            if (typeof action !== 'string' || !['read', 'refresh', 'brief', 'add', 'remove', 'file'].includes(action))
                throw new Error('未知操作。');
            if (directory !== undefined && !validDirectory(directory))
                throw new Error('请选择本地绝对目录，不能包含 ..。');
            const available = directories();
            const target = directory ?? (available.length === 1 ? available[0] : undefined);
            if (!target) {
                if (action !== 'read')
                    throw new Error('请先选择项目目录。');
                return json({ directories: available });
            }
            if (action === 'file') {
                const saved = JSON.parse(await run(target, 'open', { includeMarkdown: true }));
                return new Response(saved.markdown, { headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store' } });
            }
            if (action === 'add' || action === 'remove') {
                if (typeof project !== 'string')
                    throw new Error('请输入项目 id。');
                await run(target, 'watch', { operation: action, project });
            }
            const data = JSON.parse(await run(target, 'dashboard', {
                refresh: action === 'refresh', saveBrief: action === 'brief',
            }));
            return json({ ...data, directories: available, directory: target });
        }
        catch (error) {
            return json({ error: error instanceof Error ? error.message : String(error) }, 400);
        }
    };
}
export function registerDashboard(ctx, run, directories) {
    // CLI-only hosts keep their commands when the browser connection is absent.
    ctx.inject(['connection'], scope => {
        const connection = scope.get('connection');
        scope.effect(() => connection.fetch.register({
            path: '/api/apache-radar/dashboard', methods: ['POST'], requestBody: 'buffered', fetch: dashboardHandler(run, directories),
        }), 'apache-radar: authenticated dashboard');
    });
}
