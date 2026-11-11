import { type ReconciliationResult } from './reconcile.js';
export declare const packDisclaimer = "\u672C\u5305\u4E0D\u8BC1\u660E\u7968\u636E\u771F\u5B9E\u3001\u5DF2\u4ED8\u6B3E\u6216\u53EF\u62A5\u9500\uFF0C\u4E0D\u662F\u4F1A\u8BA1\u6863\u6848\u5408\u89C4\u8BA4\u8BC1\u3002SHA-256 \u4EC5\u7528\u4E8E\u68C0\u6D4B\u6587\u4EF6\u53D8\u5316\uFF0C\u4E0D\u8BC1\u660E\u7968\u636E\u771F\u5B9E\u3002This pack does not prove authenticity, payment or reimbursability and is not an accounting-archive certification. SHA-256 only detects file change.";
export interface ExportOptions {
    includeOriginals?: boolean;
}
export interface ExportSummary {
    directory: string;
    files: {
        markdown: string;
        xlsx: string;
        json: string;
    };
    packKind: 'with-originals' | 'summary-only';
    status: 'draft' | 'locally-confirmed';
    counts: {
        records: number;
        mismatches: number;
        pendingKeyFields: number;
        originals: number;
    };
}
/** Local-only writer. Never pass the full reconciliation result into model context. */
export declare function exportPack(projectDir: string, directory: string, input: ReconciliationResult, options?: ExportOptions): Promise<ExportSummary>;
