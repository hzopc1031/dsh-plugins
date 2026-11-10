export interface PathIO {
    realpath(file: string): Promise<string>;
    stat(file: string): Promise<{
        isFile(): boolean;
        isDirectory(): boolean;
    }>;
}
export interface ProjectFile {
    readonly root: string;
    readonly file: string;
}
export declare function inputPath(raw: string): string;
export declare function validateProjectFile(raw: string, directory: string, io?: PathIO): Promise<ProjectFile>;
