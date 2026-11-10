import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess';
import type { ProjectFile } from './paths.js';
export declare const TIMEOUT_MS = 15000;
export declare const STDOUT_LIMIT = 65536;
export declare const STDERR_LIMIT = 8192;
export interface Holder {
    readonly name: string;
    readonly pid: number;
    readonly applicationType: number;
    readonly serviceName: string;
}
export interface Observation {
    readonly observedAt: string;
    readonly processes: readonly Holder[];
}
export declare function parseOutput(output: string): Observation;
export declare function queryHolders(runtime: Pick<SubprocessRuntime, 'spawn'>, target: ProjectFile, options: {
    signal: AbortSignal;
    platform?: NodeJS.Platform;
    timeoutMs?: number;
}): Promise<Observation>;
