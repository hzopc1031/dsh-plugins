export type DeckFormat = 'guizang' | 'hash' | 'query' | 'fixed-canvas' | 'generic';
export interface DeckSlide {
    /** One-based page number in DOM order. */
    index: number;
    id?: string;
    title?: string;
    selector: string;
    url: string;
    notes?: string;
    notesSource?: 'speaker-notes' | 'aside.notes' | 'data-notes';
}
export interface DetectedDeck {
    inputPath: string;
    format: DeckFormat;
    navigation: 'query' | 'hash' | 'dom';
    slides: DeckSlide[];
    designSize?: {
        width: number;
        height: number;
        source: 'attributes' | 'css';
    };
    runtimeNotes: boolean;
    warnings: string[];
}
/** Read local markup/resources without executing scripts, launching a browser, or making network requests. */
export declare function detectDeck(input: string, options?: {
    resourceRoot?: string;
}): Promise<DetectedDeck>;
