import { type FileHandle } from 'node:fs/promises';
import type { Draft, ExportFormat, Material, Platform, Topic } from './model.js';
export declare function directoryPath(directory: FileHandle): Promise<string>;
export declare function exportDocuments(topic: Topic, target: Platform, draft: Draft, format: ExportFormat, reviewPassed: boolean): Record<string, string>;
export declare function writeExport(directory: string, blockedRoots: string[], exportId: string, documents: Record<string, string>, materials: Material[] | null, readMaterial: (material: Material) => Promise<Buffer>, signal?: AbortSignal): Promise<{
    directory: string;
    files: string[];
}>;
