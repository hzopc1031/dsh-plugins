import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { type UiCall } from './ui-contract.js';
export declare class UiError extends Error {
    fields?: Record<string, string> | undefined;
    constructor(message: string, fields?: Record<string, string> | undefined);
}
/** Only an absent route may use the explicit legacy session adapter. Never
 * retry a mutation after a network timeout or malformed/success response. */
export declare function postCall(fetcher?: typeof fetch, fallback?: UiCall): UiCall;
type Execute = (sessionId: PropsRuntime<'conversation.session.header.actions'>['sessionId'], line: string, attachments: []) => Promise<unknown>;
export declare function commandCall(execute: Execute, sessionId: Parameters<Execute>[0]): UiCall;
export {};
