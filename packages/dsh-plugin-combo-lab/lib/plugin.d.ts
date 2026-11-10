import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "plugin-combo-lab";
export declare const inject: string[];
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    reportDir: z<string, string, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    reportDir: z<string, string, "defined">;
}>>, "plain">;
export interface Settings {
    reportDir: string;
}
export declare function apply(ctx: Context, settings?: Partial<Settings>): void;
