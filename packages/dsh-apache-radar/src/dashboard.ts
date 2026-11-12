import type { SecurityReport } from './security.js'
import type { Context } from '@deepseek-ai/cordis'
import type { RadarAction, RadarArgs } from './radar.js'
import type { CountsReport } from './counts.js'
import type { FeedSource, FeedWindow } from './feeds.js'
import type { itemSummary } from './radar.js'
import { validDirectory } from './local-files.js'

export interface DashboardData {
  proxyNote?: string
  diagnostics?: { code: string; hintZh: string; count: number }[]
  localSnapshot?: boolean
  security?: SecurityReport
  pins?: Record<string, string>
  directories: string[]
  directory?: string
  watchList?: string[]
  empty?: boolean
  counts?: CountsReport
  sources?: FeedSource[]
  window?: FeedWindow
  collectedAt?: string
  items?: ReturnType<typeof itemSummary>[]
  undatedItems?: ReturnType<typeof itemSummary>[]
  markdown?: string
}

interface FetchConnection {
  fetch: { register(route: { path: string; methods: readonly ['POST']; requestBody: 'buffered'; fetch(request: Request): Promise<Response> }): () => Promise<void> }
}
type Run = (directory: string | undefined, action: RadarAction, args?: RadarArgs) => Promise<string>

export function dashboardHandler(run: Run, directories: () => string[], proxy?: (action: string) => Promise<unknown>) {
  return async (request: Request): Promise<Response> => {
    const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store' } })
    try {
      const body = await request.json() as Record<string, unknown>
      if (!body || Array.isArray(body) || typeof body !== 'object'
        || Object.keys(body).some(key => !['directory', 'action', 'project', 'version', 'cve', 'snapshot'].includes(key))) throw new Error('无效的面板请求。')
      const { directory, action = 'read', project } = body
      if (typeof action !== 'string' || !['read', 'refresh', 'brief', 'add', 'remove', 'file', 'pin', 'osv', 'diagnose', 'export', 'import', 'detect-proxy', 'redetect-proxy', 'apply-proxy', 'clear-proxy'].includes(action)) throw new Error('未知操作。')
      if (directory !== undefined && !validDirectory(directory)) throw new Error('请选择本地绝对目录，不能包含 ..。')
      if (['detect-proxy', 'redetect-proxy', 'apply-proxy', 'clear-proxy'].includes(action)) return json(await proxy?.(action) ?? { note: '系统代理检测不可用' })
      const available = directories()
      const target = directory ?? (available.length === 1 ? available[0] : undefined)
      if (!target) {
        if (action !== 'read') throw new Error('请先选择项目目录。')
        return json({ directories: available })
      }
      if (action === 'diagnose') return json(JSON.parse(await run(target, 'diagnose')))
      if (action === 'export') return new Response(await run(target, 'export'), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
      if (action === 'import') {
        if (typeof body.snapshot !== 'string') throw new Error('请选择 JSON 快照')
        const data = JSON.parse(await run(target, 'import', { snapshot: body.snapshot }))
        return json({ ...data, directories: available, directory: target })
      }
      if (action === 'file') {
        const saved = JSON.parse(await run(target, 'open', { includeMarkdown: true }))
        return new Response(saved.markdown, { headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store' } })
      }
      if (action === 'pin' || action === 'osv') {
        await run(target, action, { project: body.project as string, version: body.version as string, cve: body.cve as string })
      }
      if (action === 'add' || action === 'remove') {
        if (typeof project !== 'string') throw new Error('请输入项目 id。')
        await run(target, 'watch', { operation: action, project })
      }
      const data = JSON.parse(await run(target, 'dashboard', {
        refresh: action === 'refresh', saveBrief: action === 'brief',
      }))
      const status = await proxy?.('proxy-status') as { automatic?: boolean } | undefined
      return json({ ...data, proxyNote: status?.automatic ? '已自动使用 Windows PAC / 系统代理访问官方来源。' : undefined, directories: available, directory: target })
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 400)
    }
  }
}

export function registerDashboard(ctx: Context, run: Run, directories: () => string[], proxy?: (action: string) => Promise<unknown>): void {
  // CLI-only hosts keep their commands when the browser connection is absent.
  ctx.inject(['connection'], scope => {
    const connection = scope.get('connection') as FetchConnection
    scope.effect(() => connection.fetch.register({
      path: '/api/apache-radar/dashboard', methods: ['POST'], requestBody: 'buffered', fetch: dashboardHandler(run, directories, proxy),
    }), 'apache-radar: authenticated dashboard')
  })
}
