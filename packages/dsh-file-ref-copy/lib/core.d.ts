import type { AssistantMessageNode } from '@deepseek-ai/dsh-client-ui-conversation/client';
export interface FileReference {
    readonly label: string;
    readonly destination: string;
    readonly path: string;
    readonly absolute?: string;
    readonly relative?: string;
    readonly line?: number;
    readonly endLine?: number;
}
/** rc.5 file-link grammar; keep the authored line range for clipboard output. */
export declare function parseLocalLink(value: string): {
    path: string;
    line?: number;
    endLine?: number;
} | undefined;
/** Browser-safe normalization; no filesystem reads and no guessed workspace. */
export declare function pathForms(file: string, cwd?: string): {
    absolute?: string;
    relative?: string;
};
/** Mature CommonMark/GFM parser handles reference links, code, escapes and nesting. */
export declare function extractReferences(markdown: string, cwd?: string): FileReference[];
/** Only the requested loaded finalized message; never fetches history or streams. */
export declare function completedMarkdown(nodes: readonly AssistantMessageNode[], messageId: string): string | undefined;
export declare function copyPath(reference: FileReference, mode: 'absolute' | 'relative' | 'line'): string | undefined;
