import type { HttpClient } from './types.js';
export declare const SOURCES: {
    readonly kafka: "https://kafka.apache.org/community/cve-list/";
    readonly hadoop: "https://hadoop.apache.org/cve_list.html";
    readonly flink: "https://security.apache.org/projects/flink/";
    readonly flinkPointer: "https://flink.apache.org/what-is-flink/security/";
    readonly suppressions: "https://raw.githubusercontent.com/apache/kafka/trunk/gradle/resources/dependencycheck-suppressions.xml";
    readonly guidance: "https://security.apache.org/report-dependency/";
};
export declare const USER_AGENT = "dsh-advisory-impact/0.1.0 (https://github.com/hzopc1031/dsh-plugins)";
export declare class SourceError extends Error {
    readonly url: string;
    constructor(url: string, message: string, options?: ErrorOptions);
}
export declare function assertSourceUrl(url: string): void;
interface HttpOptions {
    fetch?: typeof globalThis.fetch;
    now?: () => Date;
    sleep?: (ms: number) => Promise<unknown>;
    timeoutMs?: number;
    maxBytes?: number;
}
/** Serial anonymous GETs, one bounded 429 retry, no redirects or implicit live requests. */
export declare function createHttpClient(options?: HttpOptions): HttpClient;
export {};
