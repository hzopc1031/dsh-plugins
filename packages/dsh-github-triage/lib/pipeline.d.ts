import { type Item, type Model, type Report, type Result, type State, type Repo } from './types.js';
import { SafeText } from './safety.js';
import { type Business, type ContentsSource } from './business.js';
export declare function fingerprint(item: Item, businessHash?: string, route?: string): string;
export interface Source extends ContentsSource {
    list(repo: string, mode: Repo['mode'], limit: number, signal?: AbortSignal): Promise<Item[]>;
    enrich(repo: string, item: Item, signal?: AbortSignal): Promise<Item>;
    safe?: SafeText;
    warnings?: string[];
}
export declare function sorted(results: Result[]): Result[];
export declare function briefing(repo: string, changed: Result[], reused: number): string | undefined;
/** Keep valid structured JSON and a byte budget even for large/untrusted sources. */
export declare function modelPrompt(item: Item, evidence: string[], business: Business, state: State, repo: Repo): string;
export declare function run(source: Source, repo: Repo, state: State, options: {
    limit: number;
    now: number;
    model?: Model;
    modelRoute?: string;
    modelNote?: string;
    signal?: AbortSignal;
}): Promise<Report>;
export declare function render(report: Report): string;
export declare function correct(state: State, raw: string, now: number): string;
