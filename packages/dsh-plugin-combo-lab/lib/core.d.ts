/** Evidence is operator supplied. This module never drives or inspects a desktop. */
export type Surface = 'input' | 'sidebar' | 'session-menu';
export type CheckKind = 'tools' | 'commands' | 'shortcut' | 'panel' | 'persistence';
export type RunId = 'baseline' | 'a' | 'b' | 'ab' | 'ba';
export type Source = 'desktop-manual' | 'headless' | 'static';
export type Outcome = 'pass' | 'fail' | 'blocked' | 'unsupported';
export type Status = 'pending-desktop' | 'unable-to-automate' | 'desktop-pass' | 'desktop-fail' | 'blocked' | 'non-desktop-only';
export interface PluginRef {
    name: string;
    version: string;
}
export interface Environment {
    platform: 'win32';
    client: 'official-desktop';
    version: string;
    machine: string;
}
export interface PlanInput {
    plugins: [PluginRef, PluginRef];
    environment: Environment;
    workspace: string;
    configBaseline: string;
}
export interface Check {
    id: string;
    surface: Surface;
    kind: CheckKind;
    instructions: string;
}
export interface Run {
    id: RunId;
    enabled: PluginRef[];
    instructions: string;
}
export interface Step {
    id: string;
    run: RunId;
    check: string;
}
export interface Plan extends PlanInput {
    id: string;
    createdAt: string;
    checks: Check[];
    runs: Run[];
    steps: Step[];
}
export interface Observation {
    stepId: string;
    source: Source;
    outcome: Outcome;
    evidence: string;
    observer: string;
    observedAt: string;
    enabled: PluginRef[];
    environment?: Environment;
    restart?: {
        before: string;
        after: string;
        fullyExited: true;
    };
}
export interface Study {
    schemaVersion: 1;
    plan: Plan;
    observations: Observation[];
}
export interface Reduction {
    check: string;
    order: 'ab' | 'ba';
    verdict: 'awaiting-pair' | 'pair-passes' | 'needs-controls' | 'environment-failure' | 'single-failure' | 'minimal-pair';
    minimal: PluginRef[] | null;
    next: string[];
    reproduction: string[];
}
export interface ComparisonRow {
    stepId: string;
    before: Status;
    after: Status;
    change: 'regression' | 'fixed' | 'unchanged' | 'inconclusive';
}
export interface Comparison {
    comparable: boolean;
    reasons: string[];
    versions: {
        before: PluginRef[];
        after: PluginRef[];
    };
    rows: ComparisonRow[];
}
export declare function object(value: unknown): Record<string, unknown>;
export declare function string(value: unknown, label: string, max?: number): string;
export declare function timestamp(value: unknown): string;
export declare function identifier(value: unknown): string;
export declare const checks: readonly Check[];
export declare function createPlan(value: unknown, id: string, createdAt: string): Study;
export declare function validateObservation(plan: Plan, value: unknown): Observation;
export declare function record(study: Study, value: unknown): Study;
/** Reconstruct the plan from authoritative inputs; never trust imported checks or derived results. */
export declare function parseStudy(value: unknown): Study;
export declare function latest(study: Study, stepId: string): Observation | undefined;
export declare function status(study: Study, stepId: string): Status;
export declare function reduce(study: Study, check: string, order?: 'ab' | 'ba'): Reduction;
export declare function compare(before: Study, after: Study): Comparison;
export declare const labels: Record<Status, string>;
export declare function renderStudy(study: Study): string;
export declare function observationTemplate(study: Study, stepId: string, now: string): Observation;
