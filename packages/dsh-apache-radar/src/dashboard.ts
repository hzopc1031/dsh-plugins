import type { Context } from '@deepseek-ai/cordis'
import type { RadarAction, RadarArgs } from './radar.js'
import type { CountsReport } from './counts.js'
import type { FeedSource, FeedWindow } from './feeds.js'
import type { itemSummary } from './radar.js'
import { validDirectory } from './local-files.js'

export interface DashboardData {
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

export function dashboardHandler(run: Run, directories: () => string[]) {
  return async (request: Request): Promise<Response> => {
    const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store' } })
    try {
      const body = await request.json() as Record<string, unknown>
      if (!body || Array.isArray(body) || typeof body !== 'object'
        || Object.keys(body).some(key => !['directory', 'action', 'project'].includes(key))) throw new Error('无效的面板请求。')
      const { directory, action = 'read', project } = body
      if (typeof action !== 'string' || !['read', 'refresh', 'brief', 'add', 'remove', 'file'].includes(action)) throw new Error('未知操作。')
      if (directory !== undefined && !validDirectory(directory)) throw new Error('请选择本地绝对目录，不能包含 ..。')
      const available = directories()
      const target = directory ?? (available.length === 1 ? available[0] : undefined)
      if (!target) {
        if (action !== 'read') throw new Error('请先选择项目目录。')
        return json({ directories: available })
      }
      if (action === 'file') {
        const saved = JSON.parse(await run(target, 'open', { includeMarkdown: true }))
        return new Response(saved.markdown, { headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store' } })
      }
      if (action === 'add' || action === 'remove') {
        if (typeof project !== 'string') throw new Error('请输入项目 id。')
        await run(target, 'watch', { operation: action, project })
      }
      const data = JSON.parse(await run(target, 'dashboard', {
        refresh: action === 'refresh', saveBrief: action === 'brief',
      }))
      return json({ ...data, directories: available, directory: target })
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 400)
    }
  }
}

export function registerDashboard(ctx: Context, run: Run, directories: () => string[]): void {
  // CLI-only hosts keep their commands when the browser connection is absent.
  ctx.inject(['connection'], scope => {
    const connection = scope.get('connection') as FetchConnection
    scope.effect(() => connection.fetch.register({
      path: '/api/apache-radar/dashboard', methods: ['POST'], requestBody: 'buffered', fetch: dashboardHandler(run, directories),
    }), 'apache-radar: authenticated dashboard')
  })
}
