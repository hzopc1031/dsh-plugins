import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-client-connection'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { parseSettings } from './config.js'
import { directoryError } from './tools.js'
import type { Action, ActionArgs, AdvisoryService } from './surface.js'

export const PANEL_PATH = '/advisory-impact/api'
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

export function panelRequest(value: unknown): { directory: string; action: Action; args: ActionArgs } {
  if (
    !object(value) ||
    Object.keys(value).some((k) => !['directory', 'action', 'args'].includes(k)) ||
    typeof value.directory !== 'string' ||
    directoryError(value.directory) ||
    !['view', 'refresh', 'pin', 'watch', 'report'].includes(String(value.action))
  )
    throw new Error('无效的面板请求或项目绝对路径')
  const args = value.args ?? {}
  if (!object(args)) throw new Error('无效的面板参数')
  const keys =
    value.action === 'pin'
      ? ['project', 'version', 'component', 'maven', 'remove']
      : value.action === 'watch'
        ? ['watch']
        : []
  if (Object.keys(args).some((k) => !keys.includes(k))) throw new Error('面板仅接受声明参数')
  if (value.action === 'watch' && args.watch !== undefined) parseSettings({ watch: args.watch })
  if (value.action === 'pin' && Object.keys(args).length) {
    parseSettings({ watch: [args.project] })
    if (args.remove !== undefined && typeof args.remove !== 'boolean') throw new Error('无效的移除参数')
    if (args.remove) {
      if (Object.keys(args).some((k) => !['project', 'remove'].includes(k)))
        throw new Error('移除版本时不可同时填写版本')
    } else {
      const { remove: _, ...pin } = args
      parseSettings({ pins: [pin] })
    }
  }
  return { directory: value.directory, action: value.action as Action, args }
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('x-content-type-options', 'nosniff')
  res.end(JSON.stringify(value))
}

export function registerPanel(ctx: Context, service: AdvisoryService): void {
  // Commands remain usable in CLI profiles without the web services.
  ctx.inject(['webServer', 'connection'], (scope) => {
    scope.effect(() =>
      scope.webServer.register({
        kind: 'exact',
        path: PANEL_PATH,
        handler: async (req: IncomingMessage, res: ServerResponse) => {
          const rejection = scope.connection.requestRejection(req)
          if (rejection) return json(res, rejection, { error: 'DSH 浏览器连接未授权，请重新连接' })
          if (req.method !== 'POST') return json(res, 405, { error: '仅接受 POST' })
          if (req.headers['content-type']?.split(';')[0]?.trim() !== 'application/json')
            return json(res, 415, { error: '需要 JSON 请求' })
          const controller = new AbortController()
          const close = () => {
            if (!res.writableEnded) controller.abort()
          }
          res.on('close', close)
          try {
            const chunks: Buffer[] = []
            let size = 0
            for await (const chunk of req) {
              const buffer = Buffer.from(chunk)
              size += buffer.length
              if (size > 64 * 1024) return json(res, 413, { error: '面板请求超过 64 KiB' })
              chunks.push(buffer)
            }
            const input = panelRequest(JSON.parse(Buffer.concat(chunks).toString('utf8')))
            const result = await service.execute(input.directory, input.action, input.args, controller.signal)
            if (!controller.signal.aborted)
              json(res, 200, result.view ? { view: result.view } : { summary: result.summary, text: result.text })
          } catch (error) {
            if (!controller.signal.aborted)
              json(res, 400, { error: error instanceof Error ? error.message : '面板操作失败' })
          } finally {
            res.off('close', close)
          }
        }
      })
    )
  })
}
