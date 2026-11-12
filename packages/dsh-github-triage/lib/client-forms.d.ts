import type { Repo } from './types.js';
import { type Snapshot, type Job, type UiCall } from './ui-contract.js';
export declare function RepoForm({ initial, call, onSaved, onCancel }: {
    initial?: Repo;
    call: UiCall;
    onSaved: () => Promise<void>;
    onCancel: () => void;
}): import("react").JSX.Element;
export declare function ScanControl({ repo, job, defaults, call, onStarted, initialFull }: {
    repo: Repo;
    job?: Job;
    defaults: Snapshot['defaults'];
    call: UiCall;
    onStarted: () => Promise<void>;
    initialFull?: boolean;
}): import("react").JSX.Element;
