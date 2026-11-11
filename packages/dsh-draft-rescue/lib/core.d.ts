import type { InputState, TokenSpan } from '@deepseek-ai/dsh-client-ui-conversation/client';
export declare const SUPPORTED_VERSION = "0.2.1-rc.5";
export declare const STORAGE_PREFIX = "dsh.conversation.";
export interface Draft {
    readonly sessionId: string;
    readonly text: string;
}
export interface StorageReader {
    readonly length: number;
    key(index: number): string | null;
    getItem(key: string): string | null;
}
/** Exact boot release identity, never inferred from the draft's shape. */
export declare function requireVersion(boot: unknown): void;
/** Validate rc.5 semantic spans, but recover only their plain text projection. */
export declare function draftText(value: unknown): string | undefined;
/** Enumerate storage independently of session-list visibility; never writes or deletes. */
export declare function listDrafts(storage: StorageReader, boot: unknown): Draft[];
export declare function copyText(draft: Draft): string;
/** Append in detect coordinates (a reference chip counts as ONE character). */
export declare function prepareAppend(draft: Draft, input: Pick<InputState, 'draft' | 'draftRev' | 'occurrences' | 'phase'>, currentSnapshot?: unknown): {
    text: string;
    span: TokenSpan;
};
