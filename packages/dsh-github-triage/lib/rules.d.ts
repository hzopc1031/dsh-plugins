import type { Item } from './types.js';
/** Character bigram Dice similarity works for English and Chinese without a tokenizer dependency. */
export declare function similarity(a: string, b: string): number;
export declare function duplicateOf(item: Item, peers: Item[]): number | undefined;
export interface PreScreen {
    kind: Item['kind'];
    evidence: string[];
}
export declare function rules(item: Item, peers?: Item[]): PreScreen;
