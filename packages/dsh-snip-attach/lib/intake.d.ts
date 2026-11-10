export declare const FILE_SELECTOR = "input[type=\"file\"][hidden][multiple]";
export declare const FALLBACK = "\u56FE\u7247\u5DF2\u5728\u526A\u8D34\u677F\uFF0C\u53EF\u6309 Ctrl+V";
/** Bound a remote call even if its transport never settles after unmount/timeout. */
export declare function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T>;
export declare function requireDesktop(boot: unknown, location: Pick<Location, 'protocol' | 'hostname'>): void;
export declare function shotUrl(text: string | undefined): string;
export declare function fileInputFor(button: HTMLElement): HTMLInputElement;
export declare function injectFile(input: HTMLInputElement, file: File): void;
