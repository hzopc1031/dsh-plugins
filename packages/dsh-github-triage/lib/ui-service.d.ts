import type { Repo, State, Settings, Report } from './types.js';
import { type Reply, type ModelStatus, type UiScan } from './ui-contract.js';
import type { SafeText } from './safety.js';
interface Dependencies {
    config: Settings;
    state: () => State;
    save: (s: State) => Promise<void>;
    safe: SafeText;
    serialize: <T>(f: () => Promise<T>) => Promise<T>;
    validate: (r: Repo) => Promise<void>;
    perform: (r: Repo, limit: number, scheduled: boolean, signal: AbortSignal, scan: UiScan) => Promise<Report>;
    signal: AbortSignal;
    model: () => ModelStatus;
    models: () => Promise<string>;
}
/** Shares the command/timer queue and storage domain; no extra HTTP listener. */
export declare function uiService(d: Dependencies): (input: unknown) => Promise<Reply>;
export {};
