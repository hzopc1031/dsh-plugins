import React from 'react';
import type { DashboardData } from './dashboard.js';
import type { CountRow } from './counts.js';
type Item = NonNullable<DashboardData['items']>[number];
export declare function groupIssues(items: Item[]): {
    label: string;
    items: Item[];
}[];
export declare function briefSections(markdown: string): string[];
export declare function CountCard({ row, title, featured }: {
    row: CountRow;
    title?: string;
    featured?: boolean;
}): React.JSX.Element;
export declare function Overview({ data }: {
    data: DashboardData;
}): React.JSX.Element;
export declare function Watch({ data, mutate, busy }: {
    data: DashboardData;
    mutate: (action: string, project?: string) => void;
    busy: boolean;
}): React.JSX.Element;
export declare function Brief({ data, request, busy }: {
    data: DashboardData;
    request: (action: string) => void;
    busy: boolean;
}): React.JSX.Element;
export declare function Dashboard(): React.JSX.Element;
interface ClientContext {
    slots: {
        inject(name: string, setup: () => unknown): unknown;
        register(options: Record<string, unknown>, component: React.ComponentType<{
            size?: number;
        }>): unknown;
    };
}
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
export {};
