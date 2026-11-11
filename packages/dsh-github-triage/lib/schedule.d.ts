import type { Schedule } from './types.js';
/** Latest due slot; callers inject now and commit lastRun only after success. */
export declare function dueSlot(schedule: Schedule | undefined, lastRun: number | undefined, now: number): number | undefined;
