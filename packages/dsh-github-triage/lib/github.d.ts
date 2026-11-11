import { type Dispatcher } from 'undici';
import { type Item } from './types.js';
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
    constructor(status: number, retryAt?: number | undefined);
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
    });
    private auth;
    request<T>(path: string, method?: string, signal?: AbortSignal): Promise<T>;
    private validateQuery;
    graphql<T>(query: string, signal?: AbortSignal): Promise<T>;
    private pages;
    list(repoInput: string, mode: 'issues' | 'prs' | 'both', limit: number, signal?: AbortSignal): Promise<Item[]>;
    private issue;
    enrich(repo: string, item: Item, signal?: AbortSignal): Promise<Item>;
    close(): Promise<void>;
}
