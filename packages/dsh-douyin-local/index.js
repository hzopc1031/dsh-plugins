import z from '@deepseek-ai/schemastery';
import { runHotlist, runIndexCache, runCommentSummary, openDesktop } from './runner.js';

export const name = 'douyin-local';
export const inject = ['commands', 'tools'];
export const Config = z.object({
  projectPath: z.string().default('').description('douyin-index-local 项目的绝对路径'),
});

export function apply(ctx, config = {}) {
  ctx.effect(() => ctx.commands.register({
    name: 'douyin-hotlist', description: '获取一次本机抖音热榜', recordInput: false,
    async handler({ rawInput, signal }) {
      if (rawInput.trim()) return { kind: 'error', text: '用法：/douyin-hotlist（无需参数）' };
      try { return { kind: 'success', text: await runHotlist(config, undefined, signal) }; }
      catch (error) { return { kind: 'error', text: error.message }; }
    },
  }));
  ctx.effect(() => ctx.tools.register({
    name: 'douyin_local_hotlist', description: '通过本机工具获取一次抖音热榜；仅在用户请求时调用。',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute(args, exec) { if (Object.keys(args).length) throw new Error('不接受额外参数'); return runHotlist(config, undefined, exec?.signal); },
  }));
  ctx.effect(() => ctx.commands.register({
    name: 'douyin-index-cache', description: '读取单个关键词的七天搜索指数缓存', recordInput: false,
    async handler({ rawInput, signal }) {
      const parts = rawInput.trim().split(/\s+/);
      if (parts.length !== 2) return { kind: 'error', text: '用法：/douyin-index-cache 关键词 YYYY-MM-DD' };
      try { return { kind: 'success', text: await runIndexCache(config, parts[0], parts[1], undefined, signal) }; }
      catch (error) { return { kind: 'error', text: error.message }; }
    },
  }));
  ctx.effect(() => ctx.tools.register({
    name: 'douyin_local_index_cache', description: '读取单个关键词和截止日期对应的本地七天完整缓存；不发起在线查询。',
    parameters: { type: 'object', properties: { keyword: { type: 'string' }, endDate: { type: 'string' } }, required: ['keyword', 'endDate'], additionalProperties: false },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute(args, exec) { if (Object.keys(args).some(key => !['keyword', 'endDate'].includes(key))) throw new Error('不接受额外参数'); return runIndexCache(config, args.keyword, args.endDate, undefined, exec?.signal); },
  }));
  ctx.effect(() => ctx.commands.register({
    name: 'douyin-comments', description: '读取指定编号的本地评论摘要', recordInput: false,
    async handler({ rawInput, signal }) {
      const runId = rawInput.trim();
      try { return { kind: 'success', text: await runCommentSummary(config, runId, undefined, signal) }; }
      catch (error) { return { kind: 'error', text: error.message }; }
    },
  }));
  ctx.effect(() => ctx.commands.register({
    name: 'douyin-open', description: '打开本机搜索指数窗口', recordInput: false,
    async handler({ rawInput }) {
      if (rawInput.trim()) return { kind: 'error', text: '用法：/douyin-open（无需参数）' };
      try { return { kind: 'success', text: await openDesktop(config) }; }
      catch (error) { return { kind: 'error', text: error.message }; }
    },
  }));
}
