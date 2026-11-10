import z from '@deepseek-ai/schemastery';
import { randomUUID } from 'node:crypto';
import { defaults, bootScript } from './core.js';
import { serveMusic } from './music.js';
export const name = 'dsh-direnjie-theme';
export const Config = z.object({
    enabled: z.boolean().default(defaults.enabled),
    musicPath: z.string().default('').description('本机音频绝对路径；修改后重启。'),
    volume: z.number().min(0).max(1).default(defaults.volume),
    loop: z.boolean().default(defaults.loop),
    autoplay: z.boolean().default(false),
});
export const inject = ['webServer'];
export function apply(ctx, config) {
    if (!Number.isFinite(config.volume) || config.volume < 0 || config.volume > 1)
        throw new TypeError('volume must be finite and between 0 and 1');
    const musicUrl = config.enabled && config.musicPath ? `/direnjie-music/${randomUUID()}` : '';
    if (musicUrl)
        ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: musicUrl, handler: (req, res) => serveMusic(config.musicPath, req, res) }));
    ctx.on('webserver/index-inject', table => {
        table.push({ kind: 'script', placement: 'body', text: bootScript({ enabled: config.enabled, volume: config.volume, loop: config.loop, autoplay: config.autoplay, musicUrl }) });
    });
}
