import { CommandDefinitionId } from '@deepseek-ai/dsh-commands';
import { defineTool } from '@deepseek-ai/dsh-tools';
import z from '@deepseek-ai/schemastery';
import { randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { ingest, readOriginal, fieldNames } from './ingest.js';
import { reconcile } from './reconcile.js';
import { exportPack } from './export.js';
export const name = 'invoice-gate';
export const inject = ['commands', 'tools'];
export const Config = z.object({});
const toolNames = ['invoice_gate_ingest', 'invoice_gate_check', 'invoice_gate_export'];
class GateError extends Error {
}
function fail(message) { throw new GateError(message); }
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function keys(value, allowed) {
    if (!object(value) || Object.keys(value).some(key => !allowed.includes(key)))
        fail('Unsupported request. Amount/identifier rewrite hooks and extra arguments are rejected.');
}
function path(value) {
    if (typeof value !== 'string' || !value || isAbsolute(value) || value.includes('\0') || value.split(/[\\/]/).includes('..'))
        fail('Use project-relative paths without traversal. Paths outside the project are rejected.');
}
const help = [
    'dsh-invoice-gate — local verification gate / 本地票据核对闸门',
    '/invoice-gate start <manifest.json> — select a confined local run; other tools are blocked until stop.',
    '/invoice-gate ingest | check | export <new-directory> | status | stop | help',
    'Tools: invoice_gate_ingest {}, invoice_gate_check {}, invoice_gate_export {"directory":"SAMPLE-pack"}.',
    'Native tools only during a run; PTC run_code is blocked. Slash commands work without a model.',
    'Results contain counts, ids, status and paths only. Open report files locally for details. See docs/tools.md for the manifest schema.',
    'No OCR or tax-bureau verification (不做 OCR／税局验真).',
    'The model must never invent or change amounts, tax, totals or identifiers. No rewrite tool. 模型不得编造或改写金额、税额、合计、票号。',
    'No model calls or automatic uploads; no outbound network. 不调用模型、不自动上传、不联网。',
    'Arithmetic checks do not prove authenticity, payment or reimbursability; evidence packs do not establish accounting-archive compliance.',
    '算术核对不证明票据真实、已付款或可报销；证据包不代表符合会计档案要求。',
].join('\n');
function summary(run) {
    return {
        runId: run.id, status: run.checked ? (run.checked.fullyConfirmed ? 'locally-confirmed' : 'draft') : run.extracted ? 'ingested' : 'started',
        manifest: run.manifest, project: run.root, externalVerification: 'not-checked',
        counts: {
            files: run.extracted?.files.length ?? 0, records: run.extracted?.records.length ?? 0,
            exceptions: run.extracted?.inventory.filter(item => ['failed', 'refused', 'partial'].includes(item.status)).length ?? 0,
            mismatches: run.checked?.results.filter(item => item.outcome === 'mismatch').length ?? 0,
            unchecked: run.checked?.results.filter(item => item.outcome === 'unchecked').length ?? 0,
            pendingKeyFields: run.checked?.pendingKeyFields.length ?? 0,
        },
        ...(run.pack ? { pack: run.pack } : {}),
    };
}
export function apply(ctx) {
    let run, busy = false;
    const lifecycle = new AbortController();
    const directory = (agent) => {
        const service = ctx.get('workingDirectory');
        const cwd = service ? service.get(agent.session) : agent.session.header.cwd;
        if (!cwd || !isAbsolute(cwd))
            fail('Select a local project directory first.');
        return cwd;
    };
    const current = (agent) => {
        if (!run || run.agent !== agent)
            fail('Start a run in this session with /invoice-gate start <manifest.json>.');
        return run;
    };
    const errorText = (error, signal) => signal.aborted || lifecycle.signal.aborted
        ? 'Command cancelled / 命令已取消。'
        : error instanceof GateError ? error.message : 'Local operation failed. Check confined paths, file permissions, manifest and correction schema. No financial details are logged.';
    ctx.effect(() => () => { lifecycle.abort(); run?.release(); run = undefined; });
    async function perform(verb, args, agent, signal) {
        const control = AbortSignal.any([signal, lifecycle.signal]);
        try {
            control.throwIfAborted();
            if (busy)
                fail('A local operation is still running; wait before retrying or stopping.');
            busy = true;
            try {
                keys(args, verb === 'export' ? ['directory', 'includeOriginals'] : []);
                const active = current(agent);
                if (await realpath(directory(active.agent)) !== active.root)
                    fail('Project directory changed. Stop and start a new confined run.');
                control.throwIfAborted();
                if (verb === 'ingest') {
                    const extracted = await ingest(active.root, active.inputs);
                    control.throwIfAborted();
                    active.extracted = extracted;
                    active.checked = undefined;
                    active.pack = undefined;
                }
                else if (verb === 'check') {
                    if (!active.extracted)
                        fail('Run ingest before check.');
                    active.checked = reconcile(active.extracted, active.rules, active.corrections);
                    active.pack = undefined;
                }
                else if (verb === 'export') {
                    if (!active.checked)
                        fail('Run check before export. Draft export is allowed.');
                    path(args.directory);
                    if (args.includeOriginals !== undefined && typeof args.includeOriginals !== 'boolean')
                        fail('includeOriginals must be a boolean.');
                    active.pack = await exportPack(active.root, args.directory, active.checked, { includeOriginals: args.includeOriginals });
                    control.throwIfAborted();
                }
                else
                    fail('Unsupported action. Amount/identifier rewrite is not available.');
                return JSON.stringify(summary(active));
            }
            finally {
                busy = false;
            }
        }
        catch (error) {
            throw new GateError(errorText(error, control));
        }
    }
    for (const verb of ['ingest', 'check', 'export']) {
        ctx.effect(() => ctx.tools.register(defineTool({
            name: `invoice_gate_${verb}`,
            description: `${verb} the human-selected local invoice-gate run. Counts/status/paths only; no amounts or original text. Start with /invoice-gate start. No rewrite hooks.`,
            parameters: verb === 'export' ? {
                directory: { type: 'string', required: true, description: 'New project-relative pack directory; parent must exist.' },
                includeOriginals: { type: 'boolean', description: 'Copy hash-checked originals locally; default false.' },
            } : {},
            output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
            execute: (args, exec) => perform(verb, args, exec.agent, exec.signal),
        })));
    }
    ctx.effect(() => ctx.tools.guard(exec => {
        if (!exec.name.startsWith('invoice_gate_'))
            return;
        if (!toolNames.includes(exec.name))
            return 'Amount/identifier rewrite and unknown invoice-gate hooks are rejected.';
        if (!run || exec.agent !== run.agent)
            return 'Start a confined run with /invoice-gate start first.';
        try {
            keys(exec.arguments, exec.name === 'invoice_gate_export' ? ['directory', 'includeOriginals'] : []);
            if (exec.name === 'invoice_gate_export')
                path(exec.arguments.directory);
        }
        catch {
            return 'Unsafe path or unsupported arguments. Amount/identifier rewrite hooks are rejected.';
        }
        return undefined;
    }));
    ctx.effect(() => ctx.commands.register({
        definitionId: CommandDefinitionId('dsh-invoice-gate'), name: 'invoice-gate',
        description: 'Local invoice gate: start, ingest, check, export, status, stop / 本地票据核对',
        input: { hint: 'help | start <manifest.json> | ingest | check | export <new-directory> | status | stop' },
        recordInput: false,
        handler: async ({ agent, rawInput, signal }) => {
            const control = AbortSignal.any([signal, lifecycle.signal]);
            try {
                control.throwIfAborted();
                const [, verb = 'help', arg = ''] = /^(\S+)?(?:\s+([\s\S]*))?$/.exec(rawInput.trim()) ?? [];
                if (verb === 'help' && !arg)
                    return { kind: 'success', text: help };
                if (verb === 'status' && !arg)
                    return { kind: 'success', text: JSON.stringify(run ? summary(current(agent)) : { status: 'stopped' }) };
                if (verb === 'start' || verb === 'stop') {
                    if (busy)
                        fail('A local operation is still running; wait before retrying or stopping.');
                    busy = true;
                    try {
                        if (verb === 'stop' && !arg) {
                            if (run) {
                                current(agent).release();
                                run = undefined;
                            }
                            return { kind: 'success', text: 'Stopped. Tool restrictions restored; exported files retained. 已停止。' };
                        }
                        if (verb !== 'start')
                            fail('Use /invoice-gate stop without arguments.');
                        if (run)
                            fail('Only one run is allowed. Stop the current run first.');
                        path(arg);
                        const root = await realpath(directory(agent));
                        const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readOriginal(root, arg)));
                        keys(manifest, ['schemaVersion', 'inputs', 'rules', 'corrections']);
                        if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.inputs) || !manifest.inputs.length)
                            fail('Manifest requires schemaVersion 1 and a nonempty inputs array.');
                        for (const input of manifest.inputs) {
                            keys(input, ['path', 'kind', 'mapping', 'sheet', 'ocrJson']);
                            path(input.path);
                            if (!['ticket', 'ledger'].includes(input.kind))
                                fail('Input kind must be ticket or ledger.');
                            if (input.ocrJson !== undefined)
                                path(input.ocrJson);
                            if (input.sheet !== undefined && typeof input.sheet !== 'string')
                                fail('Input sheet must be a string.');
                            if (input.mapping !== undefined) {
                                keys(input.mapping, [...fieldNames]);
                                if (Object.values(input.mapping).some(value => typeof value !== 'string' || !value))
                                    fail('Column mapping requires nonempty header strings.');
                            }
                        }
                        const rules = (manifest.rules === undefined ? {} : manifest.rules);
                        reconcile({ files: [], inventory: [], records: [] }, rules);
                        let corrections;
                        if (manifest.corrections !== undefined) {
                            path(manifest.corrections);
                            corrections = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readOriginal(root, manifest.corrections)));
                        }
                        control.throwIfAborted();
                        const restore = agent.ctx.tools.restrict({ allow: toolNames });
                        let unguard;
                        let unwatch;
                        try {
                            // Scoped registrations bypass restrict; guard closes that execution path too.
                            unguard = agent.ctx.tools.guard(exec => toolNames.includes(exec.name) && exec.agent === agent ? undefined : 'Confined invoice-gate run: other tools are blocked. Use /invoice-gate stop to restore them.');
                            unwatch = agent.ctx.effect(() => () => { if (run?.agent === agent)
                                run = undefined; });
                        }
                        catch (error) {
                            unguard?.();
                            restore();
                            throw error;
                        }
                        run = { id: randomUUID(), agent, root, manifest: arg, inputs: manifest.inputs, rules, corrections, release: () => { unguard?.(); restore(); unwatch(); } };
                        return { kind: 'success', text: JSON.stringify(summary(run)) };
                    }
                    finally {
                        busy = false;
                    }
                }
                if ((['ingest', 'check'].includes(verb) && !arg) || (verb === 'export' && arg)) {
                    return { kind: 'success', text: await perform(verb, verb === 'export' ? { directory: arg } : {}, agent, control) };
                }
                fail('Unsupported action. Amount/identifier rewrite hooks are rejected. Use /invoice-gate help.');
            }
            catch (error) {
                return { kind: 'error', text: errorText(error, control) };
            }
        },
    }));
}
