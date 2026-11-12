import type { Context } from '@deepseek-ai/cordis';
interface Entry {
    fiber?: unknown;
    options: {
        config?: Record<string, unknown>;
    };
}
interface Editor {
    entries(): Entry[];
    edit(entry: Entry, change: (current: Record<string, unknown>) => Record<string, unknown>): Promise<void>;
}
export declare function networkConfigHandler(editor: Editor | undefined, fiber: unknown): (request: Request) => Promise<Response>;
export declare function registerNetworkSettings(ctx: Context, id: string): void;
export {};
