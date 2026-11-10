import { type ChildProcess, type SpawnOptions } from 'node:child_process';
export type CaptureResult = 'success' | 'cancelled' | 'save-failed' | 'failed' | 'timeout';
export interface CaptureJob {
    readonly done: Promise<CaptureResult>;
    cancel(): void;
}
export type CaptureRunner = (file: string) => CaptureJob;
export type SpawnCapture = (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess;
export declare function exitResult(code: number | null): CaptureResult;
export declare function logError(event: string): void;
export declare function capture(file: string, options?: {
    spawn?: SpawnCapture;
    timeoutMs?: number;
    log?: (event: string) => void;
}): CaptureJob;
