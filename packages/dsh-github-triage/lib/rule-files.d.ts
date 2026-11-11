import { type Repo, type State } from './types.js';
import { SafeText } from './safety.js';
export declare const RULE_PROMPT_LIMIT: number;
/** A Markdown document in the plugin's own domain, never auto-written to a repository. */
export declare function rulesDocument(repo: string, state: State, business?: string): string;
export declare function importDocument(repo: string, text: string, state: State, safe?: SafeText): void;
export declare function loadRules(repo: Repo, state: State, business: string, safe: SafeText): Promise<{
    text: string;
    status: string;
    fingerprint: string;
}>;
/** The only user-file write in this plugin. Existing files require explicit --force. */
export declare function exportDocument(file: string, text: string, force?: boolean): Promise<void>;
export declare function rulesCommand(raw: string, state: State, repos: Repo[], safe: SafeText): Promise<string>;
