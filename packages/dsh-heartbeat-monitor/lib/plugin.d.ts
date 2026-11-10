import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { type Settings } from './core.js';
export declare const name = "heartbeat";
export declare const inject: string[];
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    enabled: z<boolean, boolean, "defined">;
    intervalMinutes: z<number, number, "defined">;
    silenceMinutes: z<number, number, "defined">;
    repeatThreshold: z<number, number, "defined">;
    repeatByNameOnly: z<boolean, boolean, "defined">;
    progressCards: z<boolean, boolean, "defined">;
    systemNotification: z<boolean, boolean, "defined">;
    notifyProgress: z<boolean, boolean, "defined">;
    includeSubagents: z<boolean, boolean, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    enabled: z<boolean, boolean, "defined">;
    intervalMinutes: z<number, number, "defined">;
    silenceMinutes: z<number, number, "defined">;
    repeatThreshold: z<number, number, "defined">;
    repeatByNameOnly: z<boolean, boolean, "defined">;
    progressCards: z<boolean, boolean, "defined">;
    systemNotification: z<boolean, boolean, "defined">;
    notifyProgress: z<boolean, boolean, "defined">;
    includeSubagents: z<boolean, boolean, "defined">;
}>>, "plain">;
/** How often the shared timer re-evaluates active runs. */
export declare const TICK_MS = 15000;
export declare function apply(ctx: Context, input?: Partial<Settings>): void;
