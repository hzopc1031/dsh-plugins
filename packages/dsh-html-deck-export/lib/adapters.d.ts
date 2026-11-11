import { type CaptureOptions, type CaptureResult } from './capture.js';
import { type DeckSlide, type DetectedDeck } from './detect.js';
export interface DeckCaptureOptions extends CaptureOptions {
    /** Explicit asset boundary for decks with sibling assets; defaults to the HTML directory. */
    resourceRoot?: string;
}
export interface SlideCapture extends CaptureResult {
    index: number;
    id?: string;
    title?: string;
    notes?: string;
    notesSource?: DeckSlide['notesSource'];
    renderState?: {
        navigation: string;
        slideBounds: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
        animatedElements: number;
        unresolvedAnimatedElements: number;
        chrome: {
            selector: string;
            display: string;
            visibility: string;
        }[];
        preview?: {
            lowPower: boolean;
            backgroundCanvases: number;
            hiddenBackgroundCanvases: number;
            differences: string[];
        };
    };
}
export interface DeckCapture {
    deck: DetectedDeck;
    viewport: {
        width: number;
        height: number;
    };
    scale: 1 | 2;
    format: 'png' | 'jpeg';
    quality?: number;
    allowNetwork: boolean;
    browserVersion: string;
    launchArgs: string[];
    sandboxMode: 'enabled' | 'disabled-fallback';
    sandboxFallbackReason?: string;
    pages: SlideCapture[];
    totalBytes: number;
    elapsedMs: number;
}
/** Capture every detected page in DOM order, retaining failed pages as evidence. Writes no files. */
export declare function captureDeck(input: string, options?: DeckCaptureOptions): Promise<DeckCapture>;
