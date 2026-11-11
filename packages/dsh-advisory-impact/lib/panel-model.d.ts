import type { AdvisoryViewModel } from './view-model.js';
export type PanelSource = NonNullable<AdvisoryViewModel['guidance']>;
export declare function sourceExpired(source: PanelSource, ttl: number, now: number): boolean;
/** Counts describe available evidence, never the absence of a failed inventory. */
export declare function panelOverview(view: AdvisoryViewModel, now: number): {
    cards: {
        oldestFetchTime: string | undefined;
        key: string;
        label: string;
        value: number | null;
        partial: boolean;
        sources: {
            url: string;
            state: "error" | "fresh" | "cached" | "stale";
            label: string;
            fetchedAt: string | undefined;
            fetchedTime: string | undefined;
            sourceTimestamp: string | undefined;
            error: string | undefined;
            cacheError: string | undefined;
        }[];
    }[];
    stale: boolean;
    failed: boolean;
};
