import { type ToolDefinition, type ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { Action, ActionArgs } from './surface.js';
export declare const TOOL_NAMES: string[];
export declare function argumentError(name: string, value: unknown): string | undefined;
export declare function directoryError(directory: string | undefined): string | undefined;
export declare function toolDefinitions(run: (action: Action, args: ActionArgs, exec: ToolRunContext) => Promise<string>): ToolDefinition[];
