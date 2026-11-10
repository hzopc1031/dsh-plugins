/**
 * Pure heartbeat rules: no timers, no I/O, no DSH imports.
 * Every function takes `now` explicitly so tests can drive a fake clock.
 */
export interface Settings {
    /** Master switch. */
    enabled: boolean;
    /** N: minutes between progress cards while a run is active. */
    intervalMinutes: number;
    /** M: minutes without any activity before a silence warning. */
    silenceMinutes: number;
    /** K: consecutive identical tool calls / identical errors before a repeat warning. */
    repeatThreshold: number;
    /** Whether repeated tool detection compares only the tool name (default: name + arguments). */
    repeatByNameOnly: boolean;
    /** Send progress cards (warnings are always sent while enabled). */
    progressCards: boolean;
    /** Also raise an OS notification for warnings. */
    systemNotification: boolean;
    /** Also raise an OS notification for each progress card. */
    notifyProgress: boolean;
    /** Track subagent child sessions too (their cards land in the child session). */
    includeSubagents: boolean;
}
export declare const defaults: Readonly<Settings>;
/** Merge user input over defaults and reject invalid values loudly. */
export declare function resolveSettings(input: Partial<Settings> | undefined): Settings;
/** Normalized activity observed from the session log or agent events. */
export type Activity = {
    kind: 'step';
} | {
    kind: 'model';
} | {
    kind: 'tool-call';
    callId: string;
    name: string;
    argsKey: string;
} | {
    kind: 'tool-result';
    callId: string;
    name: string;
    isError: boolean;
    errorKey?: string;
    errorText?: string;
} | {
    kind: 'retry';
    errorKey: string;
    errorText: string;
    attempt: number;
} | {
    kind: 'error';
    errorKey: string;
    errorText: string;
};
export type AlertKind = 'progress' | 'silence' | 'repeat-tool' | 'repeat-error' | 'finished';
export interface Alert {
    kind: AlertKind;
    /** Card text in Simplified Chinese. */
    text: string;
    /** Short single-line form for OS notifications. */
    short: string;
}
export interface RunState {
    readonly startedAt: number;
    lastActivityAt: number;
    lastActivity: string;
    toolCalls: number;
    toolErrors: number;
    retries: number;
    /** callId -> { name, startedAt } for tools that have not returned yet. */
    inflight: Map<string, {
        name: string;
        startedAt: number;
    }>;
    nextProgressAt: number;
    /** Time of the last silence warning in the current silence episode, if any. */
    silenceWarnedAt: number | undefined;
    toolKey: string | undefined;
    toolStreak: number;
    errorKey: string | undefined;
    errorStreak: number;
    ended: boolean;
}
export declare function startRun(now: number, settings: Settings): RunState;
/** Human duration: 45 秒 / 12 分 3 秒 / 1 小时 5 分. */
export declare function formatDuration(ms: number): string;
/** One-line, length-capped, credential-scrubbed text for cards. */
export declare function clip(value: string, limit?: number): string;
/**
 * Fold one activity into the run. Returns alerts that must be shown now
 * (repeat warnings); progress/silence alerts come from {@link tick}.
 */
export declare function recordActivity(state: RunState, activity: Activity, now: number, settings: Settings): Alert[];
export declare function renderProgress(state: RunState, now: number): Alert;
/**
 * Advance the fake or real clock. Emits at most one progress card per call
 * (missed intervals are skipped, not replayed) and one silence warning per
 * silence period of M minutes.
 */
export declare function tick(state: RunState, now: number, settings: Settings): Alert[];
/** Stop the run; afterwards tick/recordActivity are no-ops. */
export declare function endRun(state: RunState, now: number): Alert;
/** Stable key for "same arguments": raw JSON text, whitespace-insensitive, capped. */
export declare function argumentsKey(raw: string): string;
