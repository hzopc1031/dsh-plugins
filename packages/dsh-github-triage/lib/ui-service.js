import { z } from 'zod';
import { repositories, repoCommand } from './config.js';
import { correct } from './pipeline.js';
import { exportDocument, importDocument, rulesDocument } from './rule-files.js';
import { requestSchema, mergeRepo, fieldErrors } from './ui-contract.js';
import { GithubError } from './github.js';
class LocalValidationError extends Error {
}
/** Shares the command/timer queue and storage domain; no extra HTTP listener. */
export function uiService(d) {
    const jobs = new Map();
    const all = () => repositories(d.config.repositories, d.state());
    const find = (repo) => { const r = all().find(r => r.repo === repo); if (!r)
        throw new Error('仓库不存在'); return r; };
    const jobList = () => structuredClone([...jobs.values()]);
    async function update(repo, next) {
        try {
            await d.validate(repo);
        }
        catch {
            throw new LocalValidationError();
        }
        next.overrides[repo.repo] = repo;
        next.removed = next.removed.filter(n => n !== repo.repo);
        delete next.lastRun[repo.repo];
        if (repositories(d.config.repositories, next).length > 50)
            throw new Error('最多配置 50 个仓库');
        await d.save(next);
        return repo;
    }
    return async (input) => {
        try {
            d.signal.throwIfAborted();
            const r = requestSchema.parse(input);
            if (r.action === 'snapshot')
                return { ok: true, data: { repositories: all(), reports: Object.values(d.state().reports).map(report => !r.compact ? report : { ...report, businessContext: undefined, results: report.results.map(({ evidence, judgment, localStatus, observation, ...item }) => ({ ...item, deferred: true, judgment: judgment ? { kind: judgment.kind, recommendation: judgment.recommendation, priority: judgment.priority, businessReason: judgment.businessReason } : undefined })) }), jobs: jobList(), model: d.model(), defaults: { limit: d.config.limit, fullMax: d.config.fullMax } } };
            if (r.action === 'detail') {
                const item = d.state().reports[r.repo]?.results.find(item => item.number === r.number);
                if (!item)
                    throw new Error('条目不存在');
                return { ok: true, data: item };
            }
            if (r.action === 'jobs')
                return { ok: true, data: jobList() };
            if (r.action === 'detect-proxy' || r.action === 'diagnose')
                return { ok: true, data: await d.network?.(r.action) ?? '网络诊断不可用' };
            if (r.action === 'models')
                return { ok: true, data: await d.models() };
            if (r.action === 'rules')
                return { ok: true, data: d.safe.text(rulesDocument(r.repo, d.state(), all().find(v => v.repo === r.repo)?.business)) };
            if (r.action === 'start') {
                find(r.repo);
                const active = jobs.get(r.repo);
                if (active && ['queued', 'running'].includes(active.status))
                    return { ok: true, data: { ...active } };
                const job = { repo: r.repo, status: 'queued', at: Date.now() };
                jobs.set(r.repo, job);
                // Closing the dialog never cancels accepted work.
                void d.serialize(async () => {
                    job.status = 'running';
                    const repo = find(r.repo), limit = r.scan.full ? (r.scan.max ?? repo.fullMax ?? d.config.fullMax) : (r.scan.limit ?? repo.limit ?? d.config.limit);
                    const report = await d.perform(repo, limit, false, d.signal, r.scan);
                    job.status = 'completed';
                    job.at = Date.now();
                    job.message = report.modelStatus ?? '分析完成';
                }).catch(error => { job.status = 'failed'; job.at = Date.now(); job.message = error instanceof GithubError ? error.message : '分析失败：请检查仓库、模型、网络或插件是否已停止。'; });
                return { ok: true, data: { ...job } };
            }
            return await d.serialize(async () => {
                const next = structuredClone(d.state());
                if (r.action === 'add') {
                    if (all().some(v => v.repo === r.value.repo))
                        throw new Error('仓库已存在，请使用编辑');
                    return { ok: true, data: await update(d.safe.value(r.value), next) };
                }
                if (r.action === 'patch')
                    return { ok: true, data: await update(mergeRepo(find(r.repo), d.safe.value(r.patch)), next) };
                if (r.action === 'remove') {
                    find(r.repo);
                    repoCommand('remove ' + r.repo, next, d.config.repositories);
                    await d.save(next);
                    if (!['queued', 'running'].includes(jobs.get(r.repo)?.status ?? ''))
                        jobs.delete(r.repo);
                    return { ok: true, data: '已移除仓库' };
                }
                if (r.action === 'fix') {
                    const message = correct(next, r.repo + '#' + r.number + ' ' + r.recommendation + ' ' + d.safe.text(r.reason), Date.now());
                    await d.save(next);
                    return { ok: true, data: message };
                }
                if (r.action === 'export') {
                    await exportDocument(r.path, d.safe.text(rulesDocument(r.repo, next, all().find(v => v.repo === r.repo)?.business)));
                    return { ok: true, data: '已导出规则（未覆盖已有文件）' };
                }
                if (r.action === 'import') {
                    importDocument(r.repo, r.text, next, d.safe);
                    await d.save(next);
                    return { ok: true, data: '已导入规则：' + r.repo };
                }
                throw new Error('未知操作');
            });
        }
        catch (error) {
            if (error instanceof LocalValidationError)
                return { ok: false, error: '本地对照配置无效', fields: { localRepoPath: '请填写存在的本地 Git 仓库根目录绝对路径（拒绝 UNC/设备路径）', localRef: '请确认 ref 可解析为该仓库中的提交' } };
            if (error instanceof z.ZodError)
                return { ok: false, error: '请检查表单中的字段格式和范围。', fields: fieldErrors(error) };
            return { ok: false, error: '操作失败：仓库可能已存在或被移除；请检查本地路径/ref、条目是否已有 AI 结论、导出文件是否已存在，以及插件状态。' };
        }
    };
}
