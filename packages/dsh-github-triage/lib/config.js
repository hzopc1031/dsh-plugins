import { repoName, repoSchema, limitSchema } from './types.js';
export function repositories(config, state) {
    const map = new Map(config.map(row => { const r = repoSchema.parse(row); return [r.repo, r]; }));
    for (const r of Object.values(state.overrides))
        map.set(r.repo, r);
    for (const repo of state.removed)
        map.delete(repo);
    return [...map.values()].sort((a, b) => a.repo.localeCompare(b.repo));
}
export function repoCommand(raw, state) {
    const [action, name, ...args] = raw.trim().split(/\s+/);
    if (!name || !['add', 'remove'].includes(action))
        throw new Error('用法：/triage-repo add owner/repo [--issues|--prs|--both] [--daily HH:MM|--every 小时] [--limit N]；remove owner/repo；list');
    const repo = repoName.parse(name);
    if (action === 'remove') {
        if (args.length)
            throw new Error('remove 不接受其他参数');
        state.removed = [...new Set([...state.removed, repo])];
        delete state.overrides[repo];
        delete state.pending[repo];
        return '已移除 ' + repo;
    }
    const r = { repo, mode: 'both' };
    const seen = new Set();
    for (let i = 0; i < args.length; i++) {
        const flag = args[i], key = ['--issues', '--prs', '--both'].includes(flag) ? 'mode' : ['--daily', '--every'].includes(flag) ? 'schedule' : flag;
        if (seen.has(key))
            throw new Error('重复或冲突的选项');
        seen.add(key);
        if (key === 'mode')
            r.mode = flag.slice(2);
        else if (flag === '--daily')
            r.schedule = { kind: 'daily', time: args[++i] };
        else if (flag === '--every')
            r.schedule = { kind: 'every', hours: Number(args[++i]) };
        else if (flag === '--limit')
            r.limit = limitSchema.parse(Number(args[++i]));
        else
            throw new Error('未知选项');
    }
    state.overrides[repo] = repoSchema.parse(r);
    state.removed = state.removed.filter(n => n !== repo);
    delete state.lastRun[repo];
    return '已保存 ' + repo;
}
export function runArguments(raw) {
    const args = raw.trim() ? raw.trim().split(/\s+/) : [];
    const repo = args[0] && !args[0].startsWith('--') ? repoName.parse(args.shift()) : undefined;
    if (!args.length)
        return { repo };
    if (args.length !== 2 || args[0] !== '--limit')
        throw new Error('用法：/triage [owner/repo] [--limit N]');
    return { repo, limit: limitSchema.parse(Number(args[1])) };
}
