import { type Stats } from 'node:fs';
interface Handle {
    fd: number;
    stat(): Promise<Stats>;
    close(): Promise<void>;
    sync(): Promise<void>;
    writeFile(bytes: string | Buffer): Promise<void>;
    read(buffer: Buffer, offset: number, length: number, position: null): Promise<{
        bytesRead: number;
    }>;
}
export declare function nativeIO(): {
    open(fd: number, name: string, flags: number, mode: number): number;
    mkdir(fd: number, name: string): void;
    rename(fd: number, from: string, to: string): void;
    unlink(fd: number, name: string, directory: boolean): void;
};
export declare class Directory {
    readonly handle: Handle;
    private readonly prefix?;
    private constructor();
    static supported(): void;
    static open(path: string): Promise<Directory>;
    private path;
    openFile(name: string, flags: number, mode?: number): Promise<Handle>;
    openDirectory(name: string): Promise<Directory>;
    mkdir(name: string): Promise<void>;
    rename(from: string, to: string): Promise<void>;
    unlink(name: string, directory?: boolean): Promise<void>;
    canonical(original: string): Promise<string>;
}
export {};
