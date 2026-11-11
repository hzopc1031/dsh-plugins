import { type State } from './types.js';
export declare const domainSpec: {
    name: string;
    version: number;
    tables: {};
    global: {
        schema: import("zod").ZodObject<{
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
            }, import("zod/v4/core").$strip>>;
            removed: import("zod").ZodArray<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>>;
            cache: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodObject<{
                fingerprint: import("zod").ZodString;
                result: import("zod").ZodObject<{
                    number: import("zod").ZodNumber;
                    title: import("zod").ZodString;
                    url: import("zod").ZodString;
                    judgment: import("zod").ZodDiscriminatedUnion<[import("zod").ZodObject<{
                        priority: import("zod").ZodEnum<{
                            高: "高";
                            中: "中";
                            低: "低";
                        }>;
                        reason: import("zod").ZodString;
                        evidence: import("zod").ZodArray<import("zod").ZodString>;
                        kind: import("zod").ZodLiteral<"issue">;
                        type: import("zod").ZodEnum<{
                            bug: "bug";
                            需求: "需求";
                            提问: "提问";
                            重复: "重复";
                            无效: "无效";
                        }>;
                        real: import("zod").ZodEnum<{
                            是: "是";
                            待证实: "待证实";
                            否: "否";
                        }>;
                        worth: import("zod").ZodEnum<{
                            值得修: "值得修";
                            待补充: "待补充";
                            不值得修: "不值得修";
                        }>;
                        impact: import("zod").ZodString;
                        severity: import("zod").ZodString;
                        cost: import("zod").ZodString;
                    }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
                        priority: import("zod").ZodEnum<{
                            高: "高";
                            中: "中";
                            低: "低";
                        }>;
                        reason: import("zod").ZodString;
                        evidence: import("zod").ZodArray<import("zod").ZodString>;
                        kind: import("zod").ZodLiteral<"pr">;
                        verdict: import("zod").ZodEnum<{
                            值得合并: "值得合并";
                            改完再合: "改完再合";
                            不建议合: "不建议合";
                        }>;
                        risk: import("zod").ZodEnum<{
                            高: "高";
                            中: "中";
                            低: "低";
                        }>;
                        suspicious: import("zod").ZodBoolean;
                    }, import("zod/v4/core").$strict>], "kind">;
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
                    priority: import("zod").ZodEnum<{
                        高: "高";
                        中: "中";
                        低: "低";
                    }>;
                    reason: import("zod").ZodString;
                    evidence: import("zod").ZodArray<import("zod").ZodString>;
                    kind: import("zod").ZodLiteral<"issue">;
                    type: import("zod").ZodEnum<{
                        bug: "bug";
                        需求: "需求";
                        提问: "提问";
                        重复: "重复";
                        无效: "无效";
                    }>;
                    real: import("zod").ZodEnum<{
                        是: "是";
                        待证实: "待证实";
                        否: "否";
                    }>;
                    worth: import("zod").ZodEnum<{
                        值得修: "值得修";
                        待补充: "待补充";
                        不值得修: "不值得修";
                    }>;
                    impact: import("zod").ZodString;
                    severity: import("zod").ZodString;
                    cost: import("zod").ZodString;
                }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
                    priority: import("zod").ZodEnum<{
                        高: "高";
                        中: "中";
                        低: "低";
                    }>;
                    reason: import("zod").ZodString;
                    evidence: import("zod").ZodArray<import("zod").ZodString>;
                    kind: import("zod").ZodLiteral<"pr">;
                    verdict: import("zod").ZodEnum<{
                        值得合并: "值得合并";
                        改完再合: "改完再合";
                        不建议合: "不建议合";
                    }>;
                    risk: import("zod").ZodEnum<{
                        高: "高";
                        中: "中";
                        低: "低";
                    }>;
                    suspicious: import("zod").ZodBoolean;
                }, import("zod/v4/core").$strict>], "kind">;
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
                    judgment: import("zod").ZodDiscriminatedUnion<[import("zod").ZodObject<{
                        priority: import("zod").ZodEnum<{
                            高: "高";
                            中: "中";
                            低: "低";
                        }>;
                        reason: import("zod").ZodString;
                        evidence: import("zod").ZodArray<import("zod").ZodString>;
                        kind: import("zod").ZodLiteral<"issue">;
                        type: import("zod").ZodEnum<{
                            bug: "bug";
                            需求: "需求";
                            提问: "提问";
                            重复: "重复";
                            无效: "无效";
                        }>;
                        real: import("zod").ZodEnum<{
                            是: "是";
                            待证实: "待证实";
                            否: "否";
                        }>;
                        worth: import("zod").ZodEnum<{
                            值得修: "值得修";
                            待补充: "待补充";
                            不值得修: "不值得修";
                        }>;
                        impact: import("zod").ZodString;
                        severity: import("zod").ZodString;
                        cost: import("zod").ZodString;
                    }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
                        priority: import("zod").ZodEnum<{
                            高: "高";
                            中: "中";
                            低: "低";
                        }>;
                        reason: import("zod").ZodString;
                        evidence: import("zod").ZodArray<import("zod").ZodString>;
                        kind: import("zod").ZodLiteral<"pr">;
                        verdict: import("zod").ZodEnum<{
                            值得合并: "值得合并";
                            改完再合: "改完再合";
                            不建议合: "不建议合";
                        }>;
                        risk: import("zod").ZodEnum<{
                            高: "高";
                            中: "中";
                            低: "低";
                        }>;
                        suspicious: import("zod").ZodBoolean;
                    }, import("zod/v4/core").$strict>], "kind">;
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
            }, import("zod/v4/core").$strip>>;
            lastRun: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodNumber>;
            pending: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodString>;
        }, import("zod/v4/core").$strip>;
        initial: {
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
            }>;
            removed: string[];
            cache: Record<string, {
                fingerprint: string;
                result: {
                    number: number;
                    title: string;
                    url: string;
                    judgment: {
                        priority: "高" | "中" | "低";
                        reason: string;
                        evidence: string[];
                        kind: "issue";
                        type: "bug" | "需求" | "提问" | "重复" | "无效";
                        real: "是" | "待证实" | "否";
                        worth: "值得修" | "待补充" | "不值得修";
                        impact: string;
                        severity: string;
                        cost: string;
                    } | {
                        priority: "高" | "中" | "低";
                        reason: string;
                        evidence: string[];
                        kind: "pr";
                        verdict: "值得合并" | "改完再合" | "不建议合";
                        risk: "高" | "中" | "低";
                        suspicious: boolean;
                    };
                    source: "rules" | "model" | "correction";
                    modelNote?: string | undefined;
                };
            }>;
            corrections: {
                repo: string;
                number: number;
                judgment: {
                    priority: "高" | "中" | "低";
                    reason: string;
                    evidence: string[];
                    kind: "issue";
                    type: "bug" | "需求" | "提问" | "重复" | "无效";
                    real: "是" | "待证实" | "否";
                    worth: "值得修" | "待补充" | "不值得修";
                    impact: string;
                    severity: string;
                    cost: string;
                } | {
                    priority: "高" | "中" | "低";
                    reason: string;
                    evidence: string[];
                    kind: "pr";
                    verdict: "值得合并" | "改完再合" | "不建议合";
                    risk: "高" | "中" | "低";
                    suspicious: boolean;
                };
                reason: string;
                at: number;
                title: string;
            }[];
            reports: Record<string, {
                repo: string;
                at: number;
                results: {
                    number: number;
                    title: string;
                    url: string;
                    judgment: {
                        priority: "高" | "中" | "低";
                        reason: string;
                        evidence: string[];
                        kind: "issue";
                        type: "bug" | "需求" | "提问" | "重复" | "无效";
                        real: "是" | "待证实" | "否";
                        worth: "值得修" | "待补充" | "不值得修";
                        impact: string;
                        severity: string;
                        cost: string;
                    } | {
                        priority: "高" | "中" | "低";
                        reason: string;
                        evidence: string[];
                        kind: "pr";
                        verdict: "值得合并" | "改完再合" | "不建议合";
                        risk: "高" | "中" | "低";
                        suspicious: boolean;
                    };
                    source: "rules" | "model" | "correction";
                    modelNote?: string | undefined;
                }[];
                analyzed: number;
                reused: number;
                changed: number[];
                warnings: string[];
                briefing?: string | undefined;
            }>;
            lastRun: Record<string, number>;
            pending: Record<string, string>;
        };
    };
};
/** Retain bounded derived cache; corrections remain separate authoritative records. */
export declare function prune(state: State): void;
