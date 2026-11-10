import { type SessionEvent } from '@deepseek-ai/dsh-session';
import type { ObservedMessage } from './core.js';
export interface AssemblyEvidence {
    prompt: string;
    sections: {
        name: string;
        text: string;
    }[];
}
/** Same canonical fold/interpreters as rc.5 Session Query; no raw-log membership guesses. */
export declare function observeMessages(events: readonly SessionEvent[], assemblies?: readonly AssemblyEvidence[]): ObservedMessage[];
