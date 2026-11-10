import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { type Options } from './core.js';
export declare const name = "dsh-direnjie-theme";
export type Config = Options;
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    enabled: z<boolean, boolean, "defined">;
    musicPath: z<string, string, "defined">;
    volume: z<number, number, "defined">;
    loop: z<boolean, boolean, "defined">;
    autoplay: z<boolean, boolean, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    enabled: z<boolean, boolean, "defined">;
    musicPath: z<string, string, "defined">;
    volume: z<number, number, "defined">;
    loop: z<boolean, boolean, "defined">;
    autoplay: z<boolean, boolean, "defined">;
}>>, "plain">;
export declare const inject: string[];
export declare function apply(ctx: Context, config: Config): void;
