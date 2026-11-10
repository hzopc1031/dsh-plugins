export type Selector = {
    kind: 'markdown-lines';
    start: number;
    end: number;
} | {
    kind: 'markdown-quote';
    text: string;
} | {
    kind: 'csv-key';
    keyColumn: string;
    keyValue: string;
    columns: string[];
};
export interface Output {
    path: string;
    kind: 'table' | 'section' | 'report';
    locator: string;
    label: string;
}
export interface Registration {
    id: string;
    source: string;
    selector: Selector;
    conclusion: {
        id: string;
        text: string;
    };
    outputs: Output[];
    recheck: string;
}
export interface Reference extends Registration {
    baseline: {
        versionHash: string;
        citationHash: string;
        excerpt: string;
    };
}
export interface Registry {
    schemaVersion: 1;
    references: Reference[];
}
export type Status = '来源版本已变化' | '引用内容已变化' | '需要人工复核';
export interface Impact {
    reference: Reference;
    sourceVersionChanged: boolean | null;
    citationContentChanged: boolean | null;
    needsManualReview: boolean;
    statuses: Status[];
    current: {
        versionHash: string | null;
        citationHash: string | null;
        excerpt: string | null;
    };
    reason: string | null;
}
export type Observation = {
    text: string;
} | {
    error: string;
};
export interface Scan {
    scanId: string;
    impacts: Impact[];
    affected: {
        conclusions: Registration['conclusion'][];
        outputs: Output[];
    };
}
export interface RecheckTask {
    referenceId: string;
    source: string;
    selector: Selector;
    conclusion: Registration['conclusion'];
    outputs: Output[];
    statuses: Status[];
    evidence: {
        baseline: Reference['baseline'];
        current: Impact['current'];
    };
    steps: string[];
}
export interface RecheckPlan {
    schemaVersion: 1;
    scanId: string;
    selectedIds: string[];
    instruction: string;
    tasks: RecheckTask[];
}
export declare class ImpactError extends Error {
}
export declare function fail(message: string): never;
export declare function hash(text: string): string;
export declare function normalize(text: string): string;
export declare function object(value: unknown): Record<string, unknown>;
export declare function validId(value: unknown): string;
/** Portable project-relative paths; resolve/realpath containment is also enforced by store. */
export declare function localPath(value: unknown): string;
export declare function parseRegistration(value: unknown): Registration;
/** Strict comma-separated UTF-8 CSV: supports quoted commas, escaped quotes and multiline cells. */
export declare function parseCsv(raw: string): string[][];
export declare function extract(raw: string, selector: Selector): string;
export declare function emptyRegistry(): Registry;
export declare function register(registry: Registry, input: unknown, raw: string): Registry;
export declare function parseRegistry(value: unknown): Registry;
export declare function compare(reference: Reference, observation: Observation): Impact;
export declare function analyze(registry: Registry, observations: ReadonlyMap<string, Observation>): Scan;
export declare function createPlan(scan: Scan, selectedIds: readonly string[], expectedScanId: string): RecheckPlan;
export declare function renderScan(scan: Scan): string;
