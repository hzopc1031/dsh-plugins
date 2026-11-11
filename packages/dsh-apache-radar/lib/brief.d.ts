import { type CountsReport } from './counts.js';
import { type FeedItem, type FeedReport, type FeedSource } from './feeds.js';
export declare function sourceLine(source: FeedSource): string;
export declare function itemLine(item: FeedItem): string;
export declare function renderWeeklyBrief(counts: CountsReport, feeds: FeedReport, generatedAt?: string): string;
export declare function writeWeeklyBrief(directory: string, counts: CountsReport, feeds: FeedReport, generatedAt?: string): Promise<string>;
