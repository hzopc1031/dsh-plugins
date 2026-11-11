import type { HttpClient, SourceResponse } from './http.js';
export declare const PROPOSAL_SOURCES: {
    readonly kafka: "https://cwiki.apache.org/confluence/display/KAFKA/Kafka+Improvement+Proposals";
    readonly flink: "https://cwiki.apache.org/confluence/display/FLINK/Flink+Improvement+Proposals";
};
export declare const KAFKA_DOWNLOADS = "https://kafka.apache.org/community/downloads/";
export interface FeedWindow {
    start: string;
    end: string;
    days: number;
    timezone: 'Asia/Singapore';
    mode: 'rolling';
    label: string;
}
export declare function rollingWindow(now?: Date, days?: number): FeedWindow;
export interface FeedItem {
    project: string;
    kind: 'release' | 'jira' | 'proposal';
    title: string;
    url: string;
    sourceUrl: string;
    date?: string;
    dateBasis?: 'catalogue-day' | 'updated' | 'created' | 'source-date';
    status?: string;
    statusText?: string;
    version?: string;
    key?: string;
    issueType?: string;
    fixVersions?: string[];
    notesUrl?: string;
    notesStatus?: 'found' | 'missing' | 'failed';
}
export interface FeedSource {
    project?: string;
    kind: FeedItem['kind'] | 'release-notes';
    url?: string;
    status: 'ok' | 'cached' | 'stale' | 'failed' | 'unavailable';
    fetchedAt?: string;
    sourceTimestamp?: string;
    error?: string;
    warnings: string[];
}
export interface FeedReport {
    watchList: string[];
    window: FeedWindow;
    sources: FeedSource[];
    items: FeedItem[];
    undatedItems: FeedItem[];
}
export interface FeedCacheEntry extends SourceResponse {
    sourceTimestamp?: string;
}
export type FeedCache = Map<string, FeedCacheEntry>;
interface Parsed<T> {
    data: T;
    sourceTimestamp?: string;
    warnings: string[];
}
export declare function jiraSearchUrl(project: string, window: FeedWindow): string;
export declare function parseJira(payload: string, project: string, url: string): Parsed<FeedItem[]>;
export declare function parseProposals(payload: string, project: 'kafka' | 'flink'): Parsed<FeedItem[]>;
export declare function parseKafkaNotes(payload: string): Parsed<Map<string, string>>;
export declare function collectWatchFeeds(http: HttpClient, options?: {
    watchList?: readonly string[];
    now?: Date;
    days?: number;
    ttlMs?: number;
    cache?: FeedCache;
}): Promise<FeedReport>;
export {};
