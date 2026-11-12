import { collapseNetworkErrors } from './intranet-http.js';
import { collectSecurity, validatePin, validatePins, securitySummary } from './security.js';
import { fetchCountsReport } from './counts.js';
import { collectWatchFeeds, isSecurityItem } from './feeds.js';
import { loadFeedCache, saveFeedCache, exportFeedSnapshot, importFeedSnapshot } from './feed-cache.js';
import { writeWeeklyBrief } from './brief.js';
import { createHttpClient } from './http.js';
import { localPath, readLocal, writeLocal } from './local-files.js';
import { resolveWatchList } from './watch.js';
import { message } from './messages.js';
const stateFile = '.apache-radar-state.json';
async function loadState(directory) {
    const text = await readLocal(directory, stateFile);
    if (text === undefined)
        return {};
    const state = JSON.parse(text);
    if (!state || typeof state !== 'object' || Array.isArray(state))
        throw new Error('Invalid radar state');
    const { watchList, collectedAt, pins, advisoryFirstSeen } = state;
    if (advisoryFirstSeen !== undefined && (!advisoryFirstSeen || typeof advisoryFirstSeen !== 'object' || Array.isArray(advisoryFirstSeen)
        || Object.entries(advisoryFirstSeen).some(([key, time]) => !/^[a-z][a-z0-9-]*:CVE-\d{4}-\d{4,}$/.test(key) || typeof time !== 'string' || !Number.isFinite(Date.parse(time)))))
        throw new Error('Invalid advisory first-seen state');
    if (collectedAt !== undefined && (typeof collectedAt !== 'string' || !Number.isFinite(Date.parse(collectedAt))))
        throw new Error('Invalid collection time');
    return { ...(watchList === undefined ? {} : { watchList: resolveWatchList(watchList) }), collectedAt, pins: validatePins(pins), advisoryFirstSeen: advisoryFirstSeen ?? {} };
}
function countsSummary(report) {
    const member = ({ id, name }) => ({ id, name });
    return { ...report, comparisons: report.comparisons.map(c => c.status === 'error' ? c
            : { ...c, onlyLeft: c.onlyLeft.map(member), onlyRight: c.onlyRight.map(member) }), categories: report.categories.status === 'ok'
            ? { ...report.categories, rows: report.categories.rows.map(({ members: _members, ...row }) => row) } : report.categories };
}
// Explicit projection keeps future upstream issue bodies out of model-visible lookup results.
export function itemSummary(item) {
    return { project: item.project, kind: item.kind, security: isSecurityItem(item), id: item.key ?? item.version ?? item.url, version: item.version,
        title: item.title, url: item.url, sourceUrl: item.sourceUrl, date: item.date, dateBasis: item.dateBasis,
        status: item.status, statusText: item.statusText, issueType: item.issueType, fixVersions: item.fixVersions, notesUrl: item.notesUrl };
}
export async function runRadar(directory, action, args = {}, options = {}) {
    if (action === 'diagnose')
        return JSON.stringify(await options.diagnose?.() ?? { error: '网络诊断不可用' });
    if (action === 'export')
        return exportFeedSnapshot(directory);
    const state = await loadState(directory);
    if (action === 'import') {
        if (typeof args.snapshot !== 'string')
            throw new Error('请选择 JSON 快照');
        await importFeedSnapshot(directory, args.snapshot);
        const imported = await loadFeedCache(directory);
        state.collectedAt = [...imported.values()].map(e => e.fetchedAt).sort((a, b) => Date.parse(b) - Date.parse(a))[0];
        await writeLocal(directory, stateFile, JSON.stringify(state));
    }
    const watchList = resolveWatchList(state.watchList ?? options.watchList);
    if (action === 'watch') {
        const operation = args.operation ?? 'get';
        if (!['get', 'add', 'remove'].includes(operation))
            throw new Error('Invalid watch operation');
        if (operation !== 'get') {
            const project = resolveWatchList([args.project])[0];
            if (operation === 'add' && !watchList.includes(project))
                watchList.push(project);
            if (operation === 'remove') {
                const index = watchList.indexOf(project);
                if (index !== -1)
                    watchList.splice(index, 1);
            }
            await writeLocal(directory, stateFile, JSON.stringify({ ...state, watchList, collectedAt: undefined }));
        }
        return JSON.stringify({ watchList, path: await localPath(directory, stateFile) });
    }
    if (action === 'pin') {
        const project = resolveWatchList([args.project])[0];
        if (!watchList.includes(project))
            throw new Error(message('errors.unwatched'));
        const pin = validatePin(args.version);
        const pins = { ...state.pins };
        if (pin)
            pins[project] = pin;
        else
            delete pins[project];
        await writeLocal(directory, stateFile, JSON.stringify({ ...state, pins }));
        return JSON.stringify({ project, pin: pins[project] });
    }
    if (action === 'open') {
        const content = await readLocal(directory, '.apache-radar-brief.md');
        if (content === undefined)
            throw new Error(message('errors.noBrief'));
        return JSON.stringify({ path: await localPath(directory, '.apache-radar-brief.md'), ...(args.includeMarkdown === true ? { markdown: content } : {}) });
    }
    const cache = await loadFeedCache(directory);
    const now = options.now?.() ?? new Date();
    if (options.offlineOnly && !cache.size && action !== 'dashboard')
        throw new Error('离线模式没有可用缓存，请先导入本地快照。');
    if (options.offlineOnly) {
        options = { ...options, http: async () => { throw new Error('离线模式：仅使用本地缓存或快照'); }, ttlMs: Number.MAX_SAFE_INTEGER };
    }
    if (action === 'lookup') {
        if (!state.collectedAt)
            throw new Error(message('errors.noCollection'));
        if (args.project && !watchList.includes(args.project))
            throw new Error(message('errors.unwatched'));
        const feeds = await collectWatchFeeds(async () => { throw new Error(message('lookup.offline')); }, {
            watchList, now, windowEnd: new Date(state.collectedAt), cache, ttlMs: Number.MAX_SAFE_INTEGER,
        });
        for (const source of feeds.sources) {
            if (source.fetchedAt && now.getTime() - Date.parse(source.fetchedAt) >= (options.ttlMs ?? 3_600_000)) {
                source.status = 'stale';
                source.error = message('lookup.expired');
            }
        }
        const query = (args.query ?? '').trim().toLowerCase();
        if (!query)
            throw new Error(message('errors.query'));
        const matches = [...feeds.items, ...feeds.undatedItems].filter(item => (!args.project || item.project === args.project)
            && `${item.key ?? ''} ${item.version ?? ''} ${item.title} ${item.statusText ?? ''} ${(item.fixVersions ?? []).join(' ')}`.toLowerCase().includes(query));
        return JSON.stringify({ collectedAt: state.collectedAt, window: feeds.window, items: matches.slice(0, 20).map(itemSummary),
            hasMore: matches.length > 20, sources: feeds.sources, note: message('lookup.note') });
    }
    const firstSeen = { ...state.advisoryFirstSeen };
    if (action === 'security' || action === 'osv') {
        if (args.project && !watchList.includes(args.project))
            throw new Error(message('errors.unwatched'));
        if (action === 'osv' && (!args.cve || !/^CVE-\d{4}-\d{4,}$/.test(args.cve)))
            throw new Error('无效 CVE id。');
        const offline = async () => { throw new Error('请先刷新官方来源。'); };
        const security = await collectSecurity(offline, watchList, state.pins ?? {}, firstSeen, { cache, now, ttlMs: options.ttlMs, offline: true });
        if (action === 'osv') {
            if (!security.projects.some(p => p.advisories.some(a => a.id === args.cve)))
                throw new Error('CVE 不在已采集的官方列表中。');
            const target = args.cve;
            const http = options.http ?? createHttpClient({ now: options.now });
            await collectSecurity(url => url.endsWith('/' + target) ? http(url) : offline(), watchList, state.pins ?? {}, firstSeen, { cache, now, ttlMs: Number.MAX_SAFE_INTEGER, lookup: target });
            await saveFeedCache(directory, cache);
        }
        return JSON.stringify(securitySummary(security, args.project, args.query));
    }
    const dashboard = action === 'dashboard' || action === 'import';
    const offline = options.offlineOnly || dashboard && !args.refresh && !args.saveBrief;
    const brief = dashboard ? await readLocal(directory, '.apache-radar-brief.md') : undefined;
    if (offline && !cache.size)
        return JSON.stringify({ watchList, pins: state.pins ?? {}, empty: true, markdown: brief });
    const http = offline ? async () => { throw new Error('缓存已过期；点击刷新重试。'); }
        : options.http ?? createHttpClient({ now: options.now });
    const ttlMs = options.offlineOnly || action === 'import' ? Number.MAX_SAFE_INTEGER : dashboard && args.refresh ? 0 : options.ttlMs;
    const counts = await fetchCountsReport(http, { cache, now, ttlMs });
    if (action === 'counts') {
        await saveFeedCache(directory, cache);
        return JSON.stringify(countsSummary(counts));
    }
    const feeds = await collectWatchFeeds(http, { watchList, now, windowEnd: offline && state.collectedAt ? new Date(state.collectedAt) : undefined, cache, ttlMs });
    const security = await collectSecurity(http, watchList, state.pins ?? {}, firstSeen, { cache, now, ttlMs, offline });
    if (dashboard) {
        if (!offline) {
            await saveFeedCache(directory, cache);
            await writeLocal(directory, stateFile, JSON.stringify({ ...state, advisoryFirstSeen: firstSeen, collectedAt: now.toISOString() }));
        }
        const path = args.saveBrief ? await writeWeeklyBrief(directory, counts, feeds, now.toISOString(), security) : undefined;
        const diagnostics = collapseNetworkErrors({ counts, sources: feeds.sources, security });
        return JSON.stringify({ diagnostics, localSnapshot: [...cache.values()].some(e => e.cacheError?.startsWith('本地快照')), watchList, security, pins: state.pins ?? {}, counts, sources: feeds.sources, window: feeds.window,
            collectedAt: offline ? state.collectedAt : now.toISOString(), items: feeds.items.map(itemSummary),
            undatedItems: feeds.undatedItems.map(itemSummary), path,
            markdown: args.saveBrief ? await readLocal(directory, '.apache-radar-brief.md') : brief });
    }
    await saveFeedCache(directory, cache);
    await writeLocal(directory, stateFile, JSON.stringify({ ...state, advisoryFirstSeen: firstSeen, collectedAt: now.toISOString() }));
    const path = action === 'brief' ? await writeWeeklyBrief(directory, counts, feeds, now.toISOString(), security) : undefined;
    return JSON.stringify({ watchList, window: feeds.window, generatedAt: now.toISOString(), path,
        counts: countsSummary(counts), security: securitySummary(security), sources: feeds.sources,
        note: message('collection.note') });
}
