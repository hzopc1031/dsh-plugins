import z from '@deepseek-ai/schemastery';
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { ImpactStore } from './store.js';
import { ImpactError, fail, createPlan, renderScan } from './core.js';
export const name = 'source-impact';
export const inject = ['commands', 'tools'];
export const Config = z.object({});
export const HELP = [
    '资料更新影响分析：仅处理已登记的本地 .md / .csv 引用。',
    '/impact register <JSON> — 登记一条引用并保存初始基线（字段见 README）',
    '/impact list — 查看已登记的来源 → 引用 → 结论 → 产出位置',
    '/impact check — 检查来源，列出三类可叠加状态及 scanId',
    '/impact plan <scanId> <id1,id2> — 仅为用户选中的引用生成可交给 DSH 的重查任务',
    '/impact remove <id> — 移除引用；不删除来源及报告',
    '引用内容变化或无法定位需要人工复核，不代表结论错误；check / plan 不更新基线。',
].join('\n');
function store(cwd) {
    if (!cwd)
        fail('当前会话没有项目目录，请先选择本地项目');
    return new ImpactStore(cwd);
}
export function apply(ctx) {
    ctx.effect(() => ctx.commands.register({
        definitionId: CommandDefinitionId('dsh-source-impact'),
        name: 'impact',
        description: '登记资料引用、检查更新影响、选择产出生成重查任务',
        input: { hint: 'register <JSON> | list | check | plan <scanId> <id1,id2> | remove <id>' },
        recordInput: false,
        handler: async ({ agent, rawInput, signal }) => {
            try {
                signal.throwIfAborted();
                const input = rawInput.trim();
                if (!input || input === 'help')
                    return { kind: 'success', text: HELP };
                const match = /^(\S+)(?:\s+([\s\S]*))?$/.exec(input);
                const verb = match[1], arg = match[2]?.trim() ?? '';
                const service = store(agent.session.header.cwd);
                if (verb === 'register' && arg) {
                    let value;
                    try {
                        value = JSON.parse(arg);
                    }
                    catch {
                        fail('register 参数必须是有效 JSON，示例见 README');
                    }
                    const registry = await service.add(value, signal);
                    return { kind: 'success', text: '引用已登记；共 ' + registry.references.length + ' 条。来源和报告未被改写。' };
                }
                if (verb === 'list' && !arg) {
                    const registry = await service.load(signal);
                    return { kind: 'success', text: JSON.stringify(registry.references.map(({ baseline: _baseline, ...r }) => r), null, 2) };
                }
                if (verb === 'check' && !arg)
                    return { kind: 'success', text: renderScan(await service.scan(signal)) };
                if (verb === 'plan') {
                    const parts = arg.split(/\s+/);
                    if (parts.length !== 2 || !/^[a-f0-9]{64}$/.test(parts[0]))
                        fail('用法：/impact plan <check 返回的 scanId> <id1,id2>');
                    const scan = await service.scan(signal);
                    const plan = createPlan(scan, parts[1].split(','), parts[0]);
                    return { kind: 'success', text: '复制以下 JSON 到普通对话，要求 DSH 按 tasks 执行。此命令只生成清单，不启动任务。\n\n' + JSON.stringify(plan, null, 2) };
                }
                if (verb === 'remove' && arg && !/\s/.test(arg)) {
                    await service.remove(arg, signal);
                    return { kind: 'success', text: '引用已移除；来源和产出文件未修改。' };
                }
                return { kind: 'error', text: HELP };
            }
            catch (e) {
                return { kind: 'error', text: signal.aborted ? '操作已取消。' : e instanceof ImpactError ? e.message : '操作失败，请检查本地文件权限、文件格式或登记目录；没有改写报告。' };
            }
        },
    }));
    // The model-facing surface is deliberately read-only. Human selection lives in /impact plan.
    ctx.effect(() => ctx.tools.register(defineTool({
        name: 'source_impact_check',
        description: '只读检查已登记 Markdown/CSV 来源变化，返回引用、结论、产出及三类状态的 JSON。不得把变化视为结论错误。选择重查由用户通过 /impact plan 完成。',
        parameters: {},
        output: {
            schema: { type: 'string' },
            render: (_args, value) => [{ type: 'text', text: value }],
        },
        async execute(_args, exec) {
            const result = await store(exec.agent?.session.header.cwd).scan(exec.signal);
            return JSON.stringify(result);
        },
    })));
}
