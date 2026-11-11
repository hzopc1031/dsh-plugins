import { defineTool } from '@deepseek-ai/dsh-tools';
import z from '@deepseek-ai/schemastery';
import { DEFAULT_WATCH_LIST, resolveWatchList } from './watch.js';
import { createHttpClient } from './http.js';
import { validDirectory } from './local-files.js';
import { runRadar } from './radar.js';
import { message } from './messages.js';
import { renderCommandResult } from './command.js';
export const name = 'apache-radar';
export const inject = ['commands', 'tools', 'agents'];
export const Config = z.object({
    watchList: z.array(z.string()).default([...DEFAULT_WATCH_LIST]).description(message('config.watchList')),
});
export const HELP = message('command.help');
const actions = ['refresh', 'counts', 'watch', 'brief', 'open', 'lookup'];
const toolNames = actions.map(action => `apache_radar_${action}`);
export function apply(ctx, config = {}) {
    const watchList = resolveWatchList(config.watchList);
    const http = createHttpClient();
    const directoryOf = (agent) => {
        if (!agent)
            return undefined;
        const service = ctx.get?.('workingDirectory');
        return service ? service.get(agent.session) : agent.session.header.cwd;
    };
    // Serialize file transactions, including calls from different agents sharing a directory.
    let queue = Promise.resolve();
    const run = (directory, action, args = {}) => {
        if (!validDirectory(directory))
            return Promise.reject(new Error(message('errors.directory')));
        const result = queue.then(() => runRadar(directory, action, args, { watchList, http }));
        queue = result.catch(() => { });
        return result;
    };
    for (const action of actions) {
        const parameters = action === 'watch' ? {
            operation: { type: 'string', enum: ['get', 'add', 'remove'] }, project: { type: 'string' },
        } : action === 'lookup' ? { query: { type: 'string', required: true }, project: { type: 'string' } }
            : action === 'open' ? { includeMarkdown: { type: 'boolean' } } : {};
        ctx.effect(() => ctx.tools.register(defineTool({
            name: `apache_radar_${action}`,
            description: message('tools.description', { action, detail: message(action === 'lookup' ? 'tools.lookup' : action === 'open' ? 'tools.open' : 'tools.summary') }),
            parameters,
            output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
            async execute(args, exec) {
                if (Object.keys(args).some(key => !Object.hasOwn(parameters, key)))
                    throw new Error(message('errors.extraArgs'));
                return run(directoryOf(exec.agent), action, args);
            },
        })));
    }
    ctx.effect(() => ctx.tools.guard(exec => toolNames.includes(exec.name) && !validDirectory(directoryOf(exec.agent))
        ? message('errors.guard') : undefined));
    const restrictions = new Map();
    const scope = (agent) => {
        const directory = directoryOf(agent);
        const previous = restrictions.get(agent);
        if (previous && previous.directory === directory)
            return;
        previous?.dispose?.();
        restrictions.set(agent, { directory, dispose: validDirectory(directory) ? undefined : agent.ctx.tools.restrict({ deny: toolNames }) });
    };
    for (const agent of ctx.agents.list())
        scope(agent);
    ctx.on('agent/created', ({ agent }) => { scope(agent); return undefined; });
    ctx.on('agent/pre-step', async ({ agent }, next) => { scope(agent); return next(); });
    ctx.on('agent/disposed', ({ agent }) => { restrictions.get(agent)?.dispose?.(); restrictions.delete(agent); });
    ctx.effect(() => () => { for (const entry of restrictions.values())
        entry.dispose?.(); restrictions.clear(); });
    ctx.effect(() => ctx.commands.register({
        name: 'apache-radar', description: message('command.description'),
        input: { hint: message('command.hint') }, recordInput: false,
        async handler({ rawInput, agent }) {
            const [action = '', ...rest] = rawInput.trim().split(/\s+/);
            if (action === '' || action === 'help')
                return rest.length
                    ? { kind: 'error', text: message('command.noArgs') } : { kind: 'success', text: HELP };
            if (!actions.includes(action))
                return { kind: 'error', text: message('command.unknown') };
            let args = {};
            if (action === 'watch') {
                if (rest.length && (!['add', 'remove'].includes(rest[0]) || rest.length !== 2))
                    return { kind: 'error', text: message('command.watchUsage') };
                if (rest[1] && !/^[a-z][a-z0-9-]*$/i.test(rest[1]))
                    return { kind: 'error', text: message('errors.invalidProject') };
                args = { operation: rest[0], project: rest[1] };
            }
            else if (action === 'lookup') {
                if (!rest.length)
                    return { kind: 'error', text: message('command.lookupUsage') };
                args = { query: rest.join(' ') };
            }
            else if (rest.length)
                return { kind: 'error', text: message('command.noArgs') };
            let directory;
            try {
                directory = directoryOf(agent);
                const result = await run(directory, action, action === 'open' ? { includeMarkdown: true } : args);
                return { kind: 'success', text: renderCommandResult(action, result) };
            }
            catch (error) {
                return { kind: 'error', text: message('command.failed', { action,
                        directory: directory ?? message('command.noDirectory'),
                        error: message('errors.local', { error: error instanceof Error ? error.message : String(error) }),
                    }) };
            }
        },
    }));
}
