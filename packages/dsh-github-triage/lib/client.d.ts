import type { Context } from '@deepseek-ai/cordis';
export type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
export type {} from '@deepseek-ai/dsh-client-ui-conversation/client';
export type {} from '@deepseek-ai/dsh-api-remotes/client';
import type { UiCall, UiReport } from './ui-contract.js';
import { commandCall, postCall } from './client-route.js';
import { RepoForm } from './client-forms.js';
export { RepoForm, commandCall, postCall };
export { UiError } from './client-route.js';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface SlotMap {
        'main': {
            kind: 'keyed';
            scope: 'root';
        };
        'sidebar.panellist': {
            kind: 'list';
            scope: 'root';
            owner: {
                size: number;
                active: boolean;
            };
        };
    }
    interface LocaleNamespaceMap {
        'github-triage': 'title';
    }
}
export declare const inject: string[];
export declare const PANEL_ID = "dsh-github-triage";
export declare function safeLink(raw: string): string | undefined;
export declare function Results({ reports, selected, call, onChanged, onSelect }: {
    reports: UiReport[];
    selected: string;
    call: UiCall;
    onChanged: () => Promise<void>;
    onSelect?: (repo: string) => void;
}): import("react").JSX.Element;
export declare function Dashboard({ call, openSettings }: {
    call: UiCall;
    openSettings?: () => boolean;
}): import("react").JSX.Element;
export declare function TriageButton({ call, sessionId, openPage }: {
    call: UiCall;
    sessionId: string;
    openPage?: () => boolean;
}): import("react").JSX.Element;
export declare function apply(ctx: Context): void;
