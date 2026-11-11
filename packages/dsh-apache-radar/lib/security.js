import { readCachedSource } from './feed-cache.js';
import { SOURCES, osvUrl } from './advisory/http.js';
import { parseAdvisories, parseSuppressions, parseDependencyGuidance, parseFlinkPointer } from './advisory/fetchers.js';
import { evaluateProject } from './advisory/verdicts.js';
import { parseOsvLookup, rangeDifference } from './advisory/osv.js';
export function validatePin(value) {
    if (typeof value !== 'string' || value.length > 200 || /[\x00-\x1f\x7f]/.test(value))
        throw new Error('无效的运行版本。');
    return value.trim();
}
export function validatePins(value) {
    if (value === undefined)
        return {};
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Invalid version pins');
    return Object.fromEntries(Object.entries(value).map(([project, version]) => {
        if (!/^[a-z][a-z0-9-]*$/.test(project))
            throw new Error('Invalid pin project');
        const pin = validatePin(version);
        if (!pin)
            throw new Error('Empty saved version pin');
        return [project, pin];
    }));
}
async function source(http, url, parser, options) {
    try {
        const { cacheStatus, cacheError, ...data } = await readCachedSource(http, url, parser, { ...options, ttlMs: options.offline ? Number.MAX_SAFE_INTEGER : options.ttlMs });
        const expired = options.offline && (options.now?.getTime() ?? Date.now()) - Date.parse(data.fetchedAt) >= (options.ttlMs ?? 3_600_000);
        return { url, fetchedAt: data.fetchedAt, sourceTimestamp: data.sourceTimestamp, status: expired ? 'stale' : cacheStatus, error: cacheError ?? (expired ? '缓存已过期；点击刷新重试。' : undefined), data: data };
    }
    catch (cause) {
        return { url, status: 'failed', error: cause instanceof Error ? cause.message : String(cause), data: null };
    }
}
// Only cached OSV lookups are refreshed in bulk; an expanded row requests its own second-source lookup.
export async function collectSecurity(http, watch, pins, firstSeen, options = {}) {
    const report = { projects: [] };
    if (watch.includes('kafka')) {
        report.suppressions = await source(http, SOURCES.suppressions, parseSuppressions, options);
        report.guidance = await source(http, SOURCES.guidance, parseDependencyGuidance, options);
    }
    if (watch.includes('flink'))
        report.flinkPointer = await source(http, SOURCES.flinkPointer, parseFlinkPointer, options);
    for (const project of watch) {
        const item = { project, pin: Object.hasOwn(pins, project) ? pins[project] : undefined, advisories: [], notices: [] };
        report.projects.push(item);
        if (!['kafka', 'hadoop', 'flink'].includes(project)) {
            item.error = '尚未支持该项目的官方公告来源，无法判断。';
            continue;
        }
        const id = project;
        item.source = await source(http, SOURCES[id], doc => parseAdvisories(id, doc), options);
        const page = item.source.data;
        if (!page) {
            item.error = item.source.error;
            continue;
        }
        item.notices = page.notices;
        const verdicts = evaluateProject(page, item.pin ? [{ version: item.pin }] : [], report.suppressions?.data ?? undefined);
        for (const advisory of verdicts.advisories) {
            if (id === 'kafka' && !report.suppressions?.data && item.pin) {
                advisory.verdict = 'unknown';
                advisory.reason = 'Kafka 官方 suppressions 来源不可用，无法排除官方不适用说明，暂无法判断';
                advisory.pins = advisory.pins.map(p => ({ ...p, verdict: 'unknown', reason: advisory.reason }));
            }
            const key = `${id}:${advisory.id}`;
            firstSeen[key] ??= options.now?.toISOString() ?? page.fetchedAt;
            const url = osvUrl(advisory.id);
            const osv = options.cache?.has(url) || options.lookup === advisory.id
                ? await source(http, url, doc => parseOsvLookup(advisory.id, doc), options)
                : { url, status: 'unqueried', data: null };
            item.advisories.push({ ...advisory, firstSeen: firstSeen[key], osv, osvDifference: rangeDifference(advisory, osv.data?.record ?? null) });
        }
    }
    return report;
}
export function announcedTime(value) {
    if (!value)
        return undefined;
    const numeric = value.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?: \([^()]*\))?$/);
    const named = value.match(/^(\d{1,2}) ([A-Za-z]{3,9}) (\d{4})$/);
    const year = numeric?.[1] ?? named?.[3];
    const month = numeric ? Number(numeric[2]) : named ? 'january february march april may june july august september october november december'.split(' ').findIndex(month => month === named[2].toLowerCase() || month.slice(0, 3) === named[2].toLowerCase()) + 1 : 0;
    const day = numeric?.[3] ?? named?.[1];
    if (!year || !month || !day)
        return undefined;
    const date = `${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`;
    const parsed = Date.parse(`${date}T00:00:00+08:00`);
    return Number.isFinite(parsed) && new Date(parsed + 8 * 3_600_000).toISOString().slice(0, 10) === date ? new Date(parsed).toISOString() : undefined;
}
export function newAdvisories(report, window) {
    return report.projects.flatMap(p => p.advisories.flatMap(a => {
        const date = announcedTime(a.announcedAt) ?? a.firstSeen;
        return Date.parse(date) >= Date.parse(window.start) && Date.parse(date) <= Date.parse(window.end)
            ? [{ ...a, windowDate: date, dateBasis: announcedTime(a.announcedAt) ? '官方公告日期' : '本地首次发现（非发布日期）', pin: p.pin }] : [];
    }));
}
export function securitySummary(report, project, query) {
    const projects = report.projects.filter(p => !project || p.project === project).map(p => {
        const matches = p.advisories.filter(a => !query || `${a.id} ${a.title}`.toLowerCase().includes(query.toLowerCase()));
        return { project: p.project, pin: p.pin, error: p.error, notices: p.notices,
            source: p.source && { url: p.source.url, fetchedAt: p.source.fetchedAt, status: p.source.status, error: p.source.error },
            counts: !p.source?.data ? null : { affected: p.advisories.filter(a => a.verdict === 'affected').length, not_affected: p.advisories.filter(a => a.verdict === 'not_affected').length, unknown: p.advisories.filter(a => a.verdict === 'unknown').length },
            advisories: matches.slice(0, 20).map(({ id, title, verdict, reason, affectedText, fixedText, url, fetchedAt, sourceTimestamp }) => ({ id, title, verdict, reason, affectedText, fixedText, url, fetchedAt, sourceTimestamp })), hasMore: matches.length > 20 };
    });
    return { projects, suppressions: report.suppressions && { url: report.suppressions.url, fetchedAt: report.suppressions.fetchedAt, status: report.suppressions.status, error: report.suppressions.error, items: report.suppressions.data?.suppressions.map(({ id, notes }) => ({ id, notes })), guidanceUrl: SOURCES.guidance }, note: '仅按官方范围匹配运行版本；无 pin 为无法判断；OSV 仅为第二来源，suppressions 单列；不是生产安全或升级结论。' };
}
