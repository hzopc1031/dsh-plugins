import { type Item, type Model, type Report, type Result, type State, type Repo } from './types.js';
import { SafeText } from './safety.js';
export declare function fingerprint(item: Item): string;
export interface Source {
    list(repo: string, mode: Repo['mode'], limit: number, signal?: AbortSignal): Promise<Item[]>;
    enrich(repo: string, item: Item, signal?: AbortSignal): Promise<Item>;
    safe?: SafeText;
    warnings?: string[];
}
export declare function sorted(results: Result[]): Result[];
export declare function briefing(repo: string, changed: Result[], reused: number): string | undefined;
export declare function run(source: Source, repo: Repo, state: State, options: {
    limit: number;
    now: number;
    model?: Model;
    signal?: AbortSignal;
}): Promise<Report>;
export declare function render(report: Report): string;
export declare function correct(state: State, raw: string, now: number): string;
