import { fetchCountsReport } from './counts.js';
import { collectWatchFeeds, isSecurityItem } from './feeds.js';
import { loadFeedCache, saveFeedCache } from './feed-cache.js';
import { writeWeeklyBrief } from './brief.js';
import { createHttpClient } from './http.js';
import { localPath, readLocal, writeLocal } from './local-files.js';
import { resolveWatchList } from './watch.js';
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
    return { project: item.project, kind: item.kind, security: isSecurityItem(item), id: item.key ?? item.version ?? item.url,
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
            throw new Error('尚无本地周报，请先生成 brief。');
        return JSON.stringify({ path: await localPath(directory, '.apache-radar-brief.md'), ...(args.includeMarkdown === true ? { markdown: content } : {}) });
    }
    const cache = await loadFeedCache(directory);
    const now = options.now?.() ?? new Date();
    if (action === 'lookup') {
        if (!state.collectedAt)
            throw new Error('尚无已采集动态，请先 refresh 或 brief。');
        if (args.project && !watchList.includes(args.project))
            throw new Error('查询项目不在关注列表中。');
        const feeds = await collectWatchFeeds(async () => { throw new Error('仅查询已采集数据；此来源需另行刷新。'); }, {
            watchList, now: new Date(state.collectedAt), cache, ttlMs: Number.MAX_SAFE_INTEGER,
        });
        for (const source of feeds.sources) {
            if (source.fetchedAt && now.getTime() - Date.parse(source.fetchedAt) >= (options.ttlMs ?? 3_600_000)) {
                source.status = 'stale';
                source.error = '缓存已过期；仅查询已采集数据，未发起刷新。';
            }
        }
        const query = (args.query ?? '').trim().toLowerCase();
        if (!query)
            throw new Error('请输入条目 id、版本或标题关键词。');
        const matches = [...feeds.items, ...feeds.undatedItems].filter(item => (!args.project || item.project === args.project)
            && `${item.key ?? ''} ${item.version ?? ''} ${item.title} ${item.statusText ?? ''} ${(item.fixVersions ?? []).join(' ')}`.toLowerCase().includes(query));
        return JSON.stringify({ collectedAt: state.collectedAt, window: feeds.window, items: matches.slice(0, 20).map(itemSummary),
            hasMore: matches.length > 20, sources: feeds.sources, note: '仅查找已采集的带链接条目；日期未知项不是本周新增。未匹配不表示没有更新；不作兼容性或生产升级判断。' });
    }
    const http = options.http ?? createHttpClient({ now: options.now });
    const counts = await fetchCountsReport(http, { cache, now, ttlMs: options.ttlMs });
    if (action === 'counts') {
        await saveFeedCache(directory, cache);
        return JSON.stringify(countsSummary(counts));
    }
    const feeds = await collectWatchFeeds(http, { watchList, now, cache, ttlMs: options.ttlMs });
    await saveFeedCache(directory, cache);
    await writeLocal(directory, stateFile, JSON.stringify({ ...state, collectedAt: now.toISOString() }));
    const path = action === 'brief' ? await writeWeeklyBrief(directory, counts, feeds, now.toISOString()) : undefined;
    return JSON.stringify({ watchList, window: feeds.window, generatedAt: now.toISOString(), path,
        counts: countsSummary(counts), sources: feeds.sources,
        note: '保留各来源失败与旧缓存时间；日期未知提案不计作本周新增。使用 lookup 查找已采集条目，open 查看周报。' });
}
