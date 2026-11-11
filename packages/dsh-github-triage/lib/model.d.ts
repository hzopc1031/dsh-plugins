import { z } from 'zod';
import type { Context } from '@deepseek-ai/cordis';
import { type Judgment, type Model, type Settings } from './types.js';
export declare const outputJsonSchema: z.core.ZodStandardJSONSchemaPayload<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
export declare const noModel = "\u672A\u914D\u7F6E\u6A21\u578B\uFF0C\u65E0\u6CD5 AI \u7814\u5224\uFF1A\u8BF7\u5728\u63D2\u4EF6\u914D\u7F6E\u4E2D\u586B\u5199 model\uFF08DSH \u5DF2\u6CE8\u518C\u7684 provider/model\uFF09\uFF1Bprovider \u4E0E model \u5206\u522B\u586B\u5199";
export declare function listModels(ctx: Context): Promise<string>;
export declare function parseJudgment(input: string, kind: Judgment['kind']): Judgment;
export declare function modelWarning(ctx: Context, config: Settings): string | undefined;
export declare function dshModel(ctx: Context, config: Settings): Model | undefined;
