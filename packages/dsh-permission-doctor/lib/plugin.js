import z from '@deepseek-ai/schemastery';
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands';
import { bashFacts, collectCalls, diagnose, display, permissionsAt, render } from './core.js';
export const name = 'permission-doctor';
export const inject = ['commands', 'tools'];
export const Config = z.object({});
export const HELP = [
    '权限拒绝诊断台（只读）',
    '/permission-doctor list [beforeSeq] — 当前会话失败/疑似失败调用，每页 20 条；旧页使用 beforeSeq',
    '/permission-doctor show <结果序号> — 用户从列表选中一次调用，查看权限、路径、审批和结果证据',
    '调用 ID 按原样关联（含 PTC 子调用），结果序号精确选中某一次历史调用。',
    '历史字段缺失显示未记录；原因不可靠显示原因未确定。记录不证明弹窗已展示。',
    '不会改权限、发起审批或执行/重跑工具。工具结果仅在手动 show 中显示。',
].join('\n');
export function apply(ctx) {
    let disposed = false;
    let observations = new WeakMap();
    const permissionCache = new WeakMap();
    const callCache = new WeakMap();
    const starts = new WeakMap();
    ctx.on('tools/pre-execute', async (exec, next) => {
        const session = exec.agent?.session;
        if (session && !disposed) {
            try {
                // Read getters only; a diagnostic snapshot failure must never affect tool policy.
                const events = session.snapshotEvents(), cached = permissionCache.get(session);
                const appendOnly = cached && events.length >= cached.length && events[cached.length - 1] === cached.tail;
                const historical = appendOnly ? { ...cached.value } : permissionsAt([], session.header.cwd);
                const suffix = appendOnly ? events.slice(cached.length) : events;
                // permissionsAt uses only supplied events; retain prior facts for keys absent in the suffix.
                const delta = permissionsAt(suffix);
                for (const key of ['preset', 'sandbox', 'approval'])
                    if (suffix.some(e => e.type === { preset: 'permission/preset', sandbox: 'sandbox/mode', approval: 'approval/policy' }[key]))
                        historical[key] = delta[key];
                permissionCache.set(session, { length: events.length, tail: events.at(-1), value: historical });
                const permissions = { ...historical };
                try {
                    const service = ctx.get('approval');
                    if (service)
                        permissions.approval = { value: service.overrideOf(session) ?? service.config.policy ?? 'ask', source: 'tools/pre-execute：approval.overrideOf/config.policy' };
                }
                catch { /* Preserve log-only fallback. */ }
                try {
                    const policy = ctx.get('sandboxPolicy')?.resolve({ session });
                    if (policy) {
                        permissions.sandbox = { value: policy.mode, source: 'tools/pre-execute：sandboxPolicy.resolve' };
                        permissions.workspace = { value: policy.workspaceRoot, source: 'tools/pre-execute：sandboxPolicy.resolve.workspaceRoot' };
                    }
                }
                catch { /* Preserve log-only fallback. */ }
                try {
                    const service = ctx.get('permissionPresets');
                    if (service)
                        permissions.preset = { value: service.current(session), source: 'tools/pre-execute：permissionPresets.current' };
                }
                catch { /* Preserve log-only fallback. */ }
                starts.set(exec.token, { permissions, time: Date.now() });
            }
            catch { /* Snapshot failures must not change tool decisions. */ }
        }
        return next();
    }, { prepend: true });
    ctx.on('tools/result', (exec, result) => {
        const session = exec.agent?.session, start = starts.get(exec.token);
        starts.delete(exec.token);
        if (!session || disposed)
            return undefined;
        const bash = result.isError ? undefined : bashFacts(exec.name, result.value);
        if (!result.isError && (!bash || !bash.denied && !bash.runnerFailed && !bash.timedOut && !bash.aborted && (bash.exitCode === 0 || bash.exitCode === null)))
            return undefined;
        const observation = {
            callId: exec.callId, name: exec.name, anchor: session.snapshotEvents().length,
            time: start?.time ?? Date.now(), permissions: start?.permissions, bash,
            message: result.isError ? display(result.error.message, 6000) : undefined,
        };
        const entries = observations.get(session) ?? [];
        entries.push(observation);
        if (entries.length > 300)
            entries.splice(0, entries.length - 300);
        observations.set(session, entries);
        return undefined;
    });
    ctx.effect(() => ctx.commands.register({
        definitionId: CommandDefinitionId('dsh-permission-doctor'),
        name: 'permission-doctor', description: '选择失败调用，诊断权限拒绝与为什么未弹审批',
        input: { hint: 'list [beforeSeq] | show <结果序号>' }, recordInput: false,
        handler: async ({ agent, rawInput, signal }) => {
            if (disposed || signal.aborted)
                return { kind: 'error', text: '诊断已取消或插件已停止。' };
            const input = rawInput.trim();
            if (!input || input === 'help')
                return { kind: 'success', text: HELP };
            const match = /^(list|show)(?:\s+(0|[1-9]\d*))?$/.exec(input);
            if (!match || match[1] === 'show' && match[2] === undefined || match[2] && !Number.isSafeInteger(Number(match[2])))
                return { kind: 'error', text: HELP };
            const session = agent.session;
            try {
                // Exact read only; this does not activate a session, issue a model query, or scan files.
                const query = ctx.get('sessionQuery');
                const events = query ? (await query.readSession(session.id)).events : session.snapshotEvents();
                if (signal.aborted || disposed)
                    return { kind: 'error', text: '诊断已取消或插件已停止。' };
                const live = observations.get(session) ?? [], cached = callCache.get(session);
                const relevant = events.filter(e => e.type !== 'command/run' && e.type !== 'command/done');
                const same = cached && cached.lastLive === live.at(-1) && cached.events.length === relevant.length && cached.events.every((e, i) => e === relevant[i]);
                const calls = same ? cached.calls : collectCalls(events, live, session.header.cwd);
                if (!same)
                    callCache.set(session, { events: relevant, lastLive: live.at(-1), calls });
                if (match[1] === 'show') {
                    const call = calls.find(c => c.resultSeq === Number(match[2]));
                    if (!call || !call.candidate)
                        return { kind: 'error', text: '该结果序号没有失败/疑似失败调用，请先 /permission-doctor list。' };
                    return { kind: 'success', text: render(call) };
                }
                const before = match[2] === undefined ? Infinity : Number(match[2]);
                const failures = calls.filter(c => c.candidate && c.resultSeq < before).reverse();
                const page = failures.slice(0, 20);
                const rows = page.map(c => '#' + c.resultSeq + ' | ' + display(c.id, 200) + ' | ' + display(c.name, 100) + ' | ' + diagnose(c).label);
                const next = failures.length > 20 ? '\n较早记录：/permission-doctor list ' + page.at(-1).resultSeq : '';
                return { kind: 'success', text: '当前会话失败/疑似失败调用（最多 20 条；文本标记仅为线索）：\n' + (rows.join('\n') || '没有记录。') + next + '\n选择：/permission-doctor show <结果序号>\n运行时观察仅保留每会话最近 300 条失败；重启后退回历史日志证据。' };
            }
            catch {
                return { kind: 'error', text: '无法读取或还原当前会话证据，未执行任何修复。请维护者检查会话查询/日志完整性。' };
            }
        },
    }));
    ctx.effect(() => () => { disposed = true; observations = new WeakMap(); });
}
