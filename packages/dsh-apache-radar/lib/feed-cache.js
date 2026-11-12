import { publicSourceUrl } from './http.js';
import { readLocal, writeLocal } from './local-files.js';
const filename = '.apache-radar-feed-cache.json';
function validate(value) {
    if (!value || typeof value !== 'object')
        throw new Error('Invalid feed cache entry');
    const entry = value;
    if (typeof entry.url !== 'string' || publicSourceUrl(entry.url) !== entry.url
        || typeof entry.payload !== 'string' || Buffer.byteLength(entry.payload) > 8 * 1024 * 1024 || typeof entry.fetchedAt !== 'string' || !Number.isFinite(Date.parse(entry.fetchedAt))
        || (entry.cacheError !== undefined && typeof entry.cacheError !== 'string')
        || (entry.status !== undefined && ![200, 404].includes(entry.status))
        || (entry.status === 404 && !entry.url.startsWith('https://api.osv.dev/v1/vulns/'))
        || (entry.sourceTimestamp !== undefined && typeof entry.sourceTimestamp !== 'string'))
        throw new Error('Invalid feed cache metadata');
    return { url: entry.url, fetchedAt: entry.fetchedAt, payload: entry.payload, sourceTimestamp: entry.sourceTimestamp, ...(entry.cacheError === undefined ? {} : { cacheError: entry.cacheError }), ...(entry.status === undefined ? {} : { status: entry.status }) };
}
export async function loadFeedCache(directory) {
    const content = await readLocal(directory, filename);
    if (content === undefined)
        return new Map();
    return parseFeedSnapshot(content);
}
export function parseFeedSnapshot(content) {
    if (Buffer.byteLength(content) > 32 * 1024 * 1024)
        throw new Error('快照超过 32 MiB');
    const raw = JSON.parse(content);
    if (!Array.isArray(raw))
        throw new Error('Invalid feed cache document');
    const result = new Map();
    for (const value of raw) {
        const entry = validate(value);
        if (result.has(entry.url))
            throw new Error('Duplicate feed cache URL');
        result.set(entry.url, entry);
    }
    return result;
}
export async function saveFeedCache(directory, cache) {
    const entries = [...cache.entries()].map(([url, value]) => {
        const entry = validate(value);
        if (url !== entry.url)
            throw new Error('Feed cache URL mismatch');
        return entry;
    });
    await writeLocal(directory, filename, JSON.stringify(entries));
}
export async function readCachedSource(http, url, parser, options = {}) {
    publicSourceUrl(url);
    const now = options.now ?? new Date();
    const ttlMs = options.ttlMs ?? 3_600_000;
    if (!Number.isFinite(now.getTime()) || !Number.isSafeInteger(ttlMs) || ttlMs < 0)
        throw new Error('Invalid cache clock or TTL');
    const previous = options.cache?.get(url);
    const age = previous ? now.getTime() - Date.parse(previous.fetchedAt) : NaN;
    const parse = async (response) => {
        validate(response);
        if (response.url !== url)
            throw new Error('Cache response URL mismatch');
        const parsed = await parser(response);
        return { ...parsed, url, fetchedAt: response.fetchedAt, sourceTimestamp: parsed.sourceTimestamp ?? response.sourceTimestamp };
    };
    try {
        if (previous && age >= 0 && age < ttlMs)
            return { ...await parse(previous), cacheStatus: previous.cacheError ? 'stale' : 'cached', cacheError: previous.cacheError };
        const response = await http(url);
        const result = await parse(response);
        options.cache?.set(url, { ...response, sourceTimestamp: result.sourceTimestamp });
        return { ...result, cacheStatus: 'ok' };
    }
    catch (cause) {
        const cacheError = `${previous?.cacheError?.startsWith('本地快照') ? '本地快照（导入），非实时抓取；' : ''}${url}: ${cause instanceof Error ? cause.message : String(cause)}`;
        if (previous) {
            try {
                const result = await parse(previous);
                options.cache?.set(url, { ...previous, cacheError });
                return { ...result, cacheStatus: 'stale', cacheError };
            }
            catch {
                throw new Error(`${cacheError}; 上次缓存也不可解析，未使用。`, { cause });
            }
        }
        throw new Error(cacheError, { cause });
    }
}
export async function exportFeedSnapshot(directory) {
    return JSON.stringify([...(await loadFeedCache(directory)).values()]);
}
export async function importFeedSnapshot(directory, content) {
    const incoming = parseFeedSnapshot(content);
    if (!incoming.size)
        throw new Error('快照为空');
    const cache = await loadFeedCache(directory);
    for (const [url, entry] of incoming)
        cache.set(url, { ...entry, cacheError: '本地快照（导入），非实时官方抓取' });
    await saveFeedCache(directory, cache);
}
