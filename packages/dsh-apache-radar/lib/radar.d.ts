import { type FeedItem } from './feeds.js';
import { type HttpClient } from './http.js';
export declare function itemSummary(item: FeedItem): {
    project: string;
    kind: "release" | "jira" | "proposal";
    security: boolean;
    id: string;
    version: string | undefined;
    title: string;
    url: string;
    sourceUrl: string;
    date: string | undefined;
    dateBasis: "catalogue-day" | "updated" | "created" | "source-date" | undefined;
    status: string | undefined;
    statusText: string | undefined;
    issueType: string | undefined;
    fixVersions: string[] | undefined;
    notesUrl: string | undefined;
};
export type RadarAction = 'refresh' | 'counts' | 'watch' | 'brief' | 'open' | 'lookup' | 'dashboard' | 'security' | 'pin' | 'osv' | 'diagnose' | 'export' | 'import';
export interface RadarArgs {
    snapshot?: string;
    version?: string;
    cve?: string;
    operation?: 'get' | 'add' | 'remove';
    project?: string;
    query?: string;
    includeMarkdown?: boolean;
    refresh?: boolean;
    saveBrief?: boolean;
}
export declare function runRadar(directory: string, action: RadarAction, args?: RadarArgs, options?: {
    http?: HttpClient;
    now?: () => Date;
    watchList?: string[];
    ttlMs?: number;
    offlineOnly?: boolean;
    diagnose?: () => Promise<unknown>;
}): Promise<string>;
