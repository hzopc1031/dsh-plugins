import { SourceCache, type SourceResult } from './cache.js';
import type { MavenQuery, OfficialVerdict, SourceDocument, SourceMetadata } from './types.js';
export interface OsvRecord {
    id: string;
    aliases: string[];
    summary?: string;
    modified?: string;
    affected: Record<string, unknown>[];
}
export interface OsvLookup extends SourceMetadata {
    status: 'found' | 'not_indexed';
    label: 'OSV 第二来源' | 'OSV 未收录 / HTTP 404';
    record: OsvRecord | null;
}
export interface OsvQueryResult extends SourceMetadata {
    records: OsvRecord[];
}
export interface OsvAnnotation {
    lookup: SourceResult<OsvLookup>;
    comparison: 'different_ranges' | 'query_disagreement' | 'not_compared';
    note?: string;
    queryMatches: {
        query: MavenQuery;
        url: string;
        fetchedAt: string;
        state: SourceResult<OsvQueryResult>['state'];
        record: OsvRecord;
    }[];
}
export declare function parseOsvRecord(value: unknown): OsvRecord;
export declare function parseOsvLookup(id: string, doc: SourceDocument): OsvLookup;
export declare function parseOsvQuery(doc: SourceDocument): OsvQueryResult;
export declare class OsvClient {
    readonly cache: SourceCache;
    constructor(cache: SourceCache);
    lookup(id: string, ttlMs: number, force?: boolean): Promise<SourceResult<OsvLookup>>;
    query(query: MavenQuery, ttlMs: number, force?: boolean): Promise<SourceResult<OsvQueryResult>>;
}
export declare const identities: (record: OsvRecord) => string[];
/** Compare explicit numeric boundary wording only; no OSV-derived affected/not-affected verdict. */
export declare function rangeDifference(official: OfficialVerdict, record: OsvRecord | null): boolean;
