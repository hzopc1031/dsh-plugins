export interface NetworkSettingsProps {
    view?: 'summary' | 'page';
    endpoint?: string;
}
export declare const networkHint: (code: string) => "公司证书密钥过短；请在「网络 / 设置」核对 OSV / GitHub API 的证书校验选项。" | "证书校验失败；请在「网络 / 设置」配置公司 CA。" | "来源连接失败；请在「网络 / 设置」检查代理或运行诊断。";
export declare function NetworkSettings({ view, endpoint }: NetworkSettingsProps): "网络设置" | import("react").DetailedReactHTMLElement<{
    className: string;
    'aria-label': string;
}, HTMLElement>;
