export declare class PathEscapeError extends Error {
}
export declare function isWithinRoot(root: string, path: string): boolean;
export declare function assertWithinRoot(root: string, path: string): void;
/** Check both the requested path and its symlink target before any content read/write. */
export declare function confinedPath(root: string, input: string): Promise<string>;
