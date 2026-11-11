import type { Context } from '@deepseek-ai/cordis';
export type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
export type {} from '@deepseek-ai/dsh-client-ui-session/client';
export type {} from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
declare module '@deepseek-ai/dsh-session-projection/types' {
    interface SessionProjectionMap {
        title: string | null;
        workingDirectory: string | null;
    }
}
export declare const inject: string[];
type Props = PropsRuntime<'conversation.session.header.actions'>;
export declare function DraftRescue(props: Props): import("react").JSX.Element;
export declare function apply(ctx: Context): void;
