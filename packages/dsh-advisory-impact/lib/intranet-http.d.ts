import z from '@deepseek-ai/schemastery';
export interface IntranetSettings {
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
export declare function createIntranetHttp(settings?: IntranetSettings, env?: NodeJS.ProcessEnv): {
    fetch: typeof globalThis.fetch;
    diagnose: (url?: string) => Promise<{
        proxy: string;
        probes: string;
        dns: unknown;
        tcp: unknown;
        tls: unknown;
    }>;
    route: (url: string) => {
        source: string;
        proxied: boolean;
    };
    close(): Promise<void>;
};
export declare const intranetConfig: {
    [K in keyof Required<IntranetSettings>]: z<Required<IntranetSettings>[K]>;
};
