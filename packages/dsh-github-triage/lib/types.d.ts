import { z } from 'zod';
export declare const repoName: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
export declare const limitSchema: z.ZodNumber;
export declare const scheduleSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"daily">;
    time: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"every">;
    hours: z.ZodNumber;
}, z.core.$strict>], "kind">;
export declare const repoSchema: z.ZodObject<{
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
}, z.core.$strip>;
export type Repo = z.infer<typeof repoSchema>;
export type Schedule = z.infer<typeof scheduleSchema>;
export interface Settings {
    repositories: Repo[];
    limit: number;
    provider: string;
    model: string;
    modelEnabled: boolean;
}
export interface Item {
    number: number;
    kind: 'issue' | 'pr';
    title: string;
    body: string;
    updated_at: string;
    url: string;
    head?: string;
    files?: {
        path: string;
        additions: number;
        deletions: number;
        patch?: string;
    }[];
    additions?: number;
    deletions?: number;
    changedFiles?: number;
    draft?: boolean;
    ci?: {
        name: string;
        state: 'pass' | 'fail' | 'pending';
    }[];
    linked?: {
        number: number;
        title: string;
        body: string;
    }[];
    locations?: string[];
    notes?: string[];
    snippets?: {
        path: string;
        text: string;
        truncated: boolean;
    }[];
}
export declare const issueJudgment: z.ZodObject<{
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
        confirmed: "confirmed";
        likely: "likely";
        unclear: "unclear";
        not_a_bug: "not_a_bug";
    }>;
    worthFixing: z.ZodEnum<{
        值得修: "值得修";
        待补充: "待补充";
        不值得修: "不值得修";
    }>;
    priority: z.ZodEnum<{
        高: "高";
        中: "中";
        低: "低";
    }>;
}, z.core.$strict>;
export declare const prJudgment: z.ZodObject<{
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
}, z.core.$strict>;
export declare const judgmentSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
        confirmed: "confirmed";
        likely: "likely";
        unclear: "unclear";
        not_a_bug: "not_a_bug";
    }>;
    worthFixing: z.ZodEnum<{
        值得修: "值得修";
        待补充: "待补充";
        不值得修: "不值得修";
    }>;
    priority: z.ZodEnum<{
        高: "高";
        中: "中";
        低: "低";
    }>;
}, z.core.$strict>, z.ZodObject<{
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
}, z.core.$strict>], "kind">;
export type Judgment = z.infer<typeof judgmentSchema>;
export declare const resultSchema: z.ZodObject<{
    number: z.ZodNumber;
    title: z.ZodString;
    url: z.ZodString;
    kind: z.ZodEnum<{
        issue: "issue";
        pr: "pr";
    }>;
    judgment: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
            confirmed: "confirmed";
            likely: "likely";
            unclear: "unclear";
            not_a_bug: "not_a_bug";
        }>;
        worthFixing: z.ZodEnum<{
            值得修: "值得修";
            待补充: "待补充";
            不值得修: "不值得修";
        }>;
        priority: z.ZodEnum<{
            高: "高";
            中: "中";
            低: "低";
        }>;
    }, z.core.$strict>, z.ZodObject<{
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
    observation: z.ZodOptional<z.ZodString>;
    source: z.ZodEnum<{
        rules: "rules";
        model: "model";
        correction: "correction";
    }>;
    modelNote: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type Result = z.infer<typeof resultSchema>;
export declare const correctionSchema: z.ZodObject<{
    repo: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    number: z.ZodNumber;
    judgment: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
            confirmed: "confirmed";
            likely: "likely";
            unclear: "unclear";
            not_a_bug: "not_a_bug";
        }>;
        worthFixing: z.ZodEnum<{
            值得修: "值得修";
            待补充: "待补充";
            不值得修: "不值得修";
        }>;
        priority: z.ZodEnum<{
            高: "高";
            中: "中";
            低: "低";
        }>;
    }, z.core.$strict>, z.ZodObject<{
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
    }, z.core.$strict>], "kind">;
    reason: z.ZodString;
    at: z.ZodNumber;
    title: z.ZodString;
}, z.core.$strip>;
export type Correction = z.infer<typeof correctionSchema>;
export declare const reportSchema: z.ZodObject<{
    repo: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    at: z.ZodNumber;
    results: z.ZodArray<z.ZodObject<{
        number: z.ZodNumber;
        title: z.ZodString;
        url: z.ZodString;
        kind: z.ZodEnum<{
            issue: "issue";
            pr: "pr";
        }>;
        judgment: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
                confirmed: "confirmed";
                likely: "likely";
                unclear: "unclear";
                not_a_bug: "not_a_bug";
            }>;
            worthFixing: z.ZodEnum<{
                值得修: "值得修";
                待补充: "待补充";
                不值得修: "不值得修";
            }>;
            priority: z.ZodEnum<{
                高: "高";
                中: "中";
                低: "低";
            }>;
        }, z.core.$strict>, z.ZodObject<{
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
        observation: z.ZodOptional<z.ZodString>;
        source: z.ZodEnum<{
            rules: "rules";
            model: "model";
            correction: "correction";
        }>;
        modelNote: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    analyzed: z.ZodNumber;
    reused: z.ZodNumber;
    changed: z.ZodArray<z.ZodNumber>;
    briefing: z.ZodOptional<z.ZodString>;
    warnings: z.ZodArray<z.ZodString>;
    businessStatus: z.ZodString;
    modelStatus: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type Report = z.infer<typeof reportSchema>;
declare const currentStateSchema: z.ZodObject<{
    formatVersion: z.ZodLiteral<2>;
    overrides: z.ZodRecord<z.ZodString, z.ZodObject<{
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
    }, z.core.$strip>>;
    removed: z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
    cache: z.ZodRecord<z.ZodString, z.ZodObject<{
        fingerprint: z.ZodString;
        result: z.ZodObject<{
            number: z.ZodNumber;
            title: z.ZodString;
            url: z.ZodString;
            kind: z.ZodEnum<{
                issue: "issue";
                pr: "pr";
            }>;
            judgment: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
                    confirmed: "confirmed";
                    likely: "likely";
                    unclear: "unclear";
                    not_a_bug: "not_a_bug";
                }>;
                worthFixing: z.ZodEnum<{
                    值得修: "值得修";
                    待补充: "待补充";
                    不值得修: "不值得修";
                }>;
                priority: z.ZodEnum<{
                    高: "高";
                    中: "中";
                    低: "低";
                }>;
            }, z.core.$strict>, z.ZodObject<{
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
            observation: z.ZodOptional<z.ZodString>;
            source: z.ZodEnum<{
                rules: "rules";
                model: "model";
                correction: "correction";
            }>;
            modelNote: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>>;
    corrections: z.ZodArray<z.ZodObject<{
        repo: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        number: z.ZodNumber;
        judgment: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
                confirmed: "confirmed";
                likely: "likely";
                unclear: "unclear";
                not_a_bug: "not_a_bug";
            }>;
            worthFixing: z.ZodEnum<{
                值得修: "值得修";
                待补充: "待补充";
                不值得修: "不值得修";
            }>;
            priority: z.ZodEnum<{
                高: "高";
                中: "中";
                低: "低";
            }>;
        }, z.core.$strict>, z.ZodObject<{
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
        }, z.core.$strict>], "kind">;
        reason: z.ZodString;
        at: z.ZodNumber;
        title: z.ZodString;
    }, z.core.$strip>>;
    reports: z.ZodRecord<z.ZodString, z.ZodObject<{
        repo: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        at: z.ZodNumber;
        results: z.ZodArray<z.ZodObject<{
            number: z.ZodNumber;
            title: z.ZodString;
            url: z.ZodString;
            kind: z.ZodEnum<{
                issue: "issue";
                pr: "pr";
            }>;
            judgment: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
                    confirmed: "confirmed";
                    likely: "likely";
                    unclear: "unclear";
                    not_a_bug: "not_a_bug";
                }>;
                worthFixing: z.ZodEnum<{
                    值得修: "值得修";
                    待补充: "待补充";
                    不值得修: "不值得修";
                }>;
                priority: z.ZodEnum<{
                    高: "高";
                    中: "中";
                    低: "低";
                }>;
            }, z.core.$strict>, z.ZodObject<{
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
            observation: z.ZodOptional<z.ZodString>;
            source: z.ZodEnum<{
                rules: "rules";
                model: "model";
                correction: "correction";
            }>;
            modelNote: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        analyzed: z.ZodNumber;
        reused: z.ZodNumber;
        changed: z.ZodArray<z.ZodNumber>;
        briefing: z.ZodOptional<z.ZodString>;
        warnings: z.ZodArray<z.ZodString>;
        businessStatus: z.ZodString;
        modelStatus: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    lastRun: z.ZodRecord<z.ZodString, z.ZodNumber>;
    pending: z.ZodRecord<z.ZodString, z.ZodString>;
}, z.core.$strip>;
export type State = z.infer<typeof currentStateSchema>;
export declare function emptyState(): State;
export type Model = (prompt: string, signal?: AbortSignal) => Promise<string>;
export declare const stateSchema: z.ZodPreprocess<z.ZodObject<{
    formatVersion: z.ZodLiteral<2>;
    overrides: z.ZodRecord<z.ZodString, z.ZodObject<{
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
    }, z.core.$strip>>;
    removed: z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
    cache: z.ZodRecord<z.ZodString, z.ZodObject<{
        fingerprint: z.ZodString;
        result: z.ZodObject<{
            number: z.ZodNumber;
            title: z.ZodString;
            url: z.ZodString;
            kind: z.ZodEnum<{
                issue: "issue";
                pr: "pr";
            }>;
            judgment: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
                    confirmed: "confirmed";
                    likely: "likely";
                    unclear: "unclear";
                    not_a_bug: "not_a_bug";
                }>;
                worthFixing: z.ZodEnum<{
                    值得修: "值得修";
                    待补充: "待补充";
                    不值得修: "不值得修";
                }>;
                priority: z.ZodEnum<{
                    高: "高";
                    中: "中";
                    低: "低";
                }>;
            }, z.core.$strict>, z.ZodObject<{
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
            observation: z.ZodOptional<z.ZodString>;
            source: z.ZodEnum<{
                rules: "rules";
                model: "model";
                correction: "correction";
            }>;
            modelNote: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>>;
    corrections: z.ZodArray<z.ZodObject<{
        repo: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        number: z.ZodNumber;
        judgment: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
                confirmed: "confirmed";
                likely: "likely";
                unclear: "unclear";
                not_a_bug: "not_a_bug";
            }>;
            worthFixing: z.ZodEnum<{
                值得修: "值得修";
                待补充: "待补充";
                不值得修: "不值得修";
            }>;
            priority: z.ZodEnum<{
                高: "高";
                中: "中";
                低: "低";
            }>;
        }, z.core.$strict>, z.ZodObject<{
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
        }, z.core.$strict>], "kind">;
        reason: z.ZodString;
        at: z.ZodNumber;
        title: z.ZodString;
    }, z.core.$strip>>;
    reports: z.ZodRecord<z.ZodString, z.ZodObject<{
        repo: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        at: z.ZodNumber;
        results: z.ZodArray<z.ZodObject<{
            number: z.ZodNumber;
            title: z.ZodString;
            url: z.ZodString;
            kind: z.ZodEnum<{
                issue: "issue";
                pr: "pr";
            }>;
            judgment: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
                    confirmed: "confirmed";
                    likely: "likely";
                    unclear: "unclear";
                    not_a_bug: "not_a_bug";
                }>;
                worthFixing: z.ZodEnum<{
                    值得修: "值得修";
                    待补充: "待补充";
                    不值得修: "不值得修";
                }>;
                priority: z.ZodEnum<{
                    高: "高";
                    中: "中";
                    低: "低";
                }>;
            }, z.core.$strict>, z.ZodObject<{
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
            observation: z.ZodOptional<z.ZodString>;
            source: z.ZodEnum<{
                rules: "rules";
                model: "model";
                correction: "correction";
            }>;
            modelNote: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        analyzed: z.ZodNumber;
        reused: z.ZodNumber;
        changed: z.ZodArray<z.ZodNumber>;
        briefing: z.ZodOptional<z.ZodString>;
        warnings: z.ZodArray<z.ZodString>;
        businessStatus: z.ZodString;
        modelStatus: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    lastRun: z.ZodRecord<z.ZodString, z.ZodNumber>;
    pending: z.ZodRecord<z.ZodString, z.ZodString>;
}, z.core.$strip>>;
export {};
