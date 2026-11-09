export interface Call {
    id: string;
    name: string;
    args: string;
    paths: string[];
    started: number;
    duration: number | null;
    status: 'success' | 'failure' | 'pending';
    changes: Change[];
}
export interface Change {
    path: string;
    kind: '新建' | '修改' | '删除' | '变更（类型不可用）';
}
export interface Segment {
    goal: string;
    calls: Call[];
    changes: Change[];
    started: number;
    ended: number;
    usage: string;
    outcome: string;
    from: number;
    to: number;
}
export interface Settings {
    auto: boolean;
    toolThreshold: number;
    fileThreshold: number;
    durationMinutes: number;
    reportDir: string;
}
export declare const defaults: Settings;
/** Redact before truncation, persistence, path extraction or retry comparison. */
export declare function redact(value: unknown, depth?: number): unknown;
export declare function text(value: unknown, limit?: number): string;
export declare function summary(value: unknown): string;
/** Arbitrary source, scripts and payload bodies cannot be safely summarized as credentials. */
export declare function argumentSummary(value: unknown): string;
export declare function pathsFrom(value: unknown): string[];
export declare function eligible(s: Segment, c: Settings): boolean;
export declare function filename(goal: string, now: number): string;
export declare function reportDirectory(cwd: string | undefined, dir: string): string;
export declare function archive(dir: string, goal: string, now: number, markdown: string): Promise<string>;
export declare function render(s: Segment): string;
