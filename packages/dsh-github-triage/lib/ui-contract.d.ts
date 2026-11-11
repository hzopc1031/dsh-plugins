/** Browser-safe schemas shared by forms and the command-backed UI service. */
import { z } from 'zod';
import { type Repo, type Report } from './types.js';
export declare const editableRepoSchema: z.ZodObject<{
    repo: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    mode: z.ZodDefault<z.ZodEnum<{
        issues: "issues";
        prs: "prs";
        both: "both";
    }>>;
    schedule: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"daily">;
        time: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"every">;
        hours: z.ZodNumber;
    }, z.core.$strict>], "kind">>;
    limit: z.ZodOptional<z.ZodNumber>;
    business: z.ZodOptional<z.ZodString>;
    businessFile: z.ZodOptional<z.ZodString>;
    localRepoPath: z.ZodOptional<z.ZodString>;
    localRef: z.ZodOptional<z.ZodString>;
    rulesFile: z.ZodOptional<z.ZodString>;
    fullMax: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export declare const patchSchema: z.ZodObject<{
    mode: z.ZodOptional<z.ZodEnum<{
        issues: "issues";
        prs: "prs";
        both: "both";
    }>>;
    schedule: z.ZodOptional<z.ZodNullable<z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"daily">;
        time: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"every">;
        hours: z.ZodNumber;
    }, z.core.$strict>], "kind">>>;
    limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    fullMax: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    business: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    businessFile: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    localRepoPath: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    localRef: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    rulesFile: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.core.$strict>;
export type RepoPatch = z.infer<typeof patchSchema>;
export declare const scanSchema: z.ZodObject<{
    full: z.ZodOptional<z.ZodBoolean>;
    since: z.ZodOptional<z.ZodString>;
    until: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodNumber>;
    max: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export type UiScan = z.infer<typeof scanSchema>;
export declare const requestSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    action: z.ZodLiteral<"snapshot">;
}, z.core.$strict>, z.ZodObject<{
    action: z.ZodLiteral<"jobs">;
}, z.core.$strict>, z.ZodObject<{
    action: z.ZodLiteral<"models">;
}, z.core.$strict>, z.ZodObject<{
    action: z.ZodLiteral<"add">;
    value: z.ZodObject<{
        repo: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        mode: z.ZodDefault<z.ZodEnum<{
            issues: "issues";
            prs: "prs";
            both: "both";
        }>>;
        schedule: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"daily">;
            time: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"every">;
            hours: z.ZodNumber;
        }, z.core.$strict>], "kind">>;
        limit: z.ZodOptional<z.ZodNumber>;
        business: z.ZodOptional<z.ZodString>;
        businessFile: z.ZodOptional<z.ZodString>;
        localRepoPath: z.ZodOptional<z.ZodString>;
        localRef: z.ZodOptional<z.ZodString>;
        rulesFile: z.ZodOptional<z.ZodString>;
        fullMax: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    action: z.ZodLiteral<"patch">;
    repo: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    patch: z.ZodObject<{
        mode: z.ZodOptional<z.ZodEnum<{
            issues: "issues";
            prs: "prs";
            both: "both";
        }>>;
        schedule: z.ZodOptional<z.ZodNullable<z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"daily">;
            time: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"every">;
            hours: z.ZodNumber;
        }, z.core.$strict>], "kind">>>;
        limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        fullMax: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        business: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        businessFile: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        localRepoPath: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        localRef: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        rulesFile: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    action: z.ZodLiteral<"remove">;
    repo: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
}, z.core.$strict>, z.ZodObject<{
    action: z.ZodLiteral<"start">;
    repo: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    scan: z.ZodObject<{
        full: z.ZodOptional<z.ZodBoolean>;
        since: z.ZodOptional<z.ZodString>;
        until: z.ZodOptional<z.ZodString>;
        limit: z.ZodOptional<z.ZodNumber>;
        max: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    action: z.ZodLiteral<"fix">;
    repo: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    number: z.ZodNumber;
    recommendation: z.ZodEnum<{
        adopt: "adopt";
        "manual-review": "manual-review";
        "not-recommended": "not-recommended";
    }>;
    reason: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    action: z.ZodLiteral<"rules">;
    repo: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
}, z.core.$strict>, z.ZodObject<{
    action: z.ZodLiteral<"export">;
    repo: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    path: z.ZodString;
}, z.core.$strict>], "action">;
export type UiRequest = z.infer<typeof requestSchema>;
export interface Job {
    repo: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    message?: string;
}
export interface ModelStatus {
    enabled: boolean;
    provider: string;
    model: string;
    available: boolean;
    warning?: string;
}
export interface Snapshot {
    repositories: Repo[];
    reports: Report[];
    jobs: Job[];
    model: ModelStatus;
    defaults: {
        limit: number;
        fullMax: number;
    };
}
export type Reply<T = unknown> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: string;
    fields?: Record<string, string>;
};
export type UiCall = <T = unknown>(request: UiRequest) => Promise<T>;
/** Null clears an optional value. Omitted keys retain the latest server value. */
export declare function mergeRepo(existing: Repo, patch: RepoPatch): Repo;
export declare function changedFields(before: Repo, after: Repo): RepoPatch;
export declare function fieldErrors(error: z.ZodError): Record<string, string>;
