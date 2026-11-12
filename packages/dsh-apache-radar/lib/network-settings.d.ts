export interface NetworkSettingsProps {
    view?: 'summary' | 'page';
    form?: {
        state: {
            value?: Record<string, unknown>;
            writable: boolean;
            revision?: number;
        };
        mutate(ops: {
            op: 'set';
            path: string[];
            value: boolean;
        }[], revision?: number): Promise<boolean>;
    };
}
export declare function NetworkSettings({ view, form }: NetworkSettingsProps): "网络设置" | import("react").DetailedReactHTMLElement<{
    'aria-label': string;
}, HTMLElement>;
