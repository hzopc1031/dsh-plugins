import { type State } from './types.js';
export declare const domainSpec: {
    name: string;
    version: number;
    tables: {};
    global: {
        schema: import("zod").ZodPreprocess<import("zod").ZodObject<{
            formatVersion: import("zod").ZodLiteral<3>;
            ruleDocuments: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodString>;
            overrides: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodObject<{
                repo: import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>;
                mode: import("zod").ZodDefault<import("zod").ZodEnum<{
                    issues: "issues";
                    prs: "prs";
                    both: "both";
                }>>;
                schedule: import("zod").ZodOptional<import("zod").ZodDiscriminatedUnion<[import("zod").ZodObject<{
                    kind: import("zod").ZodLiteral<"daily">;
                    time: import("zod").ZodString;
                }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
                    kind: import("zod").ZodLiteral<"every">;
                    hours: import("zod").ZodNumber;
                }, import("zod/v4/core").$strict>], "kind">>;
                limit: import("zod").ZodOptional<import("zod").ZodNumber>;
                business: import("zod").ZodOptional<import("zod").ZodString>;
                businessFile: import("zod").ZodOptional<import("zod").ZodString>;
                localRepoPath: import("zod").ZodOptional<import("zod").ZodString>;
                localRef: import("zod").ZodOptional<import("zod").ZodString>;
                rulesFile: import("zod").ZodOptional<import("zod").ZodString>;
                fullMax: import("zod").ZodOptional<import("zod").ZodNumber>;
            }, import("zod/v4/core").$strip>>;
            removed: import("zod").ZodArray<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>>;
            cache: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodObject<{
                fingerprint: import("zod").ZodString;
                result: import("zod").ZodObject<{
                    number: import("zod").ZodNumber;
                    title: import("zod").ZodString;
                    url: import("zod").ZodString;
                    kind: import("zod").ZodEnum<{
                        issue: "issue";
                        pr: "pr";
                    }>;
                    judgment: import("zod").ZodOptional<import("zod").ZodDiscriminatedUnion<[import("zod").ZodObject<{
                        recommendation: import("zod").ZodEnum<{
                            adopt: "adopt";
                            "manual-review": "manual-review";
                            "not-recommended": "not-recommended";
                        }>;
                        priority: import("zod").ZodEnum<{
                            高: "高";
                            中: "中";
                            低: "低";
                        }>;
                        localApplicability: import("zod").ZodEnum<{
                            present: "present";
                            "already-fixed": "already-fixed";
                            "not-applicable": "not-applicable";
                            unclear: "unclear";
                        }>;
                        localReason: import("zod").ZodString;
                        reason: import("zod").ZodString;
                        businessReason: import("zod").ZodString;
                        evidence: import("zod").ZodArray<import("zod").ZodString>;
                        kind: import("zod").ZodLiteral<"issue">;
                        type: import("zod").ZodEnum<{
                            bug: "bug";
                            需求: "需求";
                            提问: "提问";
                            重复: "重复";
                            无效: "无效";
                        }>;
                        exists: import("zod").ZodEnum<{
                            unclear: "unclear";
                            confirmed: "confirmed";
                            likely: "likely";
                            not_a_bug: "not_a_bug";
                        }>;
                        worthFixing: import("zod").ZodEnum<{
                            值得修: "值得修";
                            待补充: "待补充";
                            不值得修: "不值得修";
                        }>;
                    }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
                        recommendation: import("zod").ZodEnum<{
                            adopt: "adopt";
                            "manual-review": "manual-review";
                            "not-recommended": "not-recommended";
                        }>;
                        priority: import("zod").ZodEnum<{
                            高: "高";
                            中: "中";
                            低: "低";
                        }>;
                        localApplicability: import("zod").ZodEnum<{
                            present: "present";
                            "already-fixed": "already-fixed";
                            "not-applicable": "not-applicable";
                            unclear: "unclear";
                        }>;
                        localReason: import("zod").ZodString;
                        reason: import("zod").ZodString;
                        businessReason: import("zod").ZodString;
                        evidence: import("zod").ZodArray<import("zod").ZodString>;
                        kind: import("zod").ZodLiteral<"pr">;
                        verdict: import("zod").ZodEnum<{
                            值得合并: "值得合并";
                            改完再合: "改完再合";
                            不建议合: "不建议合";
                        }>;
                        fitsDirection: import("zod").ZodEnum<{
                            unclear: "unclear";
                            yes: "yes";
                            no: "no";
                        }>;
                        risk: import("zod").ZodEnum<{
                            高: "高";
                            中: "中";
                            低: "低";
                        }>;
                        testing: import("zod").ZodString;
                    }, import("zod/v4/core").$strict>], "kind">>;
                    evidence: import("zod").ZodArray<import("zod").ZodString>;
                    localStatus: import("zod").ZodOptional<import("zod").ZodString>;
                    observation: import("zod").ZodOptional<import("zod").ZodString>;
                    source: import("zod").ZodEnum<{
                        rules: "rules";
                        model: "model";
                        correction: "correction";
                    }>;
                    modelNote: import("zod").ZodOptional<import("zod").ZodString>;
                }, import("zod/v4/core").$strip>;
            }, import("zod/v4/core").$strip>>;
            corrections: import("zod").ZodArray<import("zod").ZodObject<{
                repo: import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>;
                number: import("zod").ZodNumber;
                judgment: import("zod").ZodDiscriminatedUnion<[import("zod").ZodObject<{
                    recommendation: import("zod").ZodEnum<{
                        adopt: "adopt";
                        "manual-review": "manual-review";
                        "not-recommended": "not-recommended";
                    }>;
                    priority: import("zod").ZodEnum<{
                        高: "高";
                        中: "中";
                        低: "低";
                    }>;
                    localApplicability: import("zod").ZodEnum<{
                        present: "present";
                        "already-fixed": "already-fixed";
                        "not-applicable": "not-applicable";
                        unclear: "unclear";
                    }>;
                    localReason: import("zod").ZodString;
                    reason: import("zod").ZodString;
                    businessReason: import("zod").ZodString;
                    evidence: import("zod").ZodArray<import("zod").ZodString>;
                    kind: import("zod").ZodLiteral<"issue">;
                    type: import("zod").ZodEnum<{
                        bug: "bug";
                        需求: "需求";
                        提问: "提问";
                        重复: "重复";
                        无效: "无效";
                    }>;
                    exists: import("zod").ZodEnum<{
                        unclear: "unclear";
                        confirmed: "confirmed";
                        likely: "likely";
                        not_a_bug: "not_a_bug";
                    }>;
                    worthFixing: import("zod").ZodEnum<{
                        值得修: "值得修";
                        待补充: "待补充";
                        不值得修: "不值得修";
                    }>;
                }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
                    recommendation: import("zod").ZodEnum<{
                        adopt: "adopt";
                        "manual-review": "manual-review";
                        "not-recommended": "not-recommended";
                    }>;
                    priority: import("zod").ZodEnum<{
                        高: "高";
                        中: "中";
                        低: "低";
                    }>;
                    localApplicability: import("zod").ZodEnum<{
                        present: "present";
                        "already-fixed": "already-fixed";
                        "not-applicable": "not-applicable";
                        unclear: "unclear";
                    }>;
                    localReason: import("zod").ZodString;
                    reason: import("zod").ZodString;
                    businessReason: import("zod").ZodString;
                    evidence: import("zod").ZodArray<import("zod").ZodString>;
                    kind: import("zod").ZodLiteral<"pr">;
                    verdict: import("zod").ZodEnum<{
                        值得合并: "值得合并";
                        改完再合: "改完再合";
                        不建议合: "不建议合";
                    }>;
                    fitsDirection: import("zod").ZodEnum<{
                        unclear: "unclear";
                        yes: "yes";
                        no: "no";
                    }>;
                    risk: import("zod").ZodEnum<{
                        高: "高";
                        中: "中";
                        低: "低";
                    }>;
                    testing: import("zod").ZodString;
                }, import("zod/v4/core").$strict>], "kind">;
                business: import("zod").ZodOptional<import("zod").ZodString>;
                reason: import("zod").ZodString;
                at: import("zod").ZodNumber;
                title: import("zod").ZodString;
            }, import("zod/v4/core").$strip>>;
            reports: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodObject<{
                repo: import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>;
                at: import("zod").ZodNumber;
                results: import("zod").ZodArray<import("zod").ZodObject<{
                    number: import("zod").ZodNumber;
                    title: import("zod").ZodString;
                    url: import("zod").ZodString;
                    kind: import("zod").ZodEnum<{
                        issue: "issue";
                        pr: "pr";
                    }>;
                    judgment: import("zod").ZodOptional<import("zod").ZodDiscriminatedUnion<[import("zod").ZodObject<{
                        recommendation: import("zod").ZodEnum<{
                            adopt: "adopt";
                            "manual-review": "manual-review";
                            "not-recommended": "not-recommended";
                        }>;
                        priority: import("zod").ZodEnum<{
                            高: "高";
                            中: "中";
                            低: "低";
                        }>;
                        localApplicability: import("zod").ZodEnum<{
                            present: "present";
                            "already-fixed": "already-fixed";
                            "not-applicable": "not-applicable";
                            unclear: "unclear";
                        }>;
                        localReason: import("zod").ZodString;
                        reason: import("zod").ZodString;
                        businessReason: import("zod").ZodString;
                        evidence: import("zod").ZodArray<import("zod").ZodString>;
                        kind: import("zod").ZodLiteral<"issue">;
                        type: import("zod").ZodEnum<{
                            bug: "bug";
                            需求: "需求";
                            提问: "提问";
                            重复: "重复";
                            无效: "无效";
                        }>;
                        exists: import("zod").ZodEnum<{
                            unclear: "unclear";
                            confirmed: "confirmed";
                            likely: "likely";
                            not_a_bug: "not_a_bug";
                        }>;
                        worthFixing: import("zod").ZodEnum<{
                            值得修: "值得修";
                            待补充: "待补充";
                            不值得修: "不值得修";
                        }>;
                    }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
                        recommendation: import("zod").ZodEnum<{
                            adopt: "adopt";
                            "manual-review": "manual-review";
                            "not-recommended": "not-recommended";
                        }>;
                        priority: import("zod").ZodEnum<{
                            高: "高";
                            中: "中";
                            低: "低";
                        }>;
                        localApplicability: import("zod").ZodEnum<{
                            present: "present";
                            "already-fixed": "already-fixed";
                            "not-applicable": "not-applicable";
                            unclear: "unclear";
                        }>;
                        localReason: import("zod").ZodString;
                        reason: import("zod").ZodString;
                        businessReason: import("zod").ZodString;
                        evidence: import("zod").ZodArray<import("zod").ZodString>;
                        kind: import("zod").ZodLiteral<"pr">;
                        verdict: import("zod").ZodEnum<{
                            值得合并: "值得合并";
                            改完再合: "改完再合";
                            不建议合: "不建议合";
                        }>;
                        fitsDirection: import("zod").ZodEnum<{
                            unclear: "unclear";
                            yes: "yes";
                            no: "no";
                        }>;
                        risk: import("zod").ZodEnum<{
                            高: "高";
                            中: "中";
                            低: "低";
                        }>;
                        testing: import("zod").ZodString;
                    }, import("zod/v4/core").$strict>], "kind">>;
                    evidence: import("zod").ZodArray<import("zod").ZodString>;
                    localStatus: import("zod").ZodOptional<import("zod").ZodString>;
                    observation: import("zod").ZodOptional<import("zod").ZodString>;
                    source: import("zod").ZodEnum<{
                        rules: "rules";
                        model: "model";
                        correction: "correction";
                    }>;
                    modelNote: import("zod").ZodOptional<import("zod").ZodString>;
                }, import("zod/v4/core").$strip>>;
                analyzed: import("zod").ZodNumber;
                reused: import("zod").ZodNumber;
                changed: import("zod").ZodArray<import("zod").ZodNumber>;
                briefing: import("zod").ZodOptional<import("zod").ZodString>;
                warnings: import("zod").ZodArray<import("zod").ZodString>;
                businessContext: import("zod").ZodOptional<import("zod").ZodString>;
                rulesStatus: import("zod").ZodOptional<import("zod").ZodString>;
                localStatus: import("zod").ZodOptional<import("zod").ZodString>;
                businessStatus: import("zod").ZodString;
                modelStatus: import("zod").ZodOptional<import("zod").ZodString>;
            }, import("zod/v4/core").$strip>>;
            lastRun: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodNumber>;
            pending: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodString>;
        }, import("zod/v4/core").$strip>>;
        initial: {
            formatVersion: 3;
            ruleDocuments: Record<string, string>;
            overrides: Record<string, {
                repo: string;
                mode: "issues" | "prs" | "both";
                schedule?: {
                    kind: "daily";
                    time: string;
                } | {
                    kind: "every";
                    hours: number;
                } | undefined;
                limit?: number | undefined;
                business?: string | undefined;
                businessFile?: string | undefined;
                localRepoPath?: string | undefined;
                localRef?: string | undefined;
                rulesFile?: string | undefined;
                fullMax?: number | undefined;
            }>;
            removed: string[];
            cache: Record<string, {
                fingerprint: string;
                result: {
                    number: number;
                    title: string;
                    url: string;
                    kind: "issue" | "pr";
                    evidence: string[];
                    source: "rules" | "model" | "correction";
                    judgment?: {
                        recommendation: "adopt" | "manual-review" | "not-recommended";
                        priority: "高" | "中" | "低";
                        localApplicability: "present" | "already-fixed" | "not-applicable" | "unclear";
                        localReason: string;
                        reason: string;
                        businessReason: string;
                        evidence: string[];
                        kind: "issue";
                        type: "bug" | "需求" | "提问" | "重复" | "无效";
                        exists: "unclear" | "confirmed" | "likely" | "not_a_bug";
                        worthFixing: "值得修" | "待补充" | "不值得修";
                    } | {
                        recommendation: "adopt" | "manual-review" | "not-recommended";
                        priority: "高" | "中" | "低";
                        localApplicability: "present" | "already-fixed" | "not-applicable" | "unclear";
                        localReason: string;
                        reason: string;
                        businessReason: string;
                        evidence: string[];
                        kind: "pr";
                        verdict: "值得合并" | "改完再合" | "不建议合";
                        fitsDirection: "unclear" | "yes" | "no";
                        risk: "高" | "中" | "低";
                        testing: string;
                    } | undefined;
                    localStatus?: string | undefined;
                    observation?: string | undefined;
                    modelNote?: string | undefined;
                };
            }>;
            corrections: {
                repo: string;
                number: number;
                judgment: {
                    recommendation: "adopt" | "manual-review" | "not-recommended";
                    priority: "高" | "中" | "低";
                    localApplicability: "present" | "already-fixed" | "not-applicable" | "unclear";
                    localReason: string;
                    reason: string;
                    businessReason: string;
                    evidence: string[];
                    kind: "issue";
                    type: "bug" | "需求" | "提问" | "重复" | "无效";
                    exists: "unclear" | "confirmed" | "likely" | "not_a_bug";
                    worthFixing: "值得修" | "待补充" | "不值得修";
                } | {
                    recommendation: "adopt" | "manual-review" | "not-recommended";
                    priority: "高" | "中" | "低";
                    localApplicability: "present" | "already-fixed" | "not-applicable" | "unclear";
                    localReason: string;
                    reason: string;
                    businessReason: string;
                    evidence: string[];
                    kind: "pr";
                    verdict: "值得合并" | "改完再合" | "不建议合";
                    fitsDirection: "unclear" | "yes" | "no";
                    risk: "高" | "中" | "低";
                    testing: string;
                };
                reason: string;
                at: number;
                title: string;
                business?: string | undefined;
            }[];
            reports: Record<string, {
                repo: string;
                at: number;
                results: {
                    number: number;
                    title: string;
                    url: string;
                    kind: "issue" | "pr";
                    evidence: string[];
                    source: "rules" | "model" | "correction";
                    judgment?: {
                        recommendation: "adopt" | "manual-review" | "not-recommended";
                        priority: "高" | "中" | "低";
                        localApplicability: "present" | "already-fixed" | "not-applicable" | "unclear";
                        localReason: string;
                        reason: string;
                        businessReason: string;
                        evidence: string[];
                        kind: "issue";
                        type: "bug" | "需求" | "提问" | "重复" | "无效";
                        exists: "unclear" | "confirmed" | "likely" | "not_a_bug";
                        worthFixing: "值得修" | "待补充" | "不值得修";
                    } | {
                        recommendation: "adopt" | "manual-review" | "not-recommended";
                        priority: "高" | "中" | "低";
                        localApplicability: "present" | "already-fixed" | "not-applicable" | "unclear";
                        localReason: string;
                        reason: string;
                        businessReason: string;
                        evidence: string[];
                        kind: "pr";
                        verdict: "值得合并" | "改完再合" | "不建议合";
                        fitsDirection: "unclear" | "yes" | "no";
                        risk: "高" | "中" | "低";
                        testing: string;
                    } | undefined;
                    localStatus?: string | undefined;
                    observation?: string | undefined;
                    modelNote?: string | undefined;
                }[];
                analyzed: number;
                reused: number;
                changed: number[];
                warnings: string[];
                businessStatus: string;
                briefing?: string | undefined;
                businessContext?: string | undefined;
                rulesStatus?: string | undefined;
                localStatus?: string | undefined;
                modelStatus?: string | undefined;
            }>;
            lastRun: Record<string, number>;
            pending: Record<string, string>;
        };
    };
};
/** Retain bounded derived cache; corrections remain separate authoritative records. */
export declare function prune(state: State): void;
