import { CommandDefinitionId } from '@deepseek-ai/dsh-commands';
import { ShotServer } from './server.js';
import { logError } from './capture.js';
export const name = 'screenshot';
export const inject = ['commands'];
export async function apply(ctx) {
    if (typeof ctx.commands?.register !== 'function')
        throw new Error('宿主缺少 commands.register，已拒绝启动截图服务。');
    const server = new ShotServer();
    // Register cleanup before listening so unload during startup is covered.
    ctx.effect(() => () => server.close());
    await server.listen();
    ctx.effect(() => ctx.commands.register({
        definitionId: CommandDefinitionId('dsh-snip-attach'),
        name: 'screenshot', description: 'Windows 截图（相机按钮自动附加；手输命令只启动截图）', recordInput: false,
        handler: ({ rawInput }) => {
            if (rawInput.trim())
                return { kind: 'error', text: '用法：/screenshot（无参数）' };
            if (process.platform !== 'win32')
                return { kind: 'error', text: '截图仅支持 Windows 桌面 DSH。' };
            try {
                return { kind: 'success', text: `截图就绪 ${server.start()}` };
            }
            catch (error) {
                logError('screenshot command refused');
                return { kind: 'error', text: error instanceof Error ? error.message : '截图启动失败。' };
            }
        },
    }));
}
