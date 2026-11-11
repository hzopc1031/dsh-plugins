import { repoName, repoSchema, limitSchema } from './types.js';
export function repositories(config, state) {
    const map = new Map(config.map(row => { const r = repoSchema.parse(row); return [r.repo, r]; }));
    for (const r of Object.values(state.overrides))
        map.set(r.repo, r);
    for (const repo of state.removed)
        map.delete(repo);
    return [...map.values()].sort((a, b) => a.repo.localeCompare(b.repo));
}
/** Shell-like quoting without expansion; preserve Windows path backslashes. */
export function tokens(raw) {
    const out = [];
    let value = '', quote = '', started = false;
    for (let i = 0; i < raw.length; i++) {
        const c = raw[i];
        if (c === '\\' && (raw[i + 1] === quote && !!quote)) {
            value += raw[++i];
            started = true;
        }
        else if (quote) {
            if (c === quote)
                quote = '';
            else
                value += c;
        }
        else if (c === "'" || c === '"') {
            quote = c;
            started = true;
        }
        else if (/\s/.test(c)) {
            if (started) {
                out.push(value);
                value = '';
                started = false;
            }
        }
        else {
            value += c;
            started = true;
        }
    }
    if (quote)
        throw new Error('引号未闭合');
    if (started)
        out.push(value);
    return out;
}
export function repoCommand(raw, state, config = []) {
    const [action, name, ...args] = tokens(raw);
    if (!name || !['add', 'remove', 'business'].includes(action))
        throw new Error('用法：/triage-repo add owner/repo [--issues|--prs|--both] [--daily HH:MM|--every 小时] [--limit N] [--business "文本"] [--business-file 路径]；business owner/repo "文本" | --file 路径 | --clear；remove owner/repo；list');
    const repo = repoName.parse(name);
    if (action === 'remove') {
        if (args.length)
            throw new Error('remove 不接受其他参数');
        state.removed = [...new Set([...state.removed, repo])];
        delete state.overrides[repo];
        delete state.pending[repo];
        return '已移除 ' + repo;
    }
    if (action === 'business') {
        const existing = repositories(config, state).find(r => r.repo === repo);
        if (!existing)
            throw new Error('请先添加仓库');
        const r = { ...existing };
        delete r.business;
        delete r.businessFile;
        if (args.length === 1 && args[0] === '--clear') { }
        else if (args.length === 2 && args[0] === '--file' && args[1] && !args[1].startsWith('--'))
            r.businessFile = args[1];
        else if (args.length === 1 && args[0] && !args[0].startsWith('--'))
            r.business = args[0];
        else
            throw new Error('business 参数无效；含空格文本请加引号');
        state.overrides[repo] = repoSchema.parse(r);
        delete state.lastRun[repo];
        return '已更新业务说明：' + repo;
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
        else if (flag === '--business' || flag === '--business-file') {
            const value = args[++i];
            if (!value || value.startsWith('--'))
                throw new Error('缺少业务说明参数');
            if (flag === '--business')
                r.business = value;
            else
                r.businessFile = value;
        }
        else
            throw new Error('未知选项');
    }
    state.overrides[repo] = repoSchema.parse(r);
    state.removed = state.removed.filter(n => n !== repo);
    delete state.lastRun[repo];
    return '已保存 ' + repo;
}
export function runArguments(raw) {
    const args = tokens(raw);
    const repo = args[0] && !args[0].startsWith('--') ? repoName.parse(args.shift()) : undefined;
    if (!args.length)
        return { repo };
    if (args.length !== 2 || args[0] !== '--limit')
        throw new Error('用法：/triage [owner/repo] [--limit N]');
    return { repo, limit: limitSchema.parse(Number(args[1])) };
}
