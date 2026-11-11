import { type DefaultTreeAdapterMap } from 'parse5';
import type { HttpClient } from './http.js';
export declare const SOURCES: {
    readonly chooser: "https://projects.apache.org/json/foundation/chooser.json";
    readonly committees: "https://whimsy.apache.org/public/committee-info.json";
    readonly retired: "https://whimsy.apache.org/public/committee-retired.json";
    readonly retiredProjects: "https://projects.apache.org/json/foundation/committees-retired.json";
    readonly podlings: "https://projects.apache.org/json/foundation/podlings.json";
    readonly publicPodlings: "https://whimsy.apache.org/public/public_podlings.json";
    readonly releases: "https://projects.apache.org/json/foundation/releases.json";
    readonly attic: "https://attic.apache.org/projects.html";
};
export interface SourceResult<T> {
    url: string;
    fetchedAt: string;
    sourceTimestamp?: string;
    data: T;
}
export interface Project {
    id: string;
    name: string;
    homepage: string;
    pmc: string;
    areas: string[];
}
export interface Committee {
    id: string;
    name: string;
    pmc: boolean;
}
export interface RetiredCommittee {
    id: string;
    name: string;
    retired: string;
}
export interface Podling {
    id: string;
    name: string;
    status: 'current' | 'graduated' | 'retired';
    homepage?: string;
}
export interface Release {
    project: string;
    version: string;
    date: string;
    url: string;
}
export interface AtticProject {
    id: string;
    name: string;
    type: 'PMC' | 'Subproject';
    url: string;
    description: string;
    established: string;
    retired: string;
}
export declare function object(value: unknown): Record<string, unknown>;
export declare function text(value: unknown): string;
export declare function link(value: unknown): string;
export declare function fetchChooser(http: HttpClient): Promise<SourceResult<{
    projects: Project[];
    categories: string[];
}>>;
export declare function fetchCommittees(http: HttpClient): Promise<SourceResult<{
    committees: Committee[];
    committeeCount: number;
    pmcCount: number;
}>>;
export declare function fetchRetiredCommittees(http: HttpClient): Promise<SourceResult<RetiredCommittee[]>>;
export declare function fetchRetiredProjects(http: HttpClient): Promise<SourceResult<{
    id: string;
    name: string;
    retired: string;
}[]>>;
export declare function fetchPodlings(http: HttpClient): Promise<SourceResult<{
    id: string;
    name: string;
    status: "current";
    homepage: string;
}[]>>;
export declare function fetchPublicPodlings(http: HttpClient): Promise<SourceResult<Podling[]>>;
export declare function fetchReleases(http: HttpClient): Promise<SourceResult<{
    project: string;
    version: string;
    date: string;
    url: "https://projects.apache.org/json/foundation/releases.json";
}[]>>;
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
export declare function elements(node: Node, tag: string): Element[];
export declare const clean: (node: Node) => string;
export declare function fetchAtticProjects(http: HttpClient): Promise<SourceResult<AtticProject[]>>;
export {};
