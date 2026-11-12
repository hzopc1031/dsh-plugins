import type { Dispatcher } from 'undici';
import { type IntranetSettings } from './intranet-http.js';
import { type Scan, type Item } from './types.js';
import { SafeText } from './safety.js';
export type Fetcher = (url: string, init: {
    method: string;
    headers: Record<string, string>;
    signal: AbortSignal;
    redirect: 'error';
    dispatcher?: Dispatcher;
}) => Promise<{
    ok: boolean;
    status: number;
    headers: {
        get(name: string): string | null;
    };
    json(): Promise<unknown>;
}>;
export type GhToken = (signal?: AbortSignal) => Promise<string>;
export declare const ghToken: GhToken;
export declare class GithubError extends Error {
    readonly status: number;
    readonly retryAt?: number | undefined;
    readonly code?: string;
    constructor(status: number, retryAt?: number | undefined, cause?: unknown);
}
export declare class Github {
    #private;
    readonly safe: SafeText;
    get warnings(): string[];
    constructor(options?: {
        safe?: SafeText;
        fetch?: Fetcher;
        env?: NodeJS.ProcessEnv;
        gh?: GhToken;
        timeoutMs?: number;
        maxPages?: number;
        now?: () => number;
        network?: IntranetSettings;
    });
    private auth;
    request<T>(path: string, method?: string, signal?: AbortSignal): Promise<T>;
    private validateQuery;
    graphql<T>(query: string, signal?: AbortSignal): Promise<T>;
    private pages;
    list(repoInput: string, mode: 'issues' | 'prs' | 'both', limit: number, signal?: AbortSignal, scan?: Scan): Promise<Item[]>;
    private issue;
    contents(repo: string, file: string, maxBytes: number, signal?: AbortSignal): Promise<string>;
    private snippets;
    enrich(repo: string, item: Item, signal?: AbortSignal): Promise<Item>;
    /** Extra GET evidence only when a local comparison was explicitly configured. */
    localDetails(repo: string, item: Item, signal?: AbortSignal): Promise<Item>;
    close(): Promise<void>;
}
