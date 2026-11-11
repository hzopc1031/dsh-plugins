import type { Context } from '@deepseek-ai/cordis';
export type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
export type {} from '@deepseek-ai/dsh-client-ui-conversation/client';
export type {} from '@deepseek-ai/dsh-api-remotes/client';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { type Repo, type Report } from './types.js';
import { type UiCall } from './ui-contract.js';
export declare const inject: string[];
export declare class UiError extends Error {
    fields?: Record<string, string> | undefined;
    constructor(message: string, fields?: Record<string, string> | undefined);
}
type Execute = (sessionId: PropsRuntime<'conversation.session.header.actions'>['sessionId'], line: string, attachments: []) => Promise<unknown>;
export declare function commandCall(execute: Execute, sessionId: Parameters<Execute>[0]): UiCall;
export declare function RepoForm({ initial, call, onSaved, onCancel }: {
    initial?: Repo;
    call: UiCall;
    onSaved: () => Promise<void>;
    onCancel: () => void;
}): import("react").JSX.Element;
export declare function safeLink(raw: string): string | undefined;
export declare function Results({ reports, selected, call, onChanged }: {
    reports: Report[];
    selected: string;
    call: UiCall;
    onChanged: () => Promise<void>;
}): import("react").JSX.Element;
export declare function Dashboard({ call }: {
    call: UiCall;
}): import("react").JSX.Element;
export declare function TriageButton({ call, sessionId }: {
    call: UiCall;
    sessionId: string;
}): import("react").JSX.Element;
export declare function apply(ctx: Context): void;
