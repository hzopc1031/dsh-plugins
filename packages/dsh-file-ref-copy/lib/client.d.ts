import type { Context } from '@deepseek-ai/cordis';
export type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
export type {} from '@deepseek-ai/dsh-client-ui-chat/client';
export type {} from '@deepseek-ai/dsh-client-ui-session/client';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
export declare const inject: string[];
type Props = PropsRuntime<'conversation.chat.assistant-actions'>;
export declare function FileRefCopy({ messageId, sessionId, useChat, useSessions }: Props): import("react").JSX.Element | null;
export declare function apply(ctx: Context): void;
