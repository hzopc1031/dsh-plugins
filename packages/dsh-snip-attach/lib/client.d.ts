import type { Context } from '@deepseek-ai/cordis';
export type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
export type {} from '@deepseek-ai/dsh-client-ui-conversation/client';
export type {} from '@deepseek-ai/dsh-client-ui-session/client';
export type {} from '@deepseek-ai/dsh-api-remotes/client';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
export declare const inject: string[];
type Props = PropsRuntime<'conversation.input.left'>;
export type Execute = Context['remote']['commands']['execute'];
export declare function SnipButton({ sessionId, useInput, useSession, execute }: Props & {
    execute: Execute;
}): import("react").JSX.Element;
export declare function apply(ctx: Context): void;
