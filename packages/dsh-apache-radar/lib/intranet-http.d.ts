import z from '@deepseek-ai/schemastery';
import { type SystemProxyDependencies, type ProxyDetection } from './system-proxy.js';
export interface IntranetSettings {
    systemProxy?: 'auto' | 'off';
    timeoutSeconds?: number;
    httpsProxy?: string;
    noProxy?: string;
    caBundlePath?: string;
    insecureSkipTlsVerify?: boolean;
}
export declare const NETWORK_HINT = "\u53EF\u80FD\u662F\u516C\u53F8\u4EE3\u7406\u6216\u7F51\u7EDC\u62E6\u622A\uFF0C\u53EF\u5728\u63D2\u4EF6\u8BBE\u7F6E\u91CC\u586B\u5199 HTTPS \u4EE3\u7406\uFF0C\u6216\u628A HTTPS_PROXY \u5199\u5165 %USERPROFILE%\\.dsh\\.env \u540E\u5B8C\u5168\u9000\u51FA\u5E76\u91CD\u5F00 DSH";
export declare function describeNetworkError(error: unknown, _url?: string): {
    code: string;
    message: string;
    hintZh: string;
};
export declare function collapseNetworkErrors(value: unknown): {
    code: string;
    hintZh: string;
    count: number;
}[];
export declare function effectiveTimeout(settings?: IntranetSettings): number;
export declare function fetchOfficial(fetcher: typeof globalThis.fetch, input: string, init: RequestInit, hosts: ReadonlySet<string>): Promise<Response>;
export declare function createIntranetHttp(settings?: IntranetSettings, env?: NodeJS.ProcessEnv, dependencies?: SystemProxyDependencies): {
    fetch: typeof globalThis.fetch;
    diagnose: (url?: string) => Promise<{
        systemProxy: ProxyDetection | undefined;
        timeoutSeconds: number;
        proxy: string;
        probes: string;
        dns: unknown;
        tcp: unknown;
        tls: unknown;
    }>;
    detectProxy: (url?: string, refresh?: boolean) => Promise<ProxyDetection>;
    proxyStatus: () => {
        automatic: boolean;
        source: "Windows PAC" | "\u9759\u6001\u7CFB\u7EDF\u4EE3\u7406" | "\u672A\u68C0\u6D4B\u5230";
        pacUrl?: string;
        proxy?: string;
        warning?: string;
        detectedAt: string;
        ttlSeconds: number;
        timeoutSeconds?: number;
        note?: string;
    } | undefined;
    route: (url: string) => {
        source: string;
        proxied: boolean;
    };
    close(): Promise<void>;
};
export declare const intranetConfig: {
    [K in keyof Required<IntranetSettings>]: z<Required<IntranetSettings>[K]>;
};
