import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "apache-radar";
export declare const inject: string[];
export interface Config {
    watchList?: string[];
}
export declare const Config: z<Config>;
export declare const HELP: string;
export declare function apply(ctx: Context, config?: Config): void;
