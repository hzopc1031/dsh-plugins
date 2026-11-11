import { type DeckCaptureOptions, type DeckCapture, type SlideCapture } from './adapters.js';
export interface ExportOptions {
    /** A plain filename within the existing export directory. */
    fileName?: string;
    signal?: AbortSignal;
    /** Called after sidecars publish, before committing the PPTX. */
    onReport?: (report: ExportReport) => Promise<void>;
}
export interface ReportPage extends Omit<SlideCapture, 'image'> {
    fontWarnings: string[];
    evidencePath?: string;
}
export interface ExportReport {
    status: 'completed' | 'failed';
    error?: string;
    inputPath: string;
    detectedFormat: DeckCapture['deck']['format'];
    pageCount: number;
    viewport: DeckCapture['viewport'];
    scale: DeckCapture['scale'];
    format: DeckCapture['format'];
    /** Null for PNG or when Chrome's JPEG default was used. */
    quality: number | null;
    browserVersion: string;
    launchArgs: DeckCapture['launchArgs'];
    sandboxMode: DeckCapture['sandboxMode'];
    sandboxFallbackReason?: string;
    networkMode: 'blocked' | 'allowed';
    warnings: string[];
    actualFontFamilies: string[];
    pages: ReportPage[];
    failedPages: ReportPage[];
    /** Successful captured image bytes; excludes failed-page evidence and OOXML overhead. */
    totalBytes: number;
    /** Published PPTX bytes for this attempt; zero on failure, even if an older file exists. */
    pptxBytes: number;
    captureElapsedMs: number;
    elapsedMs: number;
    pptxPath: string;
}
/** Assemble only captured HTML images; a failed attempt preserves any previous PPTX. */
export declare function exportCapturedDeck(capture: DeckCapture, directory: string, options?: ExportOptions): Promise<{
    pptxPath: string;
    reportPath: string;
    markdownReportPath: string;
    summary: string;
    report: ExportReport;
}>;
/** Capture and assemble with a confined, atomically replaced progress file. */
export declare function exportDeck(input: string, directory: string, options?: Omit<DeckCaptureOptions, 'onProgress'> & Pick<ExportOptions, 'fileName'>): Promise<{
    progressPath: string;
    summary: string;
    pptxPath: string;
    reportPath: string;
    markdownReportPath: string;
    report: ExportReport;
}>;
