import React from 'react';
import type { DashboardData } from './dashboard.js';
import type { CountRow } from './counts.js';
import type { ProjectSecurity, SecurityReport } from './security.js';
type Item = NonNullable<DashboardData['items']>[number];
export declare function securityOverview(report: SecurityReport): {
    watched: number;
    affected: string[];
    unpinned: number;
    incomplete: number;
};
export declare function jiraCves(title: string, security: boolean, project?: ProjectSecurity): {
    id: string;
    status: string;
    label: string;
    url: string | undefined;
    fetchedAt: string | undefined;
    stale: boolean;
}[];
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
export declare function Overview({ data, jump }: {
    data: DashboardData;
    jump?: (project: string) => void;
}): React.JSX.Element;
type Mutate = (action: string, project?: string, extra?: {
    version?: string;
    cve?: string;
}) => void;
export declare function Watch({ data, mutate, busy, focusProject }: {
    data: DashboardData;
    mutate: Mutate;
    busy: boolean;
    focusProject?: string;
}): React.JSX.Element;
export declare function SecurityCard({ report, jump }: {
    report: SecurityReport;
    jump?: (project: string) => void;
}): React.JSX.Element;
export declare function SecurityStrip({ project, security, report, mutate, busy, expanded }: {
    project: string;
    security?: ProjectSecurity;
    report?: SecurityReport;
    mutate: Mutate;
    busy: boolean;
    expanded?: boolean;
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
