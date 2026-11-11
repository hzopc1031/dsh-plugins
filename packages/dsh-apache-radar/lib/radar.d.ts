import { type FeedItem } from './feeds.js';
import { type HttpClient } from './http.js';
export declare function itemSummary(item: FeedItem): {
    project: string;
    kind: "release" | "jira" | "proposal";
    security: boolean;
    id: string;
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
export type RadarAction = 'refresh' | 'counts' | 'watch' | 'brief' | 'open' | 'lookup';
export interface RadarArgs {
    operation?: 'get' | 'add' | 'remove';
    project?: string;
    query?: string;
    includeMarkdown?: boolean;
}
export declare function runRadar(directory: string, action: RadarAction, args?: RadarArgs, options?: {
    http?: HttpClient;
    now?: () => Date;
    watchList?: string[];
    ttlMs?: number;
}): Promise<string>;
