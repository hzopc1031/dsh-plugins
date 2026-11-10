import { type Page } from 'puppeteer-core';
export interface CaptureOptions {
    viewport?: {
        width: number;
        height: number;
    };
    scale?: 1 | 2;
    format?: 'png' | 'jpeg';
    quality?: number;
    allowNetwork?: boolean;
    timeoutMs?: number;
    stabilityMs?: number;
    signal?: AbortSignal;
}
export interface CaptureResult {
    url: string;
    status: 'captured' | 'failed';
    /** Full viewport image, or best-effort failure evidence. Never a section crop. */
    image?: Uint8Array;
    bytes: number;
    error?: string;
    warnings: string[];
    computedFontFamilies: string[];
    actualFontFamilies: string[];
    elapsedMs: number;
}
export declare const CHROME_ARGS: string[];
/** One isolated browser per deck; adapters activate slides through prepare before readiness checks. */
export declare function createCaptureEngine(directory: string, options?: CaptureOptions): Promise<{
    root: string;
    viewport: {
        width: number;
        height: number;
    };
    scale: 1 | 2;
    format: "png" | "jpeg";
    quality: number | undefined;
    allowNetwork: boolean;
    browserVersion: string;
    browserPid: number | undefined;
    close: () => Promise<void>;
    capture(input: string, prepare?: (page: Page) => Promise<void>): Promise<CaptureResult>;
}>;
