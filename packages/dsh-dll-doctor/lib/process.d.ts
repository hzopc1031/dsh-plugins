import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess';
export type Runner = (argv: readonly string[], signal?: AbortSignal) => Promise<string>;
export type ProcessService = Pick<SubprocessRuntime, 'spawn'>;
export declare const OUTPUT_LIMIT: number;
/** Only fixed argument arrays reach the service; no shell, no spill files. */
export declare function runBounded(service: ProcessService, argv: readonly string[], cwd: string, signal?: AbortSignal, timeoutMs?: number, maxBytes?: number): Promise<string>;
export declare const FALLBACK_KNOWN: string[];
export declare function parseKnownDLLs(text: string): Set<string>;
export interface KnownDLLs {
    names: Set<string>;
    source: 'registry' | 'fallback';
}
export declare function knownDLLs(run: Runner, windows: string, signal?: AbortSignal): Promise<KnownDLLs>;
/** Dependencies -json -imports emits { Imports: [{ Name, ImportList: [...] }] }. */
export declare function parseDependencies(text: string): string[];
export declare function supplement(run: Runner, executable: string, file: string, signal?: AbortSignal): Promise<string[]>;
