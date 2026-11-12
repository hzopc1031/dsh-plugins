export declare const SYSTEM_PROXY_TTL: number;
export interface WindowsProxySettings {
    AutoConfigURL?: string;
    ProxyEnable?: number;
    ProxyServer?: string;
    ProxyOverride?: string;
}
export interface ProxyDetection {
    source: 'Windows PAC' | '静态系统代理' | '未检测到';
    pacUrl?: string;
    proxy?: string;
    warning?: string;
    detectedAt: string;
    ttlSeconds: number;
    automatic?: boolean;
    timeoutSeconds?: number;
    note?: string;
}
export interface SystemProxyDependencies {
    platform?: string;
    query?: () => Promise<string>;
    readSettings?: () => Promise<WindowsProxySettings>;
    fetchPac?: (url: string) => Promise<string>;
    resolve?: (host: string) => Promise<string | null>;
    now?: () => number;
    cacheDirectory?: string;
}
export declare function readWindowsProxy(deps?: SystemProxyDependencies): Promise<WindowsProxySettings>;
export declare function fetchPacDirect(input: string): Promise<string>;
export declare function displayProxy(input: string): string;
export declare function parsePacResult(result: string): {
    proxy?: string;
    warning?: string;
};
export declare function evaluatePac(script: string, input: string, deps?: SystemProxyDependencies): Promise<{
    proxy?: string;
    warning?: string;
}>;
export declare function createSystemProxy(deps?: SystemProxyDependencies): {
    clear(): Promise<void>;
    detect(input: string): Promise<{
        proxy?: string;
        info: ProxyDetection;
    }>;
};
export declare const systemProxy: {
    clear(): Promise<void>;
    detect(input: string): Promise<{
        proxy?: string;
        info: ProxyDetection;
    }>;
};
