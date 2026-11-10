import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare function resolveDirectory(ctx: {
    get?(name: string): unknown;
}, session: {
    header: {
        cwd?: string;
    };
}): {
    path?: string;
    source: 'current' | 'fallback' | 'missing';
};
export declare function directoryLine(info: {
    path?: string;
    source: string;
}): string;
export declare const name = "source-impact";
export declare const inject: string[];
export declare const Config: z<Schemastery.ObjectS<{}>, Schemastery.ObjectT<{}>, "plain">;
export declare const HELP: string;
export declare function apply(ctx: Context): void;
