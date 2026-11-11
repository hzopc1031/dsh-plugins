import type { InputState, TokenSpan } from '@deepseek-ai/dsh-client-ui-conversation/client';
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
/** Recognize both audited semantic formats, never guess at unknown fields. */
export declare function draftText(value: unknown): string | undefined;
/** Validate the public input shape before scanning storage or preparing an edit. */
export declare function requireInput(input: unknown): asserts input is Pick<InputState, 'draft' | 'draftRev' | 'occurrences' | 'phase'>;
export declare function requireCapabilities(input: unknown, actions: unknown): void;
/** Enumerate storage independently of session-list visibility; never writes or deletes. */
export declare function listDrafts(storage: StorageReader): Draft[];
export declare function copyText(draft: Draft): string;
/** Append in detect coordinates (a reference chip counts as ONE character). */
export declare function prepareAppend(draft: Draft, input: Pick<InputState, 'draft' | 'draftRev' | 'occurrences' | 'phase'>): {
    text: string;
    span: TokenSpan;
};
