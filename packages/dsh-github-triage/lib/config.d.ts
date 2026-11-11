import { type Repo, type State } from './types.js';
export declare function repositories(config: Repo[], state: State): Repo[];
export declare function repoCommand(raw: string, state: State): string;
export declare function runArguments(raw: string): {
    repo?: string;
    limit?: number;
};
