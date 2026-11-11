import type { Repo } from './types.js';
import { SafeText } from './safety.js';
export declare class BusinessReadError extends Error {
}
export declare const BUSINESS_FILE_LIMIT: number, BUSINESS_PROMPT_LIMIT: number;
export declare const FILE_SNIPPET_LIMIT: number, MAX_CONTEXT_FILES = 3, PROMPT_LIMIT: number;
export declare function hash(text: string): string;
export declare function clip(text: string, max: number): string;
export declare function localPath(file: string): boolean;
export declare function validateLocal(file: string): void;
export declare function readLocal(file: string): Promise<string>;
export interface Business {
    text: string;
    status: string;
    fingerprint: string;
}
export interface ContentsSource {
    contents?(repo: string, file: string, maxBytes: number, signal?: AbortSignal): Promise<string>;
}
export declare function loadBusiness(repo: Repo, source: ContentsSource, safe: SafeText, signal?: AbortSignal): Promise<Business>;
