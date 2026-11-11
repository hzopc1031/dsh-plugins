import { fetchChooser, fetchCommittees, fetchPodlings, fetchPublicPodlings, fetchRetiredCommittees, fetchRetiredProjects, fetchAtticProjects } from './fetchers.js';
import type { HttpClient } from './http.js';
declare const fetchers: {
    chooser: typeof fetchChooser;
    committees: typeof fetchCommittees;
    podlings: typeof fetchPodlings;
    publicPodlings: typeof fetchPublicPodlings;
    retired: typeof fetchRetiredCommittees;
    retiredProjects: typeof fetchRetiredProjects;
    attic: typeof fetchAtticProjects;
};
type SourceKey = keyof typeof fetchers;
type Result<K extends SourceKey> = Awaited<ReturnType<(typeof fetchers)[K]>>;
export interface SourceFailure {
    error: string;
}
export type CountSources = {
    [K in SourceKey]?: Result<K> | SourceFailure;
};
export interface Citation {
    url: string;
    fetchedAt: string | null;
    fetchedAtDisplay: string | null;
    sourceTimestamp?: string;
}
export interface Member {
    id: string;
    name: string;
}
interface Evidence {
    id: string;
    label: string;
    sources: Citation[];
}
export type CountRow = Evidence & {
    note: string;
} & ({
    status: 'ok';
    value: number;
} | {
    status: 'error';
    error: string;
});
export type Comparison = Evidence & {
    note: string;
} & ({
    status: 'match' | 'mismatch';
    onlyLeft: Member[];
    onlyRight: Member[];
} | {
    status: 'error';
    error: string;
});
export type Categories = Evidence & ({
    status: 'ok';
    official: true;
    multiLabel: true;
    rows: (CountRow & {
        members: Member[];
    })[];
} | {
    status: 'error';
    error: string;
});
export interface CountsReport {
    timezone: 'Asia/Singapore';
    explanation: string;
    counts: CountRow[];
    retired: CountRow[];
    comparisons: Comparison[];
    categories: Categories;
}
export declare function singaporeTime(timestamp: string): string;
export declare function buildCountsReport(inputs: CountSources): CountsReport;
export declare function fetchCountsReport(http: HttpClient): Promise<CountsReport>;
export declare function renderCountsMarkdown(report: CountsReport): string;
export {};
