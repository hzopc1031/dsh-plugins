/** Pure mapping from DSH session-log events to heartbeat activities. */
import { type Activity } from './core.js';
export interface Outcome {
    name: string;
    failure?: string;
}
/** Minimal structural view of a `SessionEvent` (see dsh-session `SessionEventMap`). */
export interface LogEvent {
    readonly type: string;
    readonly data: unknown;
}
/**
 * Translate one appended session event. `names` maps callId -> tool name and is
 * updated on `tool/call` so the matching `tool/result` can be attributed.
 * Returns undefined for events that are not heartbeat-relevant.
 */
export declare function activityOf(event: LogEvent, names: Map<string, string>, outcomes?: Map<string, Outcome>): Activity | undefined;
