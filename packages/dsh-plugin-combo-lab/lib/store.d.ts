import { type Study, type Comparison } from './core.js';
export interface Snapshot {
    schemaVersion: 1;
    id: string;
    label: string;
    savedAt: string;
    study: Study;
}
export interface ComparisonArchive {
    schemaVersion: 1;
    id: string;
    savedAt: string;
    before: {
        id: string;
        label: string;
    };
    after: {
        id: string;
        label: string;
    };
    result: Comparison;
}
/** Only UUID filenames under this explicit workspace directory. No user-selected file import. */
export declare class Store {
    readonly directory: string;
    constructor(directory: string);
    private file;
    private read;
    load(id: string): Promise<Study>;
    save(study: Study, create?: boolean): Promise<void>;
    freeze(study: Study, label: string, now: string): Promise<Snapshot>;
    saveComparison(before: Snapshot, after: Snapshot, now: string): Promise<ComparisonArchive>;
    snapshot(id: string): Promise<Snapshot>;
}
