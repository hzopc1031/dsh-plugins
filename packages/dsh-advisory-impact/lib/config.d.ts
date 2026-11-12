import z from '@deepseek-ai/schemastery';
import type { VersionPin } from './types.js';
export declare const DEFAULT_WATCH: readonly ["kafka", "hadoop", "flink"];
export declare const PIN_FILE = ".advisory-impact.json";
export declare const DEFAULT_TTL_MS: number;
export interface ProductPin extends VersionPin {
    project: string;
}
export interface Settings {
    watch: string[];
    pins: ProductPin[];
    cacheTtlMs: number;
}
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    offlineOnly: z<boolean, boolean, "defined">;
    watch: z<string[], string[], "defined">;
    pins: z<({
        project?: string | null | undefined;
        version?: string | null | undefined;
        component?: string | null | undefined;
        maven?: string | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<NoInfer<{
        project: z<string, string, "defined">;
        version: z<string, string, "defined">;
        component: z<string, string, "plain">;
        maven: z<string, string, "plain">;
    }>>[], "defined">;
    cacheTtlMs: z<number, number, "defined">;
    systemProxy: z<"auto" | "off">;
    timeoutSeconds: z<number>;
    httpsProxy: z<string>;
    noProxy: z<string>;
    caBundlePath: z<string>;
    insecureSkipTlsVerify: z<boolean>;
}>>, Schemastery.ObjectT<NoInfer<{
    offlineOnly: z<boolean, boolean, "defined">;
    watch: z<string[], string[], "defined">;
    pins: z<({
        project?: string | null | undefined;
        version?: string | null | undefined;
        component?: string | null | undefined;
        maven?: string | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<NoInfer<{
        project: z<string, string, "defined">;
        version: z<string, string, "defined">;
        component: z<string, string, "plain">;
        maven: z<string, string, "plain">;
    }>>[], "defined">;
    cacheTtlMs: z<number, number, "defined">;
    systemProxy: z<"auto" | "off">;
    timeoutSeconds: z<number>;
    httpsProxy: z<string>;
    noProxy: z<string>;
    caBundlePath: z<string>;
    insecureSkipTlsVerify: z<boolean>;
}>>, "plain">;
export declare function parseSettings(value?: unknown): Settings;
/** Re-read on every evaluation so edits apply without a restart; file fields override plugin config. */
export declare function loadSettings(config?: unknown, projectDirectory?: string): Promise<Settings>;
export declare function saveSettings(projectDirectory: string, config: unknown): Promise<void>;
