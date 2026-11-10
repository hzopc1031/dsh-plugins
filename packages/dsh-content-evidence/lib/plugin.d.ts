import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "content-evidence";
export declare const inject: string[];
export declare const Config: z<Schemastery.ObjectS<{}>, Schemastery.ObjectT<{}>, "plain">;
export type Config = ReturnType<typeof Config>;
export declare function apply(ctx: Context): void;
