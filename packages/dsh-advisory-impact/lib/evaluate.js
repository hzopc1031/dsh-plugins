import { loadSettings } from './config.js';
import { parseAdvisories, parseSuppressions, parseFlinkPointer, parseDependencyGuidance } from './fetchers.js';
import { SOURCES } from './http.js';
import { identities, rangeDifference } from './osv.js';
import { evaluateProject } from './verdicts.js';
/** Shared, model-free pipeline. Only the injected cache transports can perform HTTP. */
export async function evaluatePins(options) {
    const settings = await loadSettings(options.config, options.projectDirectory);
    const { cache, osv, force = false } = options;
    const ttl = settings.cacheTtlMs;
    const suppressions = settings.watch.includes('kafka') ? await cache.load(SOURCES.suppressions, parseSuppressions, ttl, force) : null;
    const guidance = settings.watch.includes('kafka') ? await cache.load(SOURCES.guidance, parseDependencyGuidance, ttl, force) : null;
    const flinkPointer = settings.watch.includes('flink') ? await cache.load(SOURCES.flinkPointer, parseFlinkPointer, ttl, force) : null;
    const projects = [];
    // Keep all public requests bounded and serial, including when transports are supplied by callers.
    for (const project of settings.watch) {
        const pins = settings.pins.filter(p => p.project === project).map(({ project: _, ...pin }) => pin);
        const item = { project, pins, source: null, verdicts: null, queries: [],
            osvOnly: { title: '仅见 OSV，未见官方公告', items: [], inventoryAvailable: false } };
        projects.push(item);
        if (!['kafka', 'hadoop', 'flink'].includes(project)) {
            item.error = '尚未配置该项目的官方来源，无法判断';
            continue;
        }
        const id = project;
        item.source = await cache.load(SOURCES[id], doc => parseAdvisories(id, doc), ttl, force);
        const page = item.source.data;
        if (!page) {
            item.error = item.source.error;
            continue;
        }
        item.osvOnly.inventoryAvailable = true;
        const official = evaluateProject(page, pins, suppressions?.data ?? undefined);
        if (id === 'kafka' && !suppressions?.data && pins.length) {
            const reason = 'Kafka 官方 suppressions 来源不可用，无法排除官方不适用说明，暂无法判断';
            official.advisories = official.advisories.map(a => ({ ...a, verdict: 'unknown', reason,
                pins: a.pins.map(p => ({ ...p, verdict: 'unknown', reason })) }));
        }
        for (const pin of pins) {
            if (!pin.maven)
                continue;
            const query = { maven: pin.maven, version: pin.version };
            if (item.queries.some(q => q.query.maven === query.maven && q.query.version === query.version))
                continue;
            item.queries.push({ query, result: await osv.query(query, ttl, force) });
        }
        const known = new Set([...page.advisories.map(a => a.id), ...(id === 'kafka' ? suppressions?.data?.suppressions.map(s => s.id) ?? [] : [])]);
        for (const { query, result } of item.queries) {
            for (const record of result.data?.records ?? []) {
                if (identities(record).some(identity => known.has(identity)))
                    continue;
                item.osvOnly.items.push({ record, url: result.url, fetchedAt: result.data.fetchedAt, state: result.state, query });
            }
        }
        const advisories = [];
        for (const advisory of official.advisories) {
            const lookup = await osv.lookup(advisory.id, ttl, force);
            const queryMatches = [];
            for (const { query, result } of item.queries) {
                for (const record of result.data?.records ?? []) {
                    if (identities(record).includes(advisory.id))
                        queryMatches.push({ query, url: result.url, fetchedAt: result.data.fetchedAt, state: result.state, record });
                }
            }
            const queryDisagreement = queryMatches.some(({ query }) => advisory.pins.some(p => p.pin.maven === query.maven
                && p.pin.version === query.version && p.verdict === 'not_affected'));
            const comparison = queryDisagreement ? 'query_disagreement'
                : rangeDifference(advisory, lookup.data?.record ?? null) ? 'different_ranges' : 'not_compared';
            advisories.push({ ...advisory, osv: { lookup, comparison,
                    ...(comparison === 'query_disagreement' ? { note: 'OSV Maven 查询命中，但该 pin 的官方判定为不受影响；两者并列保留，请核对组件和范围' }
                        : comparison === 'different_ranges' ? { note: 'OSV 与官方的范围表述不同；官方判定保持不变，请分别核对组件和范围' } : {}), queryMatches } });
        }
        item.verdicts = { ...official, advisories };
    }
    return { settings, projects, suppressions, guidance, flinkPointer };
}
