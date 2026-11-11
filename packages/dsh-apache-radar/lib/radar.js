import { fetchCountsReport } from './counts.js';
import { collectWatchFeeds, isSecurityItem } from './feeds.js';
import { loadFeedCache, saveFeedCache } from './feed-cache.js';
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
    const { watchList, collectedAt } = state;
    if (collectedAt !== undefined && (typeof collectedAt !== 'string' || !Number.isFinite(Date.parse(collectedAt))))
        throw new Error('Invalid collection time');
    return { ...(watchList === undefined ? {} : { watchList: resolveWatchList(watchList) }), collectedAt };
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
    const state = await loadState(directory);
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
            await writeLocal(directory, stateFile, JSON.stringify({ watchList }));
        }
        return JSON.stringify({ watchList, path: await localPath(directory, stateFile) });
    }
    if (action === 'open') {
        const content = await readLocal(directory, '.apache-radar-brief.md');
        if (content === undefined)
            throw new Error(message('errors.noBrief'));
        return JSON.stringify({ path: await localPath(directory, '.apache-radar-brief.md'), ...(args.includeMarkdown === true ? { markdown: content } : {}) });
    }
    const cache = await loadFeedCache(directory);
    const now = options.now?.() ?? new Date();
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
    const dashboard = action === 'dashboard';
    const offline = dashboard && !args.refresh && !args.saveBrief;
    const brief = dashboard ? await readLocal(directory, '.apache-radar-brief.md') : undefined;
    if (offline && !cache.size)
        return JSON.stringify({ watchList, empty: true, markdown: brief });
    const http = offline ? async () => { throw new Error('缓存已过期；点击刷新重试。'); }
        : options.http ?? createHttpClient({ now: options.now });
    const ttlMs = dashboard && args.refresh ? 0 : options.ttlMs;
    const counts = await fetchCountsReport(http, { cache, now, ttlMs });
    if (action === 'counts') {
        await saveFeedCache(directory, cache);
        return JSON.stringify(countsSummary(counts));
    }
    const feeds = await collectWatchFeeds(http, { watchList, now, windowEnd: offline && state.collectedAt ? new Date(state.collectedAt) : undefined, cache, ttlMs });
    if (dashboard) {
        if (!offline) {
            await saveFeedCache(directory, cache);
            await writeLocal(directory, stateFile, JSON.stringify({ ...state, collectedAt: now.toISOString() }));
        }
        const path = args.saveBrief ? await writeWeeklyBrief(directory, counts, feeds, now.toISOString()) : undefined;
        return JSON.stringify({ watchList, counts, sources: feeds.sources, window: feeds.window,
            collectedAt: offline ? state.collectedAt : now.toISOString(), items: feeds.items.map(itemSummary),
            undatedItems: feeds.undatedItems.map(itemSummary), path,
            markdown: args.saveBrief ? await readLocal(directory, '.apache-radar-brief.md') : brief });
    }
    await saveFeedCache(directory, cache);
    await writeLocal(directory, stateFile, JSON.stringify({ ...state, collectedAt: now.toISOString() }));
    const path = action === 'brief' ? await writeWeeklyBrief(directory, counts, feeds, now.toISOString()) : undefined;
    return JSON.stringify({ watchList, window: feeds.window, generatedAt: now.toISOString(), path,
        counts: countsSummary(counts), sources: feeds.sources,
        note: message('collection.note') });
}
