import type { FeedCache } from './feeds.js';
export declare function loadFeedCache(directory: string): Promise<FeedCache>;
export declare function saveFeedCache(directory: string, cache: FeedCache): Promise<void>;
