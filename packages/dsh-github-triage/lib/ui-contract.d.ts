/** Browser-safe schemas shared by forms and the command-backed UI service. */
import { z } from 'zod';
import { resultSchema, type Repo, type Report } from './types.js';
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
    compact: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>, z.ZodObject<{
    action: z.ZodLiteral<"detail">;
    repo: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    number: z.ZodNumber;
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
}, z.core.$strict>, z.ZodObject<{
    action: z.ZodLiteral<"import">;
    repo: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    text: z.ZodString;
}, z.core.$strict>], "action">;
export type UiRequest = z.infer<typeof requestSchema>;
export interface Job {
    repo: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    message?: string;
    at?: number;
}
export interface ModelStatus {
    enabled: boolean;
    provider: string;
    model: string;
    available: boolean;
    warning?: string;
}
export declare const summaryResult: z.ZodObject<{
    number: z.ZodNumber;
    kind: z.ZodEnum<{
        issue: "issue";
        pr: "pr";
    }>;
    title: z.ZodString;
    url: z.ZodString;
    localStatus: z.ZodOptional<z.ZodString>;
    observation: z.ZodOptional<z.ZodString>;
    source: z.ZodEnum<{
        rules: "rules";
        model: "model";
        correction: "correction";
    }>;
    modelNote: z.ZodOptional<z.ZodString>;
    deferred: z.ZodLiteral<true>;
    judgment: z.ZodOptional<z.ZodObject<{
        kind: z.ZodEnum<{
            issue: "issue";
            pr: "pr";
        }>;
        recommendation: z.ZodEnum<{
            adopt: "adopt";
            "manual-review": "manual-review";
            "not-recommended": "not-recommended";
        }>;
        priority: z.ZodEnum<{
            高: "高";
            中: "中";
            低: "低";
        }>;
        businessReason: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type UiResult = z.infer<typeof summaryResult> | z.infer<typeof resultSchema>;
export type UiReport = Omit<Report, 'results'> & {
    results: UiResult[];
};
export interface Snapshot {
    repositories: Repo[];
    reports: UiReport[];
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
export declare const jobSchema: z.ZodObject<{
    repo: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    status: z.ZodEnum<{
        queued: "queued";
        running: "running";
        completed: "completed";
        failed: "failed";
    }>;
    message: z.ZodOptional<z.ZodString>;
    at: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const snapshotSchema: z.ZodObject<{
    repositories: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strip>>;
    reports: z.ZodArray<z.ZodObject<{
        repo: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        at: z.ZodNumber;
        analyzed: z.ZodNumber;
        reused: z.ZodNumber;
        changed: z.ZodArray<z.ZodNumber>;
        briefing: z.ZodOptional<z.ZodString>;
        warnings: z.ZodArray<z.ZodString>;
        businessContext: z.ZodOptional<z.ZodString>;
        rulesStatus: z.ZodOptional<z.ZodString>;
        localStatus: z.ZodOptional<z.ZodString>;
        businessStatus: z.ZodString;
        modelStatus: z.ZodOptional<z.ZodString>;
        results: z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
            number: z.ZodNumber;
            kind: z.ZodEnum<{
                issue: "issue";
                pr: "pr";
            }>;
            title: z.ZodString;
            url: z.ZodString;
            localStatus: z.ZodOptional<z.ZodString>;
            observation: z.ZodOptional<z.ZodString>;
            source: z.ZodEnum<{
                rules: "rules";
                model: "model";
                correction: "correction";
            }>;
            modelNote: z.ZodOptional<z.ZodString>;
            deferred: z.ZodLiteral<true>;
            judgment: z.ZodOptional<z.ZodObject<{
                kind: z.ZodEnum<{
                    issue: "issue";
                    pr: "pr";
                }>;
                recommendation: z.ZodEnum<{
                    adopt: "adopt";
                    "manual-review": "manual-review";
                    "not-recommended": "not-recommended";
                }>;
                priority: z.ZodEnum<{
                    高: "高";
                    中: "中";
                    低: "低";
                }>;
                businessReason: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            number: z.ZodNumber;
            title: z.ZodString;
            url: z.ZodString;
            kind: z.ZodEnum<{
                issue: "issue";
                pr: "pr";
            }>;
            judgment: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
                recommendation: z.ZodEnum<{
                    adopt: "adopt";
                    "manual-review": "manual-review";
                    "not-recommended": "not-recommended";
                }>;
                priority: z.ZodEnum<{
                    高: "高";
                    中: "中";
                    低: "低";
                }>;
                localApplicability: z.ZodEnum<{
                    present: "present";
                    "already-fixed": "already-fixed";
                    "not-applicable": "not-applicable";
                    unclear: "unclear";
                }>;
                localReason: z.ZodString;
                reason: z.ZodString;
                businessReason: z.ZodString;
                evidence: z.ZodArray<z.ZodString>;
                kind: z.ZodLiteral<"issue">;
                type: z.ZodEnum<{
                    bug: "bug";
                    需求: "需求";
                    提问: "提问";
                    重复: "重复";
                    无效: "无效";
                }>;
                exists: z.ZodEnum<{
                    unclear: "unclear";
                    confirmed: "confirmed";
                    likely: "likely";
                    not_a_bug: "not_a_bug";
                }>;
                worthFixing: z.ZodEnum<{
                    值得修: "值得修";
                    待补充: "待补充";
                    不值得修: "不值得修";
                }>;
            }, z.core.$strict>, z.ZodObject<{
                recommendation: z.ZodEnum<{
                    adopt: "adopt";
                    "manual-review": "manual-review";
                    "not-recommended": "not-recommended";
                }>;
                priority: z.ZodEnum<{
                    高: "高";
                    中: "中";
                    低: "低";
                }>;
                localApplicability: z.ZodEnum<{
                    present: "present";
                    "already-fixed": "already-fixed";
                    "not-applicable": "not-applicable";
                    unclear: "unclear";
                }>;
                localReason: z.ZodString;
                reason: z.ZodString;
                businessReason: z.ZodString;
                evidence: z.ZodArray<z.ZodString>;
                kind: z.ZodLiteral<"pr">;
                verdict: z.ZodEnum<{
                    值得合并: "值得合并";
                    改完再合: "改完再合";
                    不建议合: "不建议合";
                }>;
                fitsDirection: z.ZodEnum<{
                    unclear: "unclear";
                    yes: "yes";
                    no: "no";
                }>;
                risk: z.ZodEnum<{
                    高: "高";
                    中: "中";
                    低: "低";
                }>;
                testing: z.ZodString;
            }, z.core.$strict>], "kind">>;
            evidence: z.ZodArray<z.ZodString>;
            localStatus: z.ZodOptional<z.ZodString>;
            observation: z.ZodOptional<z.ZodString>;
            source: z.ZodEnum<{
                rules: "rules";
                model: "model";
                correction: "correction";
            }>;
            modelNote: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>>;
    }, z.core.$strip>>;
    jobs: z.ZodArray<z.ZodObject<{
        repo: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        status: z.ZodEnum<{
            queued: "queued";
            running: "running";
            completed: "completed";
            failed: "failed";
        }>;
        message: z.ZodOptional<z.ZodString>;
        at: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    model: z.ZodObject<{
        enabled: z.ZodBoolean;
        provider: z.ZodString;
        model: z.ZodString;
        available: z.ZodBoolean;
        warning: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    defaults: z.ZodObject<{
        limit: z.ZodNumber;
        fullMax: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
/** Decode every transport response before exposing it to React. */
export declare function decodeValue(request: UiRequest, value: unknown): unknown;
export declare const routeActions: {
    readonly snapshot: readonly ["snapshot"];
    readonly detail: readonly ["detail"];
    readonly repos: readonly ["add", "patch", "remove"];
    readonly run: readonly ["start"];
    readonly correct: readonly ["fix"];
    readonly rules: readonly ["rules", "export", "import"];
    readonly models: readonly ["models"];
    readonly jobs: readonly ["jobs"];
};
export type RouteName = keyof typeof routeActions;
export declare const routePath: (name: RouteName) => string;
export declare function routeFor(action: UiRequest['action']): RouteName;
/** Null clears an optional value. Omitted keys retain the latest server value. */
export declare function mergeRepo(existing: Repo, patch: RepoPatch): Repo;
export declare function changedFields(before: Repo, after: Repo): RepoPatch;
export declare function fieldErrors(error: z.ZodError): Record<string, string>;
