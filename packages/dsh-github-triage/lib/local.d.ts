import type { Repo, Item } from './types.js';
export declare const GIT_TIMEOUT = 5000, GIT_OUTPUT: number, LOCAL_TOTAL: number;
export declare class LocalError extends Error {
}
export declare function refValue(ref: string): string;
/** Strict command AND argument shapes. No callers may pass Git global options. */
export declare function gitAllowed(args: readonly string[]): boolean;
export interface GitOptions {
    signal?: AbortSignal;
    timeoutMs?: number;
    maxBytes?: number;
    input?: string;
}
/** Node's real execFile API; shell:false; no Git hooks, diff helpers or lazy object fetch. */
export declare function gitRead(cwd: string, args: readonly string[], options?: GitOptions): Promise<string>;
export interface LocalRepo {
    path?: string;
    sha?: string;
    status: string;
    fingerprint: string;
}
export declare function openLocal(repo: Repo, signal?: AbortSignal): Promise<LocalRepo>;
export interface LocalEvidence {
    status: string;
    commit?: string;
    files: {
        path: string;
        exists: boolean;
        snippet?: string;
    }[];
    evidence: string[];
}
/** Only committed blobs are read: symlinks and dirty worktree files are never followed. */
export declare function localEvidence(local: LocalRepo, item: Item, signal?: AbortSignal): Promise<LocalEvidence>;
/** Only complete simple textual diffs have a trustworthy comparable patch-id. */
export declare function completePatch(item: Item): string | undefined;
