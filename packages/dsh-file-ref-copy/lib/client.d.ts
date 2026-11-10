import type { Context } from '@deepseek-ai/cordis';
export type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
export type {} from '@deepseek-ai/dsh-client-ui-chat/client';
export type {} from '@deepseek-ai/dsh-client-ui-session/client';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
export declare const inject: string[];
type Props = PropsRuntime<'conversation.chat.assistant-actions'>;
declare module '@deepseek-ai/dsh-session-projection/types' {
    interface SessionProjectionMap {
        workingDirectory: string | null;
    }
}
export declare function FileRefCopy({ messageId, sessionId, useChat, useProjection }: Props): import("react").JSX.Element | null;
export declare function apply(ctx: Context): void;
