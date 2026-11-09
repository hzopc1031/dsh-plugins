import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { type Change, type Settings } from './core.js';
export declare const name = "task-review";
export declare const inject: string[];
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    auto: z<boolean, boolean, "defined">;
    toolThreshold: z<number, number, "defined">;
    fileThreshold: z<number, number, "defined">;
    durationMinutes: z<number, number, "defined">;
    reportDir: z<string, string, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    auto: z<boolean, boolean, "defined">;
    toolThreshold: z<number, number, "defined">;
    fileThreshold: z<number, number, "defined">;
    durationMinutes: z<number, number, "defined">;
    reportDir: z<string, string, "defined">;
}>>, "plain">;
/** Only known file-tool domain results establish a mutation, never tool-name guesses. */
export declare function fileChanges(name: string, value: unknown): Change[];
export declare function apply(ctx: Context, input?: Partial<Settings>): void;
