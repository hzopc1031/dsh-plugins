export declare const isMissing: (error: unknown) => boolean;
export declare function readLocal(dir: string, name: string, limit: number): Promise<string>;
export declare function writeLocal(dir: string, name: string, text: string, create?: boolean): Promise<void>;
