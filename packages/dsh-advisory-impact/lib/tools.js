import path from 'node:path';
import { defineTool } from '@deepseek-ai/dsh-tools';
const operations = [
    { action: 'pin', description: '查看或保存当前项目的实际运行版本；没有默认版本。一个项目保存一个 pin；remove:true 移除。', parameters: {
            project: { type: 'string' }, version: { type: 'string' }, component: { type: 'string' }, maven: { type: 'string', description: 'groupId:artifactId，不含版本' }, remove: { type: 'boolean' },
        } },
    { action: 'watch', description: '查看关注列表；watch 数组替换当前项目关注列表，默认 kafka/hadoop/flink。其他 id 明确提示无官方适配器。', parameters: {
            watch: { type: 'array', items: { type: 'string' } },
        } },
    { action: 'refresh', description: '刷新官方公告和 OSV 第二来源，返回带原始链接及时间的摘要；失败显示旧缓存/错误，不视为空清单。', parameters: {} },
    { action: 'report', description: '无需模型，保存中文 Markdown 到当前项目 advisory-impact-report.md，返回路径和摘要；suppressions、OSV-only、分歧单列。', parameters: {} },
    { action: 'open', description: '校验并打开当前项目已保存报告，返回路径和字节数；完整 Markdown 通过 /advisory-impact open 查看。', parameters: {} },
    { action: 'lookup', description: '查询一个 CVE 的官方结论/未知、官方链接和抓取时间、OSV 第二来源状态及官方 suppression。不会改写官方范围。', parameters: {
            id: { type: 'string', required: true, description: 'CVE id' },
        } },
];
export const TOOL_NAMES = operations.map(op => 'advisory_impact_' + op.action);
export function argumentError(name, value) {
    const operation = operations.find(op => 'advisory_impact_' + op.action === name);
    if (!operation)
        return;
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).some(key => !Object.hasOwn(operation.parameters, key)))
        return '工具仅接受声明参数，不接受目录或文件路径';
    const args = value;
    if (operation.action === 'pin' && (args.project === undefined && Object.keys(args).length > 0
        || args.remove && (args.version !== undefined || args.component !== undefined || args.maven !== undefined)))
        return 'pin 需要 project；移除时不可同时填写版本或组件';
}
export function directoryError(directory) {
    if (!directory || !path.isAbsolute(directory) || directory.split(path.sep).includes('..'))
        return '需要不含 .. 的当前项目绝对路径';
}
export function toolDefinitions(run) {
    return operations.map(op => defineTool({
        name: 'advisory_impact_' + op.action,
        description: op.description + ' 默认只返回摘要（每组最多 20 条并标明截断），不返回公告 HTML 或 OSV 原始记录；官方优先，无需模型 key。',
        parameters: op.parameters,
        output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
        async execute(args, exec) {
            const error = argumentError(exec.name, args);
            if (error)
                throw new Error(error);
            return run(op.action, args, exec);
        },
    }));
}
