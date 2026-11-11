import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export { ContentEvidenceService } from './service.js';
export { enterWorkbench, toolNames } from './tools.js';
export type * from './model.js';
export declare const name = "content-evidence";
export declare const inject: string[];
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    extraSensitiveTerms: z<string[], string[], "plain">;
    dataDir: z<string, string, "plain">;
}>>, Schemastery.ObjectT<NoInfer<{
    extraSensitiveTerms: z<string[], string[], "plain">;
    dataDir: z<string, string, "plain">;
}>>, "plain">;
export type Config = ReturnType<typeof Config>;
export declare function apply(ctx: Context, config?: Partial<Config>): void;
