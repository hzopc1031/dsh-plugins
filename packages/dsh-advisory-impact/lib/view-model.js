import { collapseNetworkErrors } from './intranet-http.js';
export const VERDICT_LABELS = { affected: '受影响', not_affected: '不受影响', unknown: '无法判断' };
export const STATE_LABELS = { fresh: '刚抓取', cached: '缓存有效', stale: '抓取失败，使用最后成功缓存（已陈旧）', error: '来源失败，无可用缓存' };
export function displayTime(value) {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(value)) + ' UTC+8';
}
export function sourceView(source) {
    if (!source)
        return null;
    return { url: source.url, state: source.state, label: STATE_LABELS[source.state], fetchedAt: source.fetchedAt,
        fetchedTime: source.fetchedAt ? displayTime(source.fetchedAt) : undefined,
        sourceTimestamp: source.data?.sourceTimestamp, error: source.error, cacheError: source.cacheError };
}
export function osvView(source) {
    return { ...sourceView(source), status: source.data?.status ?? 'unavailable',
        statusLabel: source.data?.label ?? 'OSV 第二来源不可用', id: source.data?.record?.id, aliases: source.data?.record?.aliases ?? [] };
}
function projectView(project) {
    return { project: project.project, pins: project.pins, error: project.error, source: sourceView(project.source),
        notices: project.verdicts?.notices ?? [],
        advisories: project.verdicts?.advisories.map(a => ({ id: a.id, title: a.title, verdict: a.verdict, label: VERDICT_LABELS[a.verdict],
            reason: a.reason, url: a.url, fetchedAt: a.fetchedAt, fetchedTime: displayTime(a.fetchedAt), sourceTimestamp: a.sourceTimestamp,
            announcedAt: a.announcedAt, affectedText: a.affectedText, fixedText: a.fixedText, fixedVersions: a.fixedVersions,
            pins: a.pins.map(p => ({ ...p, label: VERDICT_LABELS[p.verdict] })), notes: a.notes, suppressions: a.suppressions,
            osv: { lookup: osvView(a.osv.lookup), comparison: a.osv.comparison, note: a.osv.note,
                queryMatches: a.osv.queryMatches.map(q => ({ query: q.query, url: q.url, fetchedAt: q.fetchedAt,
                    fetchedTime: displayTime(q.fetchedAt), state: q.state, id: q.record.id, aliases: q.record.aliases })) },
        })) ?? null,
        queries: project.queries.map(q => ({ query: q.query, source: sourceView(q.result) })),
        osvOnly: { ...project.osvOnly, items: project.osvOnly.items.map(i => ({ id: i.record.id, aliases: i.record.aliases,
                summary: i.record.summary, url: i.url, fetchedAt: i.fetchedAt, fetchedTime: displayTime(i.fetchedAt), state: i.state, query: i.query })) } };
}
/** JSON-only evidence for commands and the required native panel; no HTML or OSV record bodies. */
export function createViewModel(evaluation) {
    const projects = evaluation.projects.map(projectView);
    const counts = { affected: 0, not_affected: 0, unknown: 0, suppressions: evaluation.suppressions?.data?.suppressions.length ?? 0, osvOnly: 0 };
    for (const project of projects) {
        for (const advisory of project.advisories ?? [])
            counts[advisory.verdict]++;
        counts.osvOnly += project.osvOnly.items.length;
    }
    return { diagnostics: collapseNetworkErrors(evaluation), settings: evaluation.settings, counts, projects,
        suppressions: { title: '扫描器报了，但官方说明不适用', source: sourceView(evaluation.suppressions),
            items: evaluation.suppressions?.data?.suppressions.map(s => ({ ...s, fetchedTime: displayTime(s.fetchedAt) })) ?? null },
        guidance: sourceView(evaluation.guidance), flinkPointer: sourceView(evaluation.flinkPointer) };
}
export function summarize(view) {
    return { settings: view.settings, counts: view.counts, projects: view.projects.map(p => ({ ...p,
            total: p.advisories?.length ?? null, truncated: (p.advisories?.length ?? 0) > 20,
            advisories: p.advisories?.slice(0, 20).map(a => ({ id: a.id, verdict: a.verdict, label: a.label, reason: a.reason,
                url: a.url, fetchedAt: a.fetchedAt, fetchedTime: a.fetchedTime, sourceTimestamp: a.sourceTimestamp, announcedAt: a.announcedAt, fixedText: a.fixedText,
                osv: { lookup: a.osv.lookup, comparison: a.osv.comparison, note: a.osv.note } })) ?? null,
            osvOnly: { ...p.osvOnly, total: p.osvOnly.items.length, truncated: p.osvOnly.items.length > 20, items: p.osvOnly.items.slice(0, 20) },
        })), suppressions: { ...view.suppressions, total: view.suppressions.items?.length ?? null,
            truncated: (view.suppressions.items?.length ?? 0) > 20, items: view.suppressions.items?.slice(0, 20) ?? null },
        guidance: view.guidance, flinkPointer: view.flinkPointer };
}
