import z from '@deepseek-ai/schemastery';
import { type SystemProxyDependencies, type ProxyDetection } from './system-proxy.js';
export interface IntranetSettings {
    systemProxy?: 'auto' | 'off';
    timeoutSeconds?: number;
    httpsProxy?: string;
    noProxy?: string;
    caBundlePath?: string;
    insecureSkipTlsVerify?: boolean;
    insecureSkipTlsVerifyHosts?: boolean;
}
export declare const API_TLS_SKIP_LABEL = "\u4E0D\u5B89\u5168\uFF1A\u4EC5\u8DF3\u8FC7 OSV / GitHub API \u8BC1\u4E66\u6821\u9A8C";
export declare const WEAK_CA_HINT = "\u516C\u53F8\u7F51\u7EDC\u7684 HTTPS \u62E6\u622A\u8BC1\u4E66\u5BC6\u94A5\u592A\u77ED\uFF0C\u65E0\u6CD5\u901A\u8FC7 OpenSSL 3 \u6821\u9A8C\uFF1B\u5BFC\u5165 CA \u8BC1\u4E66\u89E3\u51B3\u4E0D\u4E86\u3002\u53EF\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u5F00\u542F\u300C\u4E0D\u5B89\u5168\uFF1A\u4EC5\u8DF3\u8FC7 OSV / GitHub API \u8BC1\u4E66\u6821\u9A8C\u300D\uFF08\u4EC5\u9650 api.osv.dev / api.github.com\uFF09\u3002";
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
        tlsVerification: {
            host: string;
            skipped: boolean;
        };
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
    [K in Exclude<keyof Required<IntranetSettings>, 'insecureSkipTlsVerifyHosts'>]: z<Required<IntranetSettings>[K]>;
} & {
    insecureSkipTlsVerifyHosts: z<boolean, boolean, 'volatile-defined'>;
};
