import { type Session, type SessionEvent } from '@deepseek-ai/dsh-session';
import { defaults, type Call, type Segment } from './core.js';
export interface Boundary {
    version: 1;
    to: number;
    file: string;
}
declare module '@deepseek-ai/dsh-session/types' {
    interface PluginRecordMap {
        'plugin:task-review/call': Call;
        'plugin:task-review/boundary': Boundary;
    }
}
export declare function boundary(events: readonly SessionEvent[]): number;
export declare function mark(session: Session, to: number, file: string): void;
/** Read only the unreviewed suffix; inherited fork prefixes are excluded. */
export declare function segment(session: Session, now?: number): Segment | null;
export { defaults };
