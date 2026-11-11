import { type FileHandle } from 'node:fs/promises';
type Identity = {
    dev: number;
    ino: number;
};
export declare function writeConfined(root: string, destination: string, files: [string, Buffer][], status?: boolean, identity?: Identity, pinnedParent?: FileHandle): Promise<Identity>;
export {};
