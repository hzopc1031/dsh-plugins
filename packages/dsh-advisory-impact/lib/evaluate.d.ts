import { type Settings } from './config.js';
import { SourceCache, type SourceResult } from './cache.js';
import { OsvClient, type OsvAnnotation, type OsvQueryResult, type OsvRecord } from './osv.js';
import type { AdvisoryPage, MavenQuery, OfficialVerdict, ProjectVerdicts, ReferencePage, SuppressionPage, VersionPin } from './types.js';
export interface OsvOnlyItem {
    record: OsvRecord;
    url: string;
    fetchedAt: string;
    state: SourceResult<OsvQueryResult>['state'];
    query: MavenQuery;
}
export interface EvaluatedProject {
    project: string;
    pins: VersionPin[];
    source: SourceResult<AdvisoryPage> | null;
    verdicts: (Omit<ProjectVerdicts, 'advisories'> & {
        advisories: (OfficialVerdict & {
            osv: OsvAnnotation;
        })[];
    }) | null;
    queries: {
        query: MavenQuery;
        result: SourceResult<OsvQueryResult>;
    }[];
    osvOnly: {
        title: '仅见 OSV，未见官方公告';
        items: OsvOnlyItem[];
        inventoryAvailable: boolean;
    };
    error?: string;
}
export interface Evaluation {
    settings: Settings;
    projects: EvaluatedProject[];
    suppressions: SourceResult<SuppressionPage> | null;
    guidance: SourceResult<ReferencePage> | null;
    flinkPointer: SourceResult<ReferencePage> | null;
}
export interface EvaluateOptions {
    config?: unknown;
    projectDirectory?: string;
    cache: SourceCache;
    osv: OsvClient;
    force?: boolean;
}
/** Shared, model-free pipeline. Only the injected cache transports can perform HTTP. */
export declare function evaluatePins(options: EvaluateOptions): Promise<Evaluation>;
