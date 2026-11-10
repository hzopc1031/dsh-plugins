import { type Registry, type Scan } from './core.js';
export declare const MAX_BYTES: number;
export declare class ImpactStore {
    readonly cwd: string;
    constructor(cwd: string);
    private root;
    readSource(file: string, signal?: AbortSignal): Promise<string>;
    /** State folders never follow symbolic links/junctions. Reading never creates them. */
    private stateDir;
    load(signal?: AbortSignal): Promise<Registry>;
    private mutate;
    add(input: unknown, signal?: AbortSignal): Promise<Registry>;
    remove(id: string, signal?: AbortSignal): Promise<Registry>;
    scan(signal?: AbortSignal): Promise<Scan>;
    private scanRegistry;
    accept(expectedScanId: string, ids: readonly string[] | undefined, signal?: AbortSignal): Promise<Registry>;
}
