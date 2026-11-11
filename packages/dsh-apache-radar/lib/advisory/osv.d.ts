import type { OfficialVerdict, SourceDocument, SourceMetadata } from './types.js';
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
export declare function parseOsvRecord(value: unknown): OsvRecord;
export declare function parseOsvLookup(id: string, doc: SourceDocument): OsvLookup;
/** Compare explicit numeric boundary wording only; no OSV-derived affected/not-affected verdict. */
export declare function rangeDifference(official: OfficialVerdict, record: OsvRecord | null): boolean;
