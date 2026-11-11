import { type HttpClient, type SourceResponse } from './http.js';
import type { FeedCache } from './feeds.js';
export declare function loadFeedCache(directory: string): Promise<FeedCache>;
export declare function parseFeedSnapshot(content: string): FeedCache;
export declare function saveFeedCache(directory: string, cache: FeedCache): Promise<void>;
export interface CacheOptions {
    cache?: FeedCache;
    now?: Date;
    ttlMs?: number;
}
export declare function readCachedSource<T extends {
    sourceTimestamp?: string;
}>(http: HttpClient, url: string, parser: (response: SourceResponse) => Promise<T> | T, options?: CacheOptions): Promise<T & {
    url: string;
    fetchedAt: string;
    cacheStatus: 'ok' | 'cached' | 'stale';
    cacheError?: string;
}>;
export declare function exportFeedSnapshot(directory: string): Promise<string>;
export declare function importFeedSnapshot(directory: string, content: string): Promise<void>;
