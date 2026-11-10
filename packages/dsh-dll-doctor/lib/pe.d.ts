export type Architecture = 'x86' | 'x64' | 'ARM64';
export interface Import {
    name: string;
    delay: boolean;
}
export interface PE {
    architecture: Architecture;
    format: 'PE32' | 'PE32+';
    imports: Import[];
    managed: boolean;
}
export declare const MAX_FILE_BYTES: number;
export declare const MAX_IMPORTS = 512;
export declare function dllName(value: string): boolean;
export declare function safeLocalPath(value: string): string;
export declare function targetPath(input: string, cwd: string): string;
/** Read-only, regular local files only; cap allocation even if the file grows. */
export declare function readPE(file: string, signal?: AbortSignal, budget?: {
    remaining: number;
}): Promise<PE>;
export declare function parsePE(b: Buffer): PE;
