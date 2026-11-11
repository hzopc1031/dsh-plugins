import type { Context } from '@deepseek-ai/cordis';
import type { Action, ActionArgs, AdvisoryService } from './surface.js';
export declare const PANEL_PATH = "/advisory-impact/api";
export declare function panelRequest(value: unknown): {
    directory: string;
    action: Action;
    args: ActionArgs;
};
export declare function registerPanel(ctx: Context, service: AdvisoryService): void;
