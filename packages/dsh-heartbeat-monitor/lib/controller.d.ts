/**
 * Clock-injected run tracker shared by the plugin and the tests. It owns no
 * timers and no DSH objects: the caller feeds status changes, log events and
 * ticks, and receives alerts through `deliver`.
 */
import { type Alert, type Settings } from './core.js';
import { type LogEvent } from './events.js';
export interface ControllerDeps {
    readonly settings: Settings;
    readonly now: () => number;
    /** Show an alert for one tracked session. */
    readonly deliver: (sessionId: string, alert: Alert) => void;
}
export declare class HeartbeatController {
    private readonly deps;
    private readonly runs;
    constructor(deps: ControllerDeps);
    /** Whether any run is active (the plugin only keeps a timer while true). */
    get active(): boolean;
    isTracking(sessionId: string): boolean;
    /** `running` starts a run (idempotent); `idle` ends it. */
    status(sessionId: string, status: 'running' | 'idle'): void;
    /** Feed one appended session-log event. */
    event(sessionId: string, event: LogEvent): void;
    /** Advance every active run to the current clock. */
    tick(): void;
    /** On-demand card for `/heartbeat`; undefined when the session is not running. */
    snapshot(sessionId: string): Alert | undefined;
    /** Drop everything (plugin disposal); no closing cards. */
    clear(): void;
}
