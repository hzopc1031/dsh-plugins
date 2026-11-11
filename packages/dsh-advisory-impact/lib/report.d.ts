import { type AdvisoryViewModel } from './view-model.js';
export declare const REPORT_FILE = "advisory-impact-report.md";
export declare function renderReport(view: AdvisoryViewModel): string;
export declare function saveReport(projectDirectory: string, markdown: string): Promise<string>;
export declare function openReport(projectDirectory: string): Promise<{
    path: string;
    markdown: string;
}>;
