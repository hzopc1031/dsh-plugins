import type { Context } from '@deepseek-ai/cordis';
import type { Boot } from './core.js';
declare global {
    interface Window {
        __DSH_DIRENJIE__?: Boot;
    }
}
export declare const name = "dsh-direnjie-theme";
export declare const inject: string[];
/** Kept separate for lifecycle tests without launching DSH. */
export declare function mount(doc: Document, boot: Boot, css: string): () => void;
export declare function apply(ctx: Context): void;
