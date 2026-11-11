import z from '@deepseek-ai/schemastery';
export const name = 'apache-radar';
export const inject = ['commands'];
export const Config = z.object({});
export const HELP = `Apache 社区雷达：本地查看 Apache 官方口径与关注项目动态。
当前为脚手架，仅支持 /apache-radar 或 /apache-radar help。
项目数量必须并列展示多来源口径，每项附来源 URL + 抓取时间（Asia/Singapore，UTC+8）；退休口径也须并列。
默认关注 Kafka / Hadoop / Flink；数据工具与周报尚未接通。
不使用 reporter.apache.org，无需模型调用。`;
export function apply(ctx, _config = {}) {
    ctx.effect(() => ctx.commands.register({
        name: 'apache-radar',
        description: '查看本地 Apache 社区雷达帮助',
        input: { hint: 'help' },
        recordInput: false,
        handler: ({ rawInput }) => ['', 'help'].includes(rawInput.trim())
            ? { kind: 'success', text: HELP }
            : { kind: 'error', text: '当前仅支持 /apache-radar help。' },
    }));
}
