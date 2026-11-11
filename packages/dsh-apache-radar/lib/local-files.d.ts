export declare function validDirectory(directory: unknown): directory is string;
export declare function localPath(directory: string, filename: string): Promise<string>;
export declare function readLocal(directory: string, filename: string): Promise<string | undefined>;
export declare function writeLocal(directory: string, filename: string, content: string): Promise<string>;
