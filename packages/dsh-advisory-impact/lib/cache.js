import { createHash } from 'node:crypto';
import { isMissing, readLocal, writeLocal } from './local.js';
import { assertOsvRequest, assertSourceUrl, OSV_QUERY_URL } from './http.js';
/** Plugin-owned directory; hashed request keys never become caller-controlled relative paths. */
export class SourceCache {
    directory;
    http;
    now;
    constructor(directory, http, now = () => new Date()) {
        this.directory = directory;
        this.http = http;
        this.now = now;
    }
    async load(url, parse, ttlMs, force = false, query) {
        if (url.startsWith('https://api.osv.dev/'))
            assertOsvRequest(url, query);
        else {
            assertSourceUrl(url);
            if (query)
                throw new Error('Official sources accept GET only');
        }
        if (query)
            query = { maven: query.maven, version: query.version };
        if (!Number.isSafeInteger(ttlMs) || ttlMs < 0)
            throw new Error('TTL must be a non-negative integer');
        const key = createHash('sha256').update(JSON.stringify([url, query ?? null])).digest('hex') + '.json';
        let previous;
        let previousData;
        let cacheError;
        try {
            const entry = JSON.parse(await readLocal(this.directory, key, 32 * 1024 * 1024));
            if (entry.url !== url || JSON.stringify(entry.query ?? null) !== JSON.stringify(query ?? null)
                || typeof entry.payload !== 'string' || !Number.isFinite(Date.parse(entry.fetchedAt))
                || ![undefined, 200, 404].includes(entry.status) || entry.status === 404 && (url === OSV_QUERY_URL || !url.startsWith('https://api.osv.dev/'))
                || entry.sourceTimestamp !== undefined && typeof entry.sourceTimestamp !== 'string')
                throw new Error('Invalid cache entry');
            previous = { url, payload: entry.payload, fetchedAt: entry.fetchedAt, status: entry.status, sourceTimestamp: entry.sourceTimestamp };
            previousData = parse(previous);
        }
        catch (error) {
            previous = undefined;
            if (!isMissing(error))
                cacheError = error instanceof Error ? error.message : 'Cache read failed';
        }
        const extra = () => cacheError ? { cacheError } : {};
        const age = previous ? this.now().getTime() - Date.parse(previous.fetchedAt) : Infinity;
        if (!force && previous && previousData && age >= 0 && age < ttlMs)
            return { url, state: 'cached', data: previousData, fetchedAt: previous.fetchedAt, ...extra() };
        try {
            const doc = await this.http(url, query);
            if (doc.url !== url || !Number.isFinite(Date.parse(doc.fetchedAt)))
                throw new Error('Invalid HTTP source metadata');
            const data = parse(doc);
            try {
                await writeLocal(this.directory, key, JSON.stringify({ ...doc, sourceTimestamp: data.sourceTimestamp, ...(query ? { query } : {}) }), true);
            }
            catch (error) {
                cacheError = error instanceof Error ? error.message : 'Cache write failed';
            }
            return { url, state: 'fresh', data, fetchedAt: doc.fetchedAt, ...extra() };
        }
        catch (error) {
            return { url, state: previousData ? 'stale' : 'error', data: previousData ?? null,
                ...(previous ? { fetchedAt: previous.fetchedAt } : {}),
                error: error instanceof Error ? error.message : 'Source fetch failed', ...extra() };
        }
    }
}
