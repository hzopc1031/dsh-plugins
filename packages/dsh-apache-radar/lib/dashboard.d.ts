import type { SecurityReport } from './security.js';
import type { Context } from '@deepseek-ai/cordis';
import type { RadarAction, RadarArgs } from './radar.js';
import type { CountsReport } from './counts.js';
import type { FeedSource, FeedWindow } from './feeds.js';
import type { itemSummary } from './radar.js';
export interface DashboardData {
    proxyNote?: string;
    diagnostics?: {
        code: string;
        hintZh: string;
        count: number;
    }[];
    localSnapshot?: boolean;
    security?: SecurityReport;
    pins?: Record<string, string>;
    directories: string[];
    directory?: string;
    watchList?: string[];
    empty?: boolean;
    counts?: CountsReport;
    sources?: FeedSource[];
    window?: FeedWindow;
    collectedAt?: string;
    items?: ReturnType<typeof itemSummary>[];
    undatedItems?: ReturnType<typeof itemSummary>[];
    markdown?: string;
}
type Run = (directory: string | undefined, action: RadarAction, args?: RadarArgs) => Promise<string>;
export declare function dashboardHandler(run: Run, directories: () => string[], proxy?: (action: string) => Promise<unknown>): (request: Request) => Promise<Response>;
export declare function registerDashboard(ctx: Context, run: Run, directories: () => string[], proxy?: (action: string) => Promise<unknown>): void;
export {};
