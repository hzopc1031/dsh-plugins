import { CommandDefinitionId } from '@deepseek-ai/dsh-commands';
import z from '@deepseek-ai/schemastery';
export const name = 'content-evidence';
export const inject = ['commands'];
export const Config = z.object({});
export function apply(ctx) {
    ctx.effect(() => ctx.commands.register({
        definitionId: CommandDefinitionId('dsh-content-evidence'),
        name: 'content-evidence',
        description: '查看内容证据工作台的开发状态 / Show content evidence scaffold status',
        recordInput: false,
        handler: () => ({
            kind: 'success',
            text: [
                '内容证据工作台：当前为开发骨架，仅提供此帮助命令。',
                '材料存储、证据表、四平台草稿、合规检查、导出和界面尚未实现。',
                '插件不会自动发布内容。',
                '',
                'Content evidence is a scaffold with this help command only.',
                'Storage, evidence sheets, platform drafts, compliance checks, export and UI are not implemented yet.',
                'Nothing is published automatically.',
            ].join('\n'),
        }),
    }));
}
