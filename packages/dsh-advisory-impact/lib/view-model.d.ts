import type { Evaluation } from './evaluate.js';
import type { SourceResult } from './cache.js';
import type { OsvLookup } from './osv.js';
import type { SourceMetadata, Verdict } from './types.js';
export declare const VERDICT_LABELS: Record<Verdict, string>;
export declare const STATE_LABELS: {
    fresh: string;
    cached: string;
    stale: string;
    error: string;
};
export declare function displayTime(value: string): string;
export declare function sourceView<T extends SourceMetadata>(source: SourceResult<T> | null): {
    url: string;
    state: "error" | "fresh" | "cached" | "stale";
    label: string;
    fetchedAt: string | undefined;
    fetchedTime: string | undefined;
    sourceTimestamp: string | undefined;
    error: string | undefined;
    cacheError: string | undefined;
} | null;
export declare function osvView(source: SourceResult<OsvLookup>): {
    status: string;
    statusLabel: string;
    id: string | undefined;
    aliases: string[];
    url: string;
    state: "error" | "fresh" | "cached" | "stale";
    label: string;
    fetchedAt: string | undefined;
    fetchedTime: string | undefined;
    sourceTimestamp: string | undefined;
    error: string | undefined;
    cacheError: string | undefined;
};
/** JSON-only evidence for commands and the required native panel; no HTML or OSV record bodies. */
export declare function createViewModel(evaluation: Evaluation): {
    settings: import("./config.js").Settings;
    counts: {
        affected: number;
        not_affected: number;
        unknown: number;
        suppressions: number;
        osvOnly: number;
    };
    projects: {
        project: string;
        pins: import("./types.js").VersionPin[];
        error: string | undefined;
        source: {
            url: string;
            state: "error" | "fresh" | "cached" | "stale";
            label: string;
            fetchedAt: string | undefined;
            fetchedTime: string | undefined;
            sourceTimestamp: string | undefined;
            error: string | undefined;
            cacheError: string | undefined;
        } | null;
        notices: string[];
        advisories: {
            id: string;
            title: string;
            verdict: Verdict;
            label: string;
            reason: string;
            url: string;
            fetchedAt: string;
            fetchedTime: string;
            sourceTimestamp: string | undefined;
            announcedAt: string | undefined;
            affectedText: string | null;
            fixedText: string | null;
            fixedVersions: string[] | null;
            pins: {
                label: string;
                pin: import("./types.js").VersionPin;
                verdict: Verdict;
                reason: string;
            }[];
            notes: string[];
            suppressions: import("./types.js").Suppression[];
            osv: {
                lookup: {
                    status: string;
                    statusLabel: string;
                    id: string | undefined;
                    aliases: string[];
                    url: string;
                    state: "error" | "fresh" | "cached" | "stale";
                    label: string;
                    fetchedAt: string | undefined;
                    fetchedTime: string | undefined;
                    sourceTimestamp: string | undefined;
                    error: string | undefined;
                    cacheError: string | undefined;
                };
                comparison: "different_ranges" | "query_disagreement" | "not_compared";
                note: string | undefined;
                queryMatches: {
                    query: import("./types.js").MavenQuery;
                    url: string;
                    fetchedAt: string;
                    fetchedTime: string;
                    state: "error" | "fresh" | "cached" | "stale";
                    id: string;
                    aliases: string[];
                }[];
            };
        }[] | null;
        queries: {
            query: import("./types.js").MavenQuery;
            source: {
                url: string;
                state: "error" | "fresh" | "cached" | "stale";
                label: string;
                fetchedAt: string | undefined;
                fetchedTime: string | undefined;
                sourceTimestamp: string | undefined;
                error: string | undefined;
                cacheError: string | undefined;
            } | null;
        }[];
        osvOnly: {
            items: {
                id: string;
                aliases: string[];
                summary: string | undefined;
                url: string;
                fetchedAt: string;
                fetchedTime: string;
                state: "error" | "fresh" | "cached" | "stale";
                query: import("./types.js").MavenQuery;
            }[];
            title: "\u4EC5\u89C1 OSV\uFF0C\u672A\u89C1\u5B98\u65B9\u516C\u544A";
            inventoryAvailable: boolean;
        };
    }[];
    suppressions: {
        title: string;
        source: {
            url: string;
            state: "error" | "fresh" | "cached" | "stale";
            label: string;
            fetchedAt: string | undefined;
            fetchedTime: string | undefined;
            sourceTimestamp: string | undefined;
            error: string | undefined;
            cacheError: string | undefined;
        } | null;
        items: {
            fetchedTime: string;
            id: string;
            notes: string;
            url: string;
            fetchedAt: string;
            sourceTimestamp?: string;
        }[] | null;
    };
    guidance: {
        url: string;
        state: "error" | "fresh" | "cached" | "stale";
        label: string;
        fetchedAt: string | undefined;
        fetchedTime: string | undefined;
        sourceTimestamp: string | undefined;
        error: string | undefined;
        cacheError: string | undefined;
    } | null;
    flinkPointer: {
        url: string;
        state: "error" | "fresh" | "cached" | "stale";
        label: string;
        fetchedAt: string | undefined;
        fetchedTime: string | undefined;
        sourceTimestamp: string | undefined;
        error: string | undefined;
        cacheError: string | undefined;
    } | null;
};
export type AdvisoryViewModel = ReturnType<typeof createViewModel>;
export declare function summarize(view: AdvisoryViewModel): {
    settings: import("./config.js").Settings;
    counts: {
        affected: number;
        not_affected: number;
        unknown: number;
        suppressions: number;
        osvOnly: number;
    };
    projects: {
        total: number | null;
        truncated: boolean;
        advisories: {
            id: string;
            verdict: Verdict;
            label: string;
            reason: string;
            url: string;
            fetchedAt: string;
            fetchedTime: string;
            sourceTimestamp: string | undefined;
            announcedAt: string | undefined;
            fixedText: string | null;
            osv: {
                lookup: {
                    status: string;
                    statusLabel: string;
                    id: string | undefined;
                    aliases: string[];
                    url: string;
                    state: "error" | "fresh" | "cached" | "stale";
                    label: string;
                    fetchedAt: string | undefined;
                    fetchedTime: string | undefined;
                    sourceTimestamp: string | undefined;
                    error: string | undefined;
                    cacheError: string | undefined;
                };
                comparison: "different_ranges" | "query_disagreement" | "not_compared";
                note: string | undefined;
            };
        }[] | null;
        osvOnly: {
            total: number;
            truncated: boolean;
            items: {
                id: string;
                aliases: string[];
                summary: string | undefined;
                url: string;
                fetchedAt: string;
                fetchedTime: string;
                state: "error" | "fresh" | "cached" | "stale";
                query: import("./types.js").MavenQuery;
            }[];
            title: "\u4EC5\u89C1 OSV\uFF0C\u672A\u89C1\u5B98\u65B9\u516C\u544A";
            inventoryAvailable: boolean;
        };
        project: string;
        pins: import("./types.js").VersionPin[];
        error: string | undefined;
        source: {
            url: string;
            state: "error" | "fresh" | "cached" | "stale";
            label: string;
            fetchedAt: string | undefined;
            fetchedTime: string | undefined;
            sourceTimestamp: string | undefined;
            error: string | undefined;
            cacheError: string | undefined;
        } | null;
        notices: string[];
        queries: {
            query: import("./types.js").MavenQuery;
            source: {
                url: string;
                state: "error" | "fresh" | "cached" | "stale";
                label: string;
                fetchedAt: string | undefined;
                fetchedTime: string | undefined;
                sourceTimestamp: string | undefined;
                error: string | undefined;
                cacheError: string | undefined;
            } | null;
        }[];
    }[];
    suppressions: {
        total: number | null;
        truncated: boolean;
        items: {
            fetchedTime: string;
            id: string;
            notes: string;
            url: string;
            fetchedAt: string;
            sourceTimestamp?: string;
        }[] | null;
        title: string;
        source: {
            url: string;
            state: "error" | "fresh" | "cached" | "stale";
            label: string;
            fetchedAt: string | undefined;
            fetchedTime: string | undefined;
            sourceTimestamp: string | undefined;
            error: string | undefined;
            cacheError: string | undefined;
        } | null;
    };
    guidance: {
        url: string;
        state: "error" | "fresh" | "cached" | "stale";
        label: string;
        fetchedAt: string | undefined;
        fetchedTime: string | undefined;
        sourceTimestamp: string | undefined;
        error: string | undefined;
        cacheError: string | undefined;
    } | null;
    flinkPointer: {
        url: string;
        state: "error" | "fresh" | "cached" | "stale";
        label: string;
        fetchedAt: string | undefined;
        fetchedTime: string | undefined;
        sourceTimestamp: string | undefined;
        error: string | undefined;
        cacheError: string | undefined;
    } | null;
};
