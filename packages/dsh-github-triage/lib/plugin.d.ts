import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { type Settings } from './types.js';
export declare const name = "github-triage";
export declare const inject: string[];
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    repositories: z<({
        repo?: string | null | undefined;
        business?: string | null | undefined;
        businessFile?: string | null | undefined;
        mode?: "issues" | "prs" | "both" | null | undefined;
        daily?: string | null | undefined;
        everyHours?: number | null | undefined;
        limit?: number | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<NoInfer<{
        repo: z<string, string, "defined">;
        business: z<string, string, "defined">;
        businessFile: z<string, string, "defined">;
        mode: z<"issues" | "prs" | "both", "issues" | "prs" | "both", "defined">;
        daily: z<string, string, "defined">;
        everyHours: z<number, number, "defined">;
        limit: z<number, number, "plain">;
    }>>[], "defined">;
    limit: z<number, number, "defined">;
    modelEnabled: z<boolean, boolean, "defined">;
    provider: z<string, string, "defined">;
    model: z<string, string, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    repositories: z<({
        repo?: string | null | undefined;
        business?: string | null | undefined;
        businessFile?: string | null | undefined;
        mode?: "issues" | "prs" | "both" | null | undefined;
        daily?: string | null | undefined;
        everyHours?: number | null | undefined;
        limit?: number | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<NoInfer<{
        repo: z<string, string, "defined">;
        business: z<string, string, "defined">;
        businessFile: z<string, string, "defined">;
        mode: z<"issues" | "prs" | "both", "issues" | "prs" | "both", "defined">;
        daily: z<string, string, "defined">;
        everyHours: z<number, number, "defined">;
        limit: z<number, number, "plain">;
    }>>[], "defined">;
    limit: z<number, number, "defined">;
    modelEnabled: z<boolean, boolean, "defined">;
    provider: z<string, string, "defined">;
    model: z<string, string, "defined">;
}>>, "plain">;
export interface Input {
    repositories?: {
        repo: string;
        mode?: 'issues' | 'prs' | 'both';
        daily?: string;
        everyHours?: number;
        limit?: number;
        business?: string;
        businessFile?: string;
    }[];
    limit?: number;
    modelEnabled?: boolean;
    provider?: string;
    model?: string;
}
export declare function settings(input: Input): Settings;
export declare function apply(ctx: Context, input?: Input): Promise<void>;
