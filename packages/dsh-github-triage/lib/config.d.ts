import { type Scan, type Repo, type State } from './types.js';
export declare function repositories(config: Repo[], state: State): Repo[];
/** Shell-like quoting without expansion; preserve Windows path backslashes. */
export declare function tokens(raw: string): string[];
export declare function repoCommand(raw: string, state: State, config?: Repo[]): string;
export interface RunArguments extends Scan {
    repo?: string;
    limit?: number;
    max?: number;
}
export declare function runArguments(raw: string): RunArguments;
