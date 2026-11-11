import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-commands'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { defineTool, type ParameterSchemaSpec } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'
import { DEFAULT_WATCH_LIST, resolveWatchList } from './watch.js'
import { createHttpClient } from './http.js'
import { validDirectory } from './local-files.js'
import { runRadar, type RadarAction, type RadarArgs } from './radar.js'

export const name = 'apache-radar'
export const inject = ['commands', 'tools', 'agents']
export interface Config { watchList?: string[] }
export const Config: z<Config> = z.object({
  watchList: z.array(z.string()).default([...DEFAULT_WATCH_LIST]).description('关注项目 id，数组顺序即展示顺序；默认 kafka / hadoop / flink'),
})
export const HELP = `Apache 社区雷达：本地查看 Apache 官方口径与关注项目动态。
/apache-radar help：帮助；counts：数量与分类；watch [add|remove 项目id]：关注列表；refresh：按缓存 TTL 刷新；brief：生成中文周报；open：查看最新周报；lookup 关键词：查找已采集原文。
项目数量必须并列展示多来源口径，每项附来源 URL + 抓取时间（Asia/Singapore，UTC+8）；退休口径也并列。
默认关注 Kafka / Hadoop / Flink，默认周报窗口为滚动最近 7 天，缓存 TTL 为一小时；失败保留旧缓存及错误。
缓存、关注列表覆盖值和周报保存在会话当前目录的 .apache-radar-* 文件；优先使用 workingDirectory 当前目录，服务缺失时回退初始项目目录；拒绝工具指定其他路径。watch 覆盖值优先于插件配置。
聊天工具 apache_radar_refresh / counts / watch / brief / open / lookup 返回摘要、状态、路径和原文链接；open 的 includeMarkdown 可显式取全文。lookup 仅查询已采集条目，不作生产升级判断。
不使用 reporter.apache.org，无需模型调用。`

const actions: RadarAction[] = ['refresh', 'counts', 'watch', 'brief', 'open', 'lookup']
const toolNames = actions.map(action => `apache_radar_${action}`)
export function apply(ctx: Context, config: Config = {}): void {
  const watchList = resolveWatchList(config.watchList)
  const http = createHttpClient()
  const directoryOf = (agent: Agent | undefined) => {
    if (!agent) return undefined
    const service = ctx.get?.('workingDirectory') as { get(session: Agent['session']): string } | undefined
    return service ? service.get(agent.session) : agent.session.header.cwd
  }
  // Serialize file transactions, including calls from different agents sharing a directory.
  let queue: Promise<unknown> = Promise.resolve()
  const run = (agent: Agent | undefined, action: RadarAction, args: RadarArgs = {}) => {
    const directory = directoryOf(agent)
    if (!validDirectory(directory)) return Promise.reject(new Error('Apache Radar 需要有效的会话当前目录，拒绝路径逃逸。'))
    const result = queue.then(() => runRadar(directory, action, args, { watchList, http }))
    queue = result.catch(() => {})
    return result
  }
  for (const action of actions) {
    const parameters: ParameterSchemaSpec = action === 'watch' ? {
      operation: { type: 'string' as const, enum: ['get', 'add', 'remove'] as const }, project: { type: 'string' as const },
    } : action === 'lookup' ? { query: { type: 'string' as const, required: true as const }, project: { type: 'string' as const } }
      : action === 'open' ? { includeMarkdown: { type: 'boolean' as const } } : {}
    ctx.effect(() => ctx.tools.register(defineTool({
      name: `apache_radar_${action}`,
      description: `${action}：Apache 本地雷达。${action === 'lookup' ? '仅在已采集的带链接条目中按 id、版本或标题关键词查找，不推断兼容或安全升级。'
        : action === 'open' ? '返回最新周报文件路径；includeMarkdown 默认为 false，显式开启可返回中文 Markdown。'
        : '缓存 TTL 为一小时；返回多来源口径、来源时间、失败状态和文件路径摘要，不包含工单正文。'} 使用会话当前目录。`,
      parameters,
      output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
      async execute(args, exec) {
        if (Object.keys(args).some(key => !Object.hasOwn(parameters, key))) throw new Error('不接受额外参数或调用方路径。')
        return run(exec.agent, action, args as RadarArgs)
      },
    })))
  }
  ctx.effect(() => ctx.tools.guard(exec => toolNames.includes(exec.name) && !validDirectory(directoryOf(exec.agent))
    ? 'Apache Radar 拒绝无有效当前目录的调用及路径逃逸。' : undefined))

  const restrictions = new Map<Agent, { directory: string | undefined; dispose?: () => void }>()
  const scope = (agent: Agent) => {
    const directory = directoryOf(agent)
    const previous = restrictions.get(agent)
    if (previous && previous.directory === directory) return
    previous?.dispose?.()
    restrictions.set(agent, { directory, dispose: validDirectory(directory) ? undefined : agent.ctx.tools.restrict({ deny: toolNames }) })
  }
  for (const agent of ctx.agents.list()) scope(agent)
  ctx.on('agent/created', ({ agent }) => { scope(agent); return undefined })
  ctx.on('agent/pre-step', async ({ agent }, next) => { scope(agent); return next() })
  ctx.on('agent/disposed', ({ agent }) => { restrictions.get(agent)?.dispose?.(); restrictions.delete(agent) })
  ctx.effect(() => () => { for (const entry of restrictions.values()) entry.dispose?.(); restrictions.clear() })

  ctx.effect(() => ctx.commands.register({
    name: 'apache-radar', description: 'Apache 多来源口径、关注列表与本地中文周报',
    input: { hint: 'help | counts | watch | refresh | brief | open | lookup 关键词' }, recordInput: false,
    async handler({ rawInput, agent }) {
      const [action = '', ...rest] = rawInput.trim().split(/\s+/)
      if (action === '' || action === 'help') return { kind: 'success', text: HELP }
      if (!actions.includes(action as RadarAction)) return { kind: 'error', text: '未知操作，请使用 /apache-radar help。' }
      let args: RadarArgs = {}
      if (action === 'watch') {
        if (rest.length && (!['add', 'remove'].includes(rest[0]!) || rest.length !== 2)) return { kind: 'error', text: '用法：watch [add|remove 项目id]' }
        args = { operation: rest[0] as 'add' | 'remove' | undefined, project: rest[1] }
      } else if (action === 'lookup') args = { query: rest.join(' ') }
      else if (rest.length) return { kind: 'error', text: '此操作不接受额外参数或路径。' }
      try {
        const result = await run(agent, action as RadarAction, action === 'open' ? { includeMarkdown: true } : args)
        return { kind: 'success', text: action === 'open' ? (JSON.parse(result) as { markdown: string }).markdown : result }
      } catch (error) { return { kind: 'error', text: error instanceof Error ? error.message : String(error) } }
    },
  }))
}
