import { z } from 'zod';
export const repoName = z.string().regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})\/[a-zA-Z0-9_.-]+$/).transform(s => s.toLowerCase()).refine(s => !s.endsWith('/.') && !s.endsWith('/..'));
export const limitSchema = z.number().int().min(1).max(100);
export const scheduleSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('daily'), time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/) }).strict(),
    z.object({ kind: z.literal('every'), hours: z.number().finite().min(0.001).max(8760) }).strict(),
]);
export const repoSchema = z.object({
    repo: repoName, mode: z.enum(['issues', 'prs', 'both']).default('both'),
    schedule: scheduleSchema.optional(), limit: limitSchema.optional(),
});
const common = {
    priority: z.enum(['高', '中', '低']), reason: z.string().min(1).max(1200),
    evidence: z.array(z.string().min(1).max(800)).min(1).max(40),
};
export const issueJudgment = z.object({
    kind: z.literal('issue'), type: z.enum(['bug', '需求', '提问', '重复', '无效']),
    real: z.enum(['是', '待证实', '否']), worth: z.enum(['值得修', '待补充', '不值得修']),
    impact: z.string().min(1).max(400), severity: z.string().min(1).max(400), cost: z.string().min(1).max(400), ...common,
}).strict();
export const prJudgment = z.object({
    kind: z.literal('pr'), verdict: z.enum(['值得合并', '改完再合', '不建议合']),
    risk: z.enum(['高', '中', '低']), suspicious: z.boolean(), ...common,
}).strict();
export const judgmentSchema = z.discriminatedUnion('kind', [issueJudgment, prJudgment]);
export const resultSchema = z.object({
    number: z.number().int().positive(), title: z.string(), url: z.string(),
    judgment: judgmentSchema, source: z.enum(['rules', 'model', 'correction']), modelNote: z.string().optional(),
});
export const correctionSchema = z.object({
    repo: repoName, number: z.number().int().positive(), judgment: judgmentSchema,
    reason: z.string(), at: z.number(), title: z.string(),
});
export const reportSchema = z.object({
    repo: repoName, at: z.number(), results: z.array(resultSchema), analyzed: z.number(), reused: z.number(),
    changed: z.array(z.number()), briefing: z.string().optional(), warnings: z.array(z.string()),
});
export const stateSchema = z.object({
    overrides: z.record(z.string(), repoSchema), removed: z.array(repoName),
    cache: z.record(z.string(), z.object({ fingerprint: z.string(), result: resultSchema })),
    corrections: z.array(correctionSchema),
    reports: z.record(z.string(), reportSchema),
    lastRun: z.record(z.string(), z.number()),
    pending: z.record(z.string(), z.string()),
});
export function emptyState() { return { overrides: {}, removed: [], cache: {}, corrections: [], reports: {}, lastRun: {}, pending: {} }; }
