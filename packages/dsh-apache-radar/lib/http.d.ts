import { createIntranetHttp, type IntranetSettings } from './intranet-http.js';
export interface SourceResponse {
    url: string;
    fetchedAt: string;
    payload: string;
    status?: number;
}
export type HttpClient = (url: string) => Promise<SourceResponse>;
export declare const USER_AGENT = "dsh-apache-radar/0.1.1 (+https://github.com/hzopc1031/dsh-plugins)";
export declare function publicSourceUrl(input: string): string;
export declare class HttpError extends Error {
    readonly url: string;
    readonly status: number;
    readonly retryAt?: string | undefined;
    constructor(url: string, status: number, retryAt?: string | undefined);
}
export declare function createHttpClient(options?: {
    fetch?: typeof globalThis.fetch;
    now?: () => Date;
    timeoutMs?: number;
    sleep?: (ms: number) => Promise<unknown>;
} & IntranetSettings): HttpClient & Pick<ReturnType<typeof createIntranetHttp>, 'close' | 'diagnose'>;
