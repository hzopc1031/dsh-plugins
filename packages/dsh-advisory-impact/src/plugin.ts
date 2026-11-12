import { createIntranetHttp, type IntranetSettings } from './intranet-http.js'
import type { Context } from '@deepseek-ai/cordis'
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands'
import type { Agent } from '@deepseek-ai/dsh-agent'
import path from 'node:path'
import os from 'node:os'
import { SourceCache } from './cache.js'
import { OsvClient } from './osv.js'
import { createHttpClient, createOsvHttpClient } from './http.js'
import { AdvisoryService, parseInput } from './surface.js'
import { argumentError, directoryError, toolDefinitions, TOOL_NAMES } from './tools.js'
import { registerPanel } from './panel-host.js'

export { evaluateProject, parseAffectedRanges } from './verdicts.js'
export type { ProjectId, SourceMetadata, SourceDocument, HttpClient, MavenQuery, VersionPin, VersionRange, Verdict, PinVerdict, OfficialVerdict, ProjectVerdicts, SuppressionSection } from './types.js'
export { Config, DEFAULT_WATCH, DEFAULT_TTL_MS, PIN_FILE, parseSettings, loadSettings, saveSettings } from './config.js'
export type { Settings, ProductPin } from './config.js'
export { SourceCache } from './cache.js'
export type { SourceResult } from './cache.js'
export { OsvClient } from './osv.js'
export type { OsvRecord, OsvLookup, OsvQueryResult, OsvAnnotation } from './osv.js'
export { evaluatePins } from './evaluate.js'
export type { EvaluateOptions, Evaluation, EvaluatedProject, OsvOnlyItem } from './evaluate.js'
export { createHttpClient, createOsvHttpClient } from './http.js'
export type { HttpOptions } from './http.js'
export { createViewModel, displayTime, VERDICT_LABELS, STATE_LABELS, summarize } from './view-model.js'
export type { AdvisoryViewModel } from './view-model.js'
export { renderReport, saveReport, openReport, REPORT_FILE } from './report.js'
export { AdvisoryService, HELP, parseInput } from './surface.js'
export type { Action, ActionArgs, SurfaceResult } from './surface.js'

export const name = 'advisory-impact'
export const inject = ['commands', 'tools', 'agents']

export function projectDirectory(ctx: Pick<Context, 'get'>, agent: Agent): string | undefined {
  const service = ctx.get('workingDirectory') as { get(session: Agent['session']): string } | undefined
  return service ? service.get(agent.session) : agent.session.header.cwd
}

export function apply(ctx: Context, config: unknown = {}): void {
  const { httpsProxy, noProxy, caBundlePath, insecureSkipTlsVerify, offlineOnly, ...settings } = config as IntranetSettings & { offlineOnly?: boolean }
  const network = createIntranetHttp({ httpsProxy, noProxy, caBundlePath, insecureSkipTlsVerify })
  ctx.effect(() => () => network.close())
  const cacheRoot = path.join(os.homedir(), '.cache', 'dsh-advisory-impact')
  const service = new AdvisoryService({ config: settings,
    cache: new SourceCache(path.join(cacheRoot, 'official'), createHttpClient({ fetch: network.fetch }), undefined, offlineOnly),
    osv: new OsvClient(new SourceCache(path.join(cacheRoot, 'osv'), createOsvHttpClient({ fetch: network.fetch }), undefined, offlineOnly)) })
  ctx.effect(() => ctx.commands.register({
    definitionId: CommandDefinitionId('dsh-advisory-impact'),
    name,
    description: '官方公告影响核对：运行版本、关注列表、刷新、中文报告与单条 CVE',
    input: { hint: 'help | pin | watch | refresh | report [save] | open | lookup <CVE-id>' },
    recordInput: false,
    handler: async ({ agent, rawInput, signal }) => {
      try {
        if (['diagnose', 'snapshot-export', 'snapshot-import'].includes(rawInput.trim())) {
          const action = rawInput.trim(), directory = projectDirectory(ctx, agent)
          if (action === 'diagnose') return { kind: 'success', text: '网络诊断\n' + JSON.stringify(await network.diagnose(), null, 2) }
          if (!directory) throw new Error('请先选择本地项目')
          const { readLocal, writeLocal } = await import('./local.js')
          const snapshotFile = '.advisory-impact-snapshot.json'
          if (action === 'snapshot-export') await writeLocal(directory, snapshotFile, await service.exportSnapshot())
          else await service.importSnapshot(await readLocal(directory, snapshotFile, 32 * 1024 * 1024))
          return { kind: 'success', text: action === 'snapshot-export' ? '已导出项目内 .advisory-impact-snapshot.json' : '已导入本地快照，非实时官方抓取' }
        }
        const { action, args } = parseInput(rawInput)
        const result = await service.execute(action === 'help' ? undefined : projectDirectory(ctx, agent), action, args, signal)
        return { kind: 'success', text: result.text }
      } catch (error) {
        return { kind: 'error', text: signal.aborted ? '操作已取消。' : error instanceof Error ? error.message : '操作失败。' }
      }
    },
  }))
  for (const definition of toolDefinitions(async () => { throw new Error('工具必须从受约束的 agent.ctx 调用') })) {
    ctx.effect(() => ctx.tools.register(definition))
  }
  const fibers = new Map<Agent, ReturnType<Context['inject']>>()
  const install = (agent: Agent) => {
    if (fibers.has(agent)) return
    const fiber = agent.ctx.inject(['tools'], scope => {
      // Hide inherited entry points; only caller-bound registrations can reach project files.
      scope.tools.restrict({ deny: TOOL_NAMES })
      scope.tools.guard(exec => {
        if (!TOOL_NAMES.includes(exec.name)) return
        return exec.agent !== agent ? '工具调用者与项目作用域不匹配'
          : argumentError(exec.name, exec.arguments) ?? directoryError(projectDirectory(ctx, agent))
      })
      for (const definition of toolDefinitions(async (action, args, exec) => {
        exec.signal.throwIfAborted()
        if (exec.agent !== agent) throw new Error('工具调用者与项目作用域不匹配')
        const directory = projectDirectory(ctx, agent)
        const error = directoryError(directory)
        if (error) throw new Error(error)
        const result = await service.execute(directory, action, action === 'report' ? { save: true } : args, exec.signal)
        return JSON.stringify(result.summary)
      })) scope.tools.register(definition)
    })
    fibers.set(agent, fiber)
    return fiber
  }
  for (const agent of ctx.agents.list()) install(agent)
  ctx.on('agent/created', async ({ agent }) => { await install(agent) })
  ctx.on('agent/disposed', async ({ agent }) => {
    const fiber = fibers.get(agent)
    fibers.delete(agent)
    await fiber?.dispose()
  })
  ctx.effect(() => async () => {
    const pending = [...fibers.values()]
    fibers.clear()
    await Promise.all(pending.map(fiber => fiber.dispose()))
  })
  registerPanel(ctx, service)
}
