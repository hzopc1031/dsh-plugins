import type { FileSystem } from '@deepseek-ai/dsh-fs';
import { type FileFact, type ObservedMessage } from './core.js';
export interface Inventory {
    files: FileFact[];
    notices: string[];
}
/** Metadata only. No file contents, recursive scan, config writes or local-fs fallback. */
export declare function inventory(fs: FileSystem | undefined, cwd: string | undefined, messages: readonly ObservedMessage[], signal: AbortSignal): Promise<Inventory>;
