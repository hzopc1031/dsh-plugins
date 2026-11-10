export type Presence = 'yes' | 'no' | 'unknown' | 'not-applicable';
export type Category = 'project' | 'global' | 'runtime' | 'skill' | 'other';
export interface ObservedMessage {
    seq: number;
    time: number;
    role: string;
    body: string;
    source: Record<string, unknown>;
    current: boolean;
    baseline?: boolean;
}
export interface FileFact {
    key: string;
    path: string;
    category: Category;
    exists: Presence;
    note?: string;
}
export interface RuleVersion {
    id: string;
    key: string;
    label: string;
    category: Category;
    producer: string;
    scope?: string;
    path?: string;
    role: string;
    seq: number;
    time: number;
    body: string;
    digest: string;
    declaredDigest?: string;
    action: 'set' | 'replace' | 'remove';
    current: boolean;
    lifecycle: 'active' | 'superseded' | 'removed' | 'not-retained';
    bodyQuality: 'rendered' | 'partial' | 'ambiguous';
    note?: string;
}
export interface RuleRow {
    key: string;
    label: string;
    category: Category;
    fileExists: Presence;
    fileNote?: string;
    everInjected: boolean;
    currentContext: boolean;
    versions: RuleVersion[];
}
export interface ConflictSide {
    versionId: string;
    source: string;
    category: Category;
    role: string;
    seq: number;
    digest: string;
    current: boolean;
    lifecycle: RuleVersion['lifecycle'];
    line: number;
    quote: string;
}
export interface SuspectedConflict {
    label: '疑似冲突';
    topic: string;
    window: 'current' | 'historical';
    left: ConflictSide;
    right: ConflictSide;
    explanation: string;
    suggestion: string;
}
export interface Report {
    capturedThroughSeq: number;
    rows: RuleRow[];
    conflicts: SuspectedConflict[];
    notices: string[];
    analysis: {
        limited: boolean;
        eligibleVersions: number;
        inspectedVersions: number;
        checks: number;
    };
    limitations: string[];
}
export declare const hash: (body: string) => string;
export declare function categoryOf(source: Record<string, unknown>, scope?: string, path?: string): Category;
export declare function instructionKey(scope: string): string;
/** Only structured sources enable workspace parsing; text alone cannot impersonate a producer. */
export declare function extractVersions(m: ObservedMessage): RuleVersion[];
interface Directive {
    topic: string;
    polarity: 'require' | 'forbid';
    line: number;
    quote: string;
}
/** Deliberately bounded template heuristic, never a language-wide satisfiability claim. */
export declare function directives(body: string): Directive[];
export interface ConflictScan {
    conflicts: SuspectedConflict[];
    limited: boolean;
    eligibleVersions: number;
    inspectedVersions: number;
    checks: number;
}
export declare function scanConflicts(versions: readonly RuleVersion[], includeHistory?: boolean): ConflictScan;
export declare function detectConflicts(versions: readonly RuleVersion[], includeHistory?: boolean): SuspectedConflict[];
export declare function buildReport(messages: readonly ObservedMessage[], files?: readonly FileFact[], includeHistory?: boolean, capturedThroughSeq?: number): Report;
export declare function renderReport(report: Report, includeHistory?: boolean): string;
export {};
