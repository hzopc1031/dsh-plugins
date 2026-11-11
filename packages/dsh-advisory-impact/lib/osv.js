import { OSV_QUERY_URL, osvUrl } from './http.js';
const object = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export function parseOsvRecord(value) {
    if (!object(value) || typeof value.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(value.id)
        || value.aliases !== undefined && (!Array.isArray(value.aliases) || !value.aliases.every(a => typeof a === 'string'))
        || value.summary !== undefined && typeof value.summary !== 'string'
        || value.modified !== undefined && (typeof value.modified !== 'string' || !Number.isFinite(Date.parse(value.modified)))
        || value.affected !== undefined && (!Array.isArray(value.affected) || !value.affected.every(object)))
        throw new Error('Invalid OSV record');
    return { id: value.id, aliases: value.aliases ?? [],
        ...(value.summary ? { summary: value.summary } : {}), ...(value.modified ? { modified: value.modified } : {}),
        affected: value.affected ?? [] };
}
export function parseOsvLookup(id, doc) {
    if (doc.url !== osvUrl(id) || !Number.isFinite(Date.parse(doc.fetchedAt)))
        throw new Error('Invalid OSV lookup metadata');
    const meta = { url: doc.url, fetchedAt: doc.fetchedAt };
    if (doc.status === 404)
        return { ...meta, status: 'not_indexed', label: 'OSV 未收录 / HTTP 404', record: null };
    if (doc.status !== 200)
        throw new Error('Unexpected OSV lookup status');
    const record = parseOsvRecord(JSON.parse(doc.payload));
    if (![record.id, ...record.aliases].includes(id))
        throw new Error('OSV record does not match requested id');
    return { ...meta, ...(record.modified ? { sourceTimestamp: record.modified } : {}), status: 'found', label: 'OSV 第二来源', record };
}
export function parseOsvQuery(doc) {
    if (doc.url !== OSV_QUERY_URL || doc.status !== 200 || !Number.isFinite(Date.parse(doc.fetchedAt)))
        throw new Error('Invalid OSV query metadata');
    const value = JSON.parse(doc.payload);
    if (!object(value) || value.vulns !== undefined && !Array.isArray(value.vulns)
        || Object.keys(value).some(k => k !== 'vulns'))
        throw new Error('Invalid or unsupported OSV query response');
    return { url: doc.url, fetchedAt: doc.fetchedAt, records: (value.vulns ?? []).map(parseOsvRecord) };
}
export class OsvClient {
    cache;
    constructor(cache) {
        this.cache = cache;
    }
    lookup(id, ttlMs, force = false) {
        return this.cache.load(osvUrl(id), doc => parseOsvLookup(id, doc), ttlMs, force);
    }
    query(query, ttlMs, force = false) {
        return this.cache.load(OSV_QUERY_URL, parseOsvQuery, ttlMs, force, query);
    }
}
export const identities = (record) => [record.id, ...record.aliases];
/** Compare explicit numeric boundary wording only; no OSV-derived affected/not-affected verdict. */
export function rangeDifference(official, record) {
    if (!record || !official.ranges)
        return false;
    const ranges = [];
    const extract = (events) => {
        if (!Array.isArray(events))
            return;
        let lower;
        for (const event of events) {
            if (!object(event))
                continue;
            if (typeof event.introduced === 'string')
                lower = event.introduced === '0' ? '0.0' : event.introduced;
            const upper = event.fixed ?? event.last_affected;
            if (lower && typeof upper === 'string' && /^\d+(?:\.\d+)+$/.test(lower) && /^\d+(?:\.\d+)+$/.test(upper)) {
                ranges.push(`${lower}|${upper}|${event.fixed === undefined}`);
                lower = undefined;
            }
        }
    };
    for (const affected of record.affected) {
        if (!Array.isArray(affected.ranges))
            continue;
        for (const range of affected.ranges) {
            if (!object(range))
                continue;
            if (['SEMVER', 'ECOSYSTEM'].includes(String(range.type)))
                extract(range.events);
            const database = range.database_specific;
            if (object(database) && Array.isArray(database.extracted_events)) {
                for (const entry of database.extracted_events)
                    if (object(entry))
                        extract(entry.range);
            }
        }
    }
    const canonical = (values) => [...new Set(values)].sort().join('\n');
    return ranges.length > 0 && canonical(ranges) !== canonical(official.ranges.map(r => `${r.lower}|${r.upper}|${r.upperInclusive}`));
}
