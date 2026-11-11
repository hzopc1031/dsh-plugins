import { type SecurityReport } from './security.js';
import { type CountsReport } from './counts.js';
import { type FeedItem, type FeedReport, type FeedSource } from './feeds.js';
export declare function sourceLine(source: FeedSource): string;
export declare function itemLine(item: FeedItem): string;
export declare function renderWeeklyBrief(counts: CountsReport, feeds: FeedReport, generatedAt?: string, security?: SecurityReport): string;
export declare function securityBrief(security: SecurityReport, window: FeedReport['window']): string;
export declare function writeWeeklyBrief(directory: string, counts: CountsReport, feeds: FeedReport, generatedAt?: string, security?: SecurityReport): Promise<string>;
