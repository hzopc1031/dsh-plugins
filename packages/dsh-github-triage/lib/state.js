import { defineDomain } from '@deepseek-ai/dsh-storage-domain';
import { emptyState, stateSchema } from './types.js';
export const domainSpec = defineDomain({
    name: 'github_triage', version: 1, tables: {},
    global: { schema: stateSchema, initial: emptyState() },
});
/** Retain bounded derived cache; corrections remain separate authoritative records. */
export function prune(state) {
    const keys = Object.keys(state.cache);
    for (const key of keys.slice(0, Math.max(0, keys.length - 5000)))
        delete state.cache[key];
}
