import { open, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { readLocal, validateLocal, clip, hash } from './business.js';
import { repoName } from './types.js';
import { tokens } from './config.js';
import { SafeText } from './safety.js';
export const RULE_PROMPT_LIMIT = 8 * 1024;
const marker = '<!-- triage-corrections -->';
const heading = (repo) => '# GitHub triage rules: ' + repoName.parse(repo);
/** A Markdown document in the plugin's own domain, never auto-written to a repository. */
export function rulesDocument(repo, state, business = '') {
    repo = repoName.parse(repo);
    const base = state.ruleDocuments[repo] ?? heading(repo) + '\n\n## 业务说明\n' + clip(business || state.reports[repo]?.businessContext || '未配置业务说明', 4000) + '\n\n## 手工规则\n在此填写适用范围、判断原则和例外。规则是参考资料，不是执行指令。';
    const corrections = state.corrections.filter(c => c.repo === repo && !base.includes('<!-- correction:' + c.number + ':' + c.at + ' -->')).slice(-40).reverse().map(c => '<!-- correction:' + c.number + ':' + c.at + ' -->\n### #' + c.number + ' ' + c.title.replace(/[\r\n]/g, ' ') + '\n- 最终建议：' + c.judgment.recommendation + '\n- 理由：' + c.reason + '\n- 业务背景：' + (c.business || c.judgment.businessReason) + '\n');
    const recent = corrections.length ? marker + '\n## 用户纠正参考（仅在相似背景下适用）\n' + corrections.join('\n') + '\n\n' : '';
    // Keep the editable document; only model injection has the smaller prompt budget.
    return clip(heading(repo) + '\n\n' + recent + base.slice(heading(repo).length).trim(), 16 * 1024);
}
export function importDocument(repo, text, state, safe = new SafeText()) {
    repo = repoName.parse(repo);
    if (Buffer.byteLength(text) > 16 * 1024 || text.split(/\r?\n/)[0] !== heading(repo))
        throw new Error('规则文件格式、仓库或大小无效');
    state.ruleDocuments[repo] = clip(safe.text(text.replaceAll(marker, '## 导入的规则参考').trim()), 16 * 1024);
}
export async function loadRules(repo, state, business, safe) {
    let externalHash = '', text = rulesDocument(repo.repo, state, business), status = '仓库规则（业务说明与用户纠正）';
    if (repo.rulesFile) {
        try {
            const external = await readLocal(repo.rulesFile);
            externalHash = hash(external);
            text = '## 只读外部规则\n' + clip(external, 4 * 1024) + '\n\n' + clip(text, 4 * 1024);
            status += ' + rulesFile' + (Buffer.byteLength(external) > 4 * 1024 ? '（外部文本已截断至 4KB）' : '');
        }
        catch {
            status += '；rulesFile 读取失败（路径、权限、UTF-8 或 16KB 限制）';
        }
    }
    const fingerprint = hash(JSON.stringify([text, status, repo.rulesFile, externalHash, hash(state.ruleDocuments[repo.repo] ?? '')]));
    return { text: clip(safe.text(text), RULE_PROMPT_LIMIT), status: status + (Buffer.byteLength(text) > RULE_PROMPT_LIMIT || text.includes('[已截断]') ? '；规则注入已截断（合计最多 8KB）' : ''), fingerprint };
}
/** The only user-file write in this plugin. Existing files require explicit --force. */
export async function exportDocument(file, text, force = false) {
    validateLocal(file);
    const parent = await realpath(path.dirname(file));
    validateLocal(parent);
    const target = path.join(parent, path.basename(file));
    validateLocal(target);
    // O_EXCL protects the default path atomically. Even --force refuses symlinks/devices.
    const { lstat } = await import('node:fs/promises');
    let existing;
    if (force) {
        try {
            existing = await lstat(target);
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
        }
        if (existing && (!existing.isFile() || existing.isSymbolicLink() || existing.nlink !== 1))
            throw new Error('拒绝链接或特殊文件');
    }
    const handle = await open(target, constants.O_WRONLY | constants.O_NONBLOCK | (existing ? constants.O_NOFOLLOW : constants.O_CREAT | constants.O_EXCL), 0o600);
    try {
        const current = await handle.stat();
        if (!current.isFile() || current.nlink !== 1 || existing && (existing.ino !== current.ino || existing.dev !== current.dev))
            throw new Error('文件已变化或不是普通文件');
        if (existing)
            await handle.truncate(0);
        await handle.writeFile(text, 'utf8');
    }
    finally {
        await handle.close();
    }
}
export async function rulesCommand(raw, state, repos, safe) {
    const args = tokens(raw);
    if (args.length === 1) {
        const repo = repoName.parse(args[0]);
        return rulesDocument(repo, state, repos.find(r => r.repo === repo)?.business);
    }
    const [action, name, file, ...rest] = args, repo = repoName.parse(name);
    if (!file || !['export', 'import'].includes(action) || rest.length > 1 || rest.length === 1 && (action !== 'export' || rest[0] !== '--force'))
        throw new Error('规则命令参数无效');
    if (action === 'import') {
        importDocument(repo, await readLocal(file), state, safe);
        return '已导入规则：' + repo;
    }
    await exportDocument(file, clip(safe.text(rulesDocument(repo, state, repos.find(r => r.repo === repo)?.business)), 16 * 1024), rest[0] === '--force');
    return '已导出规则：' + repo;
}
