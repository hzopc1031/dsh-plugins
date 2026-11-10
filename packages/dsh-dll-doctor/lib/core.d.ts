import { type Architecture } from './pe.js';
import { type Runner, type KnownDLLs } from './process.js';
export { parsePE, readPE } from './pe.js';
export interface Roots {
    application: string;
    system32: string;
    sysWOW64: string;
    system16: string;
    windows: string;
    current: string;
    path: string[];
    os64: boolean;
    node32: boolean;
    sysnative: string;
}
export interface Resolution {
    source: string;
    file?: string;
    note?: string;
}
export interface Dependency extends Resolution {
    name: string;
    delay: boolean;
    parent: string;
    depth: number;
    status: 'found' | 'missing' | 'api-set' | 'mismatch' | 'unreadable';
    architecture?: Architecture;
}
export interface Report {
    target: string;
    architecture: Architecture;
    managed: boolean;
    dependencies: Dependency[];
    knownSource: KnownDLLs['source'];
    warnings: string[];
    suggestions: string[];
    limited: boolean;
    supplement?: string[];
}
export interface AnalyzeOptions {
    cwd: string;
    platform?: string;
    signal?: AbortSignal;
    depth?: number;
    maxDependencies?: number;
    roots?: Roots;
    known?: KnownDLLs;
    run?: Runner;
    dependenciesExe?: string;
}
export declare function systemRoots(file: string, cwd: string): Roots;
export declare function systemDirectory(architecture: Architecture, roots: Roots): {
    directory: string;
    source: string;
};
export declare function resolveDLL(name: string, architecture: Architecture, roots: Roots, known: KnownDLLs): Promise<Resolution>;
export declare function suggestions(rows: Dependency[], managed: boolean): string[];
export declare function analyze(input: string, options: AnalyzeOptions): Promise<Report>;
export declare function render(report: Report): string;
