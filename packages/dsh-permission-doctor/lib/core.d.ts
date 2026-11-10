/** Pure diagnosis over rc.5 raw session events; never interprets arbitrary output as authority. */
export interface LogEvent {
    readonly seq: number;
    readonly time?: number;
    readonly type: string;
    readonly data: unknown;
}
export interface Fact {
    value: string | null;
    source: string;
}
export interface Permissions {
    preset: Fact;
    sandbox: Fact;
    approval: Fact;
    workspace: Fact;
}
export interface BashFacts {
    mode: string | null;
    denied: boolean | null;
    runnerFailed: boolean;
    exitCode: number | null;
    timedOut: boolean;
    aborted: boolean;
}
export interface LiveObservation {
    callId: string;
    name: string;
    anchor: number;
    time: number;
    permissions?: Permissions;
    bash?: BashFacts;
    message?: string;
}
export interface ApprovalRecord {
    id: string;
    askedSeq: number;
    decidedSeq: number | null;
    outcome: string | null;
    reason: string;
    policy: Fact;
}
export interface Call {
    id: string;
    name: string;
    startSeq: number | null;
    resultSeq: number;
    time: number | null;
    args: unknown;
    content: string;
    isError: boolean;
    error: {
        name: string;
        code: string;
        reason: string;
    };
    permissions: Permissions;
    approvals: ApprovalRecord[];
    live?: LiveObservation;
    integrity: string[];
    candidate: boolean;
}
export type Category = 'rule-denied' | 'sandbox-denied' | 'approval-unavailable' | 'user-rejected' | 'system-error' | 'unknown';
export interface Evidence {
    source: string;
    detail: string;
}
export interface Diagnosis {
    category: Category;
    label: string;
    explanation: string;
    approvalFlow: string;
    evidence: Evidence[];
    suggestions: string[];
}
export declare const labels: Record<Category, string>;
export declare const obj: (v: unknown) => Record<string, unknown>;
export declare const str: (v: unknown) => string;
export declare function emptyPermissions(cwd?: string): Permissions;
/** Keep only the official bash canonical DTO facts; stdout cannot impersonate these fields. */
export declare function bashFacts(name: string, value: unknown): BashFacts | undefined;
/** Best-effort display redaction only. Never serialize full arguments or non-text/media blocks. */
export declare function display(value: string, limit?: number): string;
/** Only explicit path parameters. A shell command is never parsed to guess its targets. */
export declare function targets(args: unknown): string[];
/** Preserve raw-log order. Duplicate IDs are scoped to their start/result interval, never joined by tool name. */
export declare function collectCalls(events: readonly LogEvent[], live?: readonly LiveObservation[], cwd?: string): Call[];
export declare function diagnose(call: Call): Diagnosis;
export declare function render(call: Call): string;
/** Fold only the supplied historical prefix, never today's configuration. */
export declare function permissionsAt(events: readonly LogEvent[], cwd?: string): Permissions;
