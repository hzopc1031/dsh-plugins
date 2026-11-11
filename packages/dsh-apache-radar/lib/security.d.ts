import { type CacheOptions } from './feed-cache.js';
import type { HttpClient } from './http.js';
import { type OsvLookup } from './advisory/osv.js';
import type { AdvisoryPage, OfficialVerdict, ProjectId, ReferencePage, SuppressionPage } from './advisory/types.js';
import type { FeedWindow } from './feeds.js';
export type SecuritySource<T> = {
    url: string;
    fetchedAt?: string;
    sourceTimestamp?: string;
    status: 'ok' | 'cached' | 'stale' | 'failed' | 'unqueried';
    error?: string;
    data: T | null;
};
export type SecurityAdvisory = OfficialVerdict & {
    firstSeen: string;
    osv: SecuritySource<OsvLookup>;
    osvDifference: boolean;
};
export interface ProjectSecurity {
    project: string;
    pin?: string;
    source?: SecuritySource<AdvisoryPage>;
    advisories: SecurityAdvisory[];
    notices: string[];
    error?: string;
}
export interface SecurityReport {
    projects: ProjectSecurity[];
    suppressions?: SecuritySource<SuppressionPage>;
    guidance?: SecuritySource<ReferencePage>;
    flinkPointer?: SecuritySource<ReferencePage>;
}
export declare function validatePin(value: unknown): string;
export declare function validatePins(value: unknown): Record<string, string>;
export declare function collectSecurity(http: HttpClient, watch: string[], pins: Record<string, string>, firstSeen: Record<string, string>, options?: CacheOptions & {
    lookup?: string;
    offline?: boolean;
}): Promise<SecurityReport>;
export declare function announcedTime(value?: string): string | undefined;
export declare function newAdvisories(report: SecurityReport, window: FeedWindow): {
    windowDate: string;
    dateBasis: string;
    pin: string | undefined;
    verdict: import("./advisory/types.js").Verdict;
    reason: string;
    ranges: import("./advisory/types.js").VersionRange[] | null;
    fixedVersions: string[] | null;
    pins: import("./advisory/types.js").PinVerdict[];
    suppressions: import("./advisory/types.js").Suppression[];
    id: string;
    project: ProjectId;
    title: string;
    products: string[];
    affectedText: string | null;
    fixedText: string | null;
    announcedAt?: string;
    notes: string[];
    url: string;
    fetchedAt: string;
    sourceTimestamp?: string;
    firstSeen: string;
    osv: SecuritySource<OsvLookup>;
    osvDifference: boolean;
}[];
export declare function securitySummary(report: SecurityReport, project?: string, query?: string): {
    projects: {
        project: string;
        pin: string | undefined;
        error: string | undefined;
        notices: string[];
        source: {
            url: string;
            fetchedAt: string | undefined;
            status: "ok" | "cached" | "stale" | "failed" | "unqueried";
            error: string | undefined;
        } | undefined;
        counts: {
            affected: number;
            not_affected: number;
            unknown: number;
        } | null;
        advisories: {
            id: string;
            title: string;
            verdict: import("./advisory/types.js").Verdict;
            reason: string;
            affectedText: string | null;
            fixedText: string | null;
            url: string;
            fetchedAt: string;
            sourceTimestamp: string | undefined;
        }[];
        hasMore: boolean;
    }[];
    suppressions: {
        url: string;
        fetchedAt: string | undefined;
        status: "ok" | "cached" | "stale" | "failed" | "unqueried";
        error: string | undefined;
        items: {
            id: string;
            notes: string;
        }[] | undefined;
        guidanceUrl: "https://security.apache.org/report-dependency/";
    } | undefined;
    note: string;
};
