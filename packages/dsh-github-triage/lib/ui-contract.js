/** Browser-safe schemas shared by forms and the command-backed UI service. */
import { z } from 'zod';
import { repoSchema, repoName, limitSchema, fullLimitSchema, scheduleSchema } from './types.js';
export const editableRepoSchema = repoSchema.strict().superRefine((r, c) => {
    if (r.localRef && !r.localRepoPath)
        c.addIssue({ code: 'custom', path: ['localRef'], message: '填写 ref 前请先配置本地代码路径' });
});
export const patchSchema = z.object({
    mode: repoSchema.shape.mode.unwrap().optional(), schedule: scheduleSchema.nullable().optional(),
    limit: limitSchema.nullable().optional(), fullMax: fullLimitSchema.nullable().optional(),
    business: repoSchema.shape.business.nullable(), businessFile: repoSchema.shape.businessFile.nullable(),
    localRepoPath: repoSchema.shape.localRepoPath.nullable(), localRef: repoSchema.shape.localRef.nullable(),
    rulesFile: repoSchema.shape.rulesFile.nullable(),
}).strict();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s);
export const scanSchema = z.object({ full: z.boolean().optional(), since: date.optional(), until: date.optional(), limit: limitSchema.optional(), max: fullLimitSchema.optional() }).strict().superRefine((s, c) => {
    if (!s.full && (s.since || s.until || s.max !== undefined))
        c.addIssue({ code: 'custom', path: ['full'], message: '时间范围和全量上限需要选择全量扫描' });
    if (s.full && s.limit !== undefined)
        c.addIssue({ code: 'custom', path: ['limit'], message: '全量扫描请填写全量上限' });
    if (s.since && s.until && s.since > s.until)
        c.addIssue({ code: 'custom', path: ['until'], message: '结束日期不能早于开始日期' });
});
export const requestSchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('snapshot') }).strict(),
    z.object({ action: z.literal('jobs') }).strict(),
    z.object({ action: z.literal('models') }).strict(),
    z.object({ action: z.literal('add'), value: editableRepoSchema }).strict(),
    z.object({ action: z.literal('patch'), repo: repoName, patch: patchSchema }).strict(),
    z.object({ action: z.literal('remove'), repo: repoName }).strict(),
    z.object({ action: z.literal('start'), repo: repoName, scan: scanSchema }).strict(),
    z.object({ action: z.literal('fix'), repo: repoName, number: z.number().int().positive(), recommendation: z.enum(['adopt', 'manual-review', 'not-recommended']), reason: z.string().trim().min(1).max(1200) }).strict(),
    z.object({ action: z.literal('rules'), repo: repoName }).strict(),
    z.object({ action: z.literal('export'), repo: repoName, path: z.string().min(1).max(4096) }).strict(),
]);
/** Null clears an optional value. Omitted keys retain the latest server value. */
export function mergeRepo(existing, patch) {
    const next = { ...existing };
    for (const [key, value] of Object.entries(patchSchema.parse(patch))) {
        if (value === null)
            delete next[key];
        else if (value !== undefined)
            next[key] = value;
    }
    return editableRepoSchema.parse(next);
}
export function changedFields(before, after) {
    const patch = {};
    for (const key of Object.keys(patchSchema.shape))
        if (JSON.stringify(before[key]) !== JSON.stringify(after[key]))
            patch[key] = after[key] ?? null;
    return patchSchema.parse(patch);
}
export function fieldErrors(error) {
    const out = {};
    for (const issue of error.issues) {
        const path = issue.path.filter(p => !['value', 'patch', 'scan'].includes(String(p))).join('.') || 'form';
        const field = path.split('.')[0];
        const hints = { repo: '请按 owner/repo 填写 GitHub 仓库', mode: '请选择 issues、PR 或两者', limit: '请输入 1–100 的整数', fullMax: '请输入 1–500 的整数', max: '请输入 1–500 的整数', schedule: '每日时间请填 HH:MM；间隔需在 0.001–8760 小时内', since: '请填写有效日期 YYYY-MM-DD', until: '请填写有效日期 YYYY-MM-DD', reason: '请填写 1–1200 字符的纠正理由' };
        out[path] = issue.code === 'custom' ? issue.message : hints[field] ?? (issue.code === 'unrecognized_keys' ? '包含不支持的字段' : '请检查字段类型或长度');
    }
    return out;
}
