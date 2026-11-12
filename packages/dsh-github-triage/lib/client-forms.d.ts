import type { Repo } from './types.js';
import { type Snapshot, type Job, type UiCall } from './ui-contract.js';
export declare function RepoForm({ initial, call, onSaved, onCancel, onBusyChange }: {
    initial?: Repo;
    call: UiCall;
    onSaved: () => Promise<void>;
    onCancel: () => void;
    onBusyChange?: (busy: boolean) => void;
}): import("react").JSX.Element;
export declare function ScanExplanation({ repo, defaults }: {
    repo: Repo;
    defaults: Snapshot['defaults'];
}): import("react").JSX.Element;
export declare function ScanControl({ repo, job, defaults, call, onStarted, initialFull }: {
    repo: Repo;
    job?: Job;
    defaults: Snapshot['defaults'];
    call: UiCall;
    onStarted: () => Promise<void>;
    initialFull?: boolean;
}): import("react").JSX.Element;
