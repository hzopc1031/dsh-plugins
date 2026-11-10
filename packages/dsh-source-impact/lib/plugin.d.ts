import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "source-impact";
export declare const inject: string[];
export declare const Config: z<Schemastery.ObjectS<{}>, Schemastery.ObjectT<{}>, "plain">;
export declare const HELP: string;
export declare function apply(ctx: Context): void;
