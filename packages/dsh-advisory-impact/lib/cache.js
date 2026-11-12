import { readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isMissing, readLocal, writeLocal } from './local.js';
import { assertOsvRequest, assertSourceUrl, OSV_QUERY_URL } from './http.js';
function validateEntry(entry) {
    if (!entry || typeof entry !== 'object' || typeof entry.url !== 'string')
        throw new Error('Invalid cache entry');
    if (entry.url.startsWith('https://api.osv.dev/'))
        assertOsvRequest(entry.url, entry.query);
    else {
        assertSourceUrl(entry.url);
        if (entry.query !== undefined)
            throw new Error('Invalid cache query');
    }
    if (typeof entry.payload !== 'string' || Buffer.byteLength(entry.payload) > 8 * 1024 * 1024
        || typeof entry.fetchedAt !== 'string' || !Number.isFinite(Date.parse(entry.fetchedAt))
        || ![undefined, 200, 404].includes(entry.status) || entry.status === 404 && (entry.url === OSV_QUERY_URL || !entry.url.startsWith('https://api.osv.dev/'))
        || entry.sourceTimestamp !== undefined && typeof entry.sourceTimestamp !== 'string')
        throw new Error('Invalid cache entry');
}
const cacheKey = (url, query) => createHash('sha256').update(JSON.stringify([url, query ?? null])).digest('hex') + '.json';
/** Plugin-owned directory; hashed request keys never become caller-controlled relative paths. */
export class SourceCache {
    directory;
    http;
    now;
    offlineOnly;
    failures = new Map();
    constructor(directory, http, now = () => new Date(), offlineOnly = false) {
        this.directory = directory;
        this.http = http;
        this.now = now;
        this.offlineOnly = offlineOnly;
    }
    async exportSnapshot() {
        const entries = [];
        let names;
        try {
            names = await readdir(this.directory);
        }
        catch (error) {
            if (isMissing(error))
                return '[]';
            throw error;
        }
        for (const name of names.filter(n => /^[a-f0-9]{64}\.json$/.test(n)).sort()) {
            const entry = JSON.parse(await readLocal(this.directory, name, 32 * 1024 * 1024));
            validateEntry(entry);
            if (cacheKey(entry.url, entry.query) !== name)
                throw new Error('Invalid cache key');
            entries.push(entry);
        }
        const text = JSON.stringify(entries);
        if (Buffer.byteLength(text) > 32 * 1024 * 1024)
            throw new Error('快照超过 32 MiB');
        return text;
    }
    async importSnapshot(text) {
        if (Buffer.byteLength(text) > 32 * 1024 * 1024)
            throw new Error('快照超过 32 MiB');
        const entries = JSON.parse(text);
        if (!Array.isArray(entries) || !entries.length)
            throw new Error('快照为空或格式无效');
        const keys = new Set();
        for (const entry of entries) {
            validateEntry(entry);
            const key = cacheKey(entry.url, entry.query);
            if (keys.has(key))
                throw new Error('快照含重复来源');
            keys.add(key);
        }
        for (const entry of entries)
            await writeLocal(this.directory, cacheKey(entry.url, entry.query), JSON.stringify({ ...entry, imported: true }), true);
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
        const key = cacheKey(url, query);
        let previous;
        let previousData;
        let cacheError;
        try {
            const entry = JSON.parse(await readLocal(this.directory, key, 32 * 1024 * 1024));
            validateEntry(entry);
            if (entry.url !== url || JSON.stringify(entry.query ?? null) !== JSON.stringify(query ?? null))
                throw new Error('Invalid cache entry');
            if (entry.imported)
                cacheError = '本地快照（导入），非实时官方抓取';
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
        if (!force && previous && previousData && age >= 0 && age < ttlMs) {
            const error = this.failures.get(key);
            return { url, state: error !== undefined ? 'stale' : 'cached', data: previousData, fetchedAt: previous.fetchedAt,
                ...(error !== undefined ? { error } : {}), ...extra() };
        }
        try {
            if (this.offlineOnly)
                throw new Error('离线模式：仅使用本地缓存或快照');
            const doc = await this.http(url, query);
            if (doc.url !== url || !Number.isFinite(Date.parse(doc.fetchedAt)))
                throw new Error('Invalid HTTP source metadata');
            const data = parse(doc);
            this.failures.delete(key);
            try {
                await writeLocal(this.directory, key, JSON.stringify({ ...doc, sourceTimestamp: data.sourceTimestamp, ...(query ? { query } : {}) }), true);
            }
            catch (error) {
                cacheError = error instanceof Error ? error.message : 'Cache write failed';
            }
            return { url, state: 'fresh', data, fetchedAt: doc.fetchedAt, ...extra() };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Source fetch failed';
            this.failures.set(key, message);
            return { url, state: previousData ? 'stale' : 'error', data: previousData ?? null,
                ...(previous ? { fetchedAt: previous.fetchedAt } : {}),
                error: message, ...extra() };
        }
    }
}
