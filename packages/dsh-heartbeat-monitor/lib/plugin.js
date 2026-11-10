import z from '@deepseek-ai/schemastery';
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands';
import { defaults, resolveSettings } from './core.js';
import { HeartbeatController } from './controller.js';
import { systemNotify } from './notify.js';
import { bashFailure } from './bash.js';
export const name = 'heartbeat';
export const inject = ['commands'];
export const Config = z.object({
    enabled: z.boolean().default(defaults.enabled).description('总开关'),
    intervalMinutes: z.number().min(0.1).max(1440).default(defaults.intervalMinutes).description('N：每隔多少分钟发一张进度卡'),
    silenceMinutes: z.number().min(0.1).max(1440).default(defaults.silenceMinutes).description('M：超过多少分钟没有任何活动就发警告'),
    repeatThreshold: z.number().min(2).max(1000).step(1).default(defaults.repeatThreshold).description('K：同一工具或同一错误连续出现多少次就发警告'),
    repeatByNameOnly: z.boolean().default(defaults.repeatByNameOnly).description('重复工具只比较工具名（默认要求参数也完全相同）'),
    progressCards: z.boolean().default(defaults.progressCards).description('发送定时进度卡（关闭后只发警告）'),
    systemNotification: z.boolean().default(defaults.systemNotification).description('警告时同时弹系统通知'),
    notifyProgress: z.boolean().default(defaults.notifyProgress).description('进度卡也弹系统通知'),
    includeSubagents: z.boolean().default(defaults.includeSubagents).description('也跟踪子代理会话'),
});
/** How often the shared timer re-evaluates active runs. */
export const TICK_MS = 15_000;
const COMMAND = 'heartbeat';
const NOTIFY_GAP_MS = 30_000;
export function apply(ctx, input = {}) {
    const settings = resolveSettings(input);
    const agents = new Map();
    const pending = new Map();
    const queues = new Map();
    let disposed = false;
    let seq = 0;
    let lastNotify = 0;
    let timer;
    const notify = (alert) => {
        const warn = alert.kind === 'silence' || alert.kind === 'repeat-tool' || alert.kind === 'repeat-error';
        if (!settings.systemNotification || (!warn && !settings.notifyProgress))
            return;
        const now = Date.now();
        if (now - lastNotify < NOTIFY_GAP_MS)
            return;
        lastNotify = now;
        systemNotify(warn ? 'DSH 心跳警告' : 'DSH 任务心跳', alert.short, message => ctx.logger.warn(message));
    };
    /**
     * Cards are shown through the real human-command lifecycle
     * (`command/run` + `command/done`, rendered by ui-chat's command node).
     * Appends are deferred to a macrotask because Session rejects an append
     * reentered from inside its own `session/event` publication.
     */
    const deliver = (sessionId, alert) => {
        notify(alert);
        const agent = agents.get(sessionId);
        if (!agent || disposed)
            return;
        const token = `auto-${++seq}`;
        pending.set(token, alert);
        const previous = queues.get(sessionId) ?? Promise.resolve();
        const job = previous.then(() => new Promise(resolve => setTimeout(resolve, 0))).then(async () => {
            if (disposed)
                return;
            await ctx.commands.execute(agent, `/${COMMAND} ${token}`, [], new AbortController().signal);
        }).catch(() => {
            ctx.logger.warn('心跳卡片发送失败（已忽略，不影响任务）');
        }).finally(() => {
            pending.delete(token);
            if (queues.get(sessionId) === job)
                queues.delete(sessionId);
        });
        queues.set(sessionId, job);
    };
    const controller = new HeartbeatController({ settings, now: Date.now, deliver });
    ctx.inject(['tools'], child => {
        child.on('tools/result', (exec, result) => {
            const failure = !result.isError ? bashFailure(exec.name, result.value) : undefined;
            if (!disposed && exec.agent && failure)
                controller.result(exec.agent.session.id, exec.callId, { name: exec.name, failure });
            return undefined;
        });
    });
    const syncTimer = () => {
        if (controller.active && !timer && !disposed) {
            timer = setInterval(() => { try {
                controller.tick();
            }
            catch {
                ctx.logger.warn('心跳计时出错（已忽略）');
            }
            finally {
                syncTimer();
            } }, TICK_MS);
            timer.unref?.();
        }
        else if (!controller.active && timer) {
            clearInterval(timer);
            timer = undefined;
        }
    };
    ctx.effect(() => ctx.commands.register({
        definitionId: CommandDefinitionId('dsh-heartbeat'),
        name: COMMAND,
        description: '查看当前任务心跳（运行时长、工具调用、最近活动）',
        recordInput: false,
        handler: ({ agent, rawInput }) => {
            const arg = rawInput.trim();
            if (arg) {
                const alert = pending.get(arg);
                if (!alert)
                    return { kind: 'error', text: '用法：/heartbeat（无参数）' };
                pending.delete(arg);
                const warn = alert.kind === 'silence' || alert.kind === 'repeat-tool' || alert.kind === 'repeat-error';
                return warn ? { kind: 'error', text: alert.text } : { kind: 'success', text: alert.text };
            }
            const card = controller.snapshot(agent.id);
            if (card)
                return { kind: 'success', text: card.text };
            return { kind: 'success', text: settings.enabled ? '💓 当前没有运行中的任务。' : '💓 心跳插件已在配置中关闭（enabled: false）。' };
        },
    }));
    ctx.on('agent/status', ({ agent, status }) => {
        if (disposed)
            return;
        if (!settings.includeSubagents && agent.session.header.origin === 'subagent')
            return;
        if (status === 'running')
            agents.set(agent.id, agent);
        controller.status(agent.id, status);
        syncTimer();
    });
    ctx.on('session/event', (session, event) => {
        if (disposed || !controller.isTracking(session.id))
            return;
        try {
            controller.event(session.id, event);
        }
        catch {
            ctx.logger.warn('心跳事件处理出错（已忽略）');
        }
    });
    ctx.on('agent/disposed', ({ agent }) => {
        controller.status(agent.id, 'idle');
        agents.delete(agent.id);
        syncTimer();
    });
    ctx.on('session/flush', async (session) => { await queues.get(session.id); });
    ctx.effect(() => async () => {
        disposed = true;
        if (timer)
            clearInterval(timer);
        timer = undefined;
        controller.clear();
        await Promise.allSettled([...queues.values()]);
        agents.clear();
        pending.clear();
    });
}
