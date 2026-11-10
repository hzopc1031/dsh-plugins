import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "dll-doctor";
export declare const inject: string[];
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    dependenciesExe: z<string, string, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    dependenciesExe: z<string, string, "defined">;
}>>, "plain">;
export interface Settings {
    dependenciesExe?: string;
}
export declare function parseInput(input: string): {
    file: string;
    depth: number;
};
export declare function apply(ctx: Context, settings?: Settings): void;
