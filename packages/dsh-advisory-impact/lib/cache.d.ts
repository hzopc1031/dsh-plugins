import type { HttpClient, MavenQuery, SourceDocument, SourceMetadata } from './types.js';
export interface SourceResult<T> {
    url: string;
    state: 'fresh' | 'cached' | 'stale' | 'error';
    data: T | null;
    fetchedAt?: string;
    error?: string;
    cacheError?: string;
}
/** Plugin-owned directory; hashed request keys never become caller-controlled relative paths. */
export declare class SourceCache {
    readonly directory: string;
    private readonly http;
    private readonly now;
    private readonly failures;
    constructor(directory: string, http: HttpClient, now?: () => Date);
    load<T extends SourceMetadata>(url: string, parse: (doc: SourceDocument) => T, ttlMs: number, force?: boolean, query?: MavenQuery): Promise<SourceResult<T>>;
}
