import { loadSettings, parseSettings, saveSettings, PIN_FILE, type ProductPin } from './config.js'
import { evaluatePins, type EvaluateOptions } from './evaluate.js'
import { createViewModel, osvView, summarize } from './view-model.js'
import { openReport, renderReport, saveReport } from './report.js'

export const HELP = `官方公告影响核对（开发中：原生面板尚未接入）
针对你自行填写的运行版本，在本地核对官方安全公告。
官方页面为判定依据；OSV 仅作第二来源，可能返回未收录（HTTP 404），分歧并列保留。
官方 suppressions 单列为「扫描器报了，但官方说明不适用」，并引用 ASF 依赖漏洞说明。
默认关注 Kafka / Hadoop / Flink；没有默认运行版本，必须自行填写。
未填写运行版本，无法判断。
Flink 的 ASF 列表为实验性，覆盖 2023 年以来的公告，可能滞后官方 CVE 发布。
全过程无需模型调用或模型 API key；这不是 lockfile 扫描器。

/advisory-impact help — 查看帮助
/advisory-impact pin — 查看当前运行版本
/advisory-impact pin <project> <version> [component=<name>] [maven=<groupId:artifactId>] — 保存运行版本
/advisory-impact pin remove <project> — 移除该项目 pin
/advisory-impact watch — 查看关注列表
/advisory-impact watch kafka,hadoop,flink — 替换关注列表；none 清空
/advisory-impact refresh — 强制刷新来源，失败显示最后成功缓存及错误
/advisory-impact report — 输出可复制的中文 Markdown
/advisory-impact report save — 保存到当前项目 advisory-impact-report.md
/advisory-impact open — 在命令输出中打开已保存的 Markdown（不启动外部浏览器）
/advisory-impact lookup <CVE-id> — 核对单条官方结论、来源时间、OSV 和 suppression

pin/watch 写入当前项目 .advisory-impact.json；修改 pin 不会自动加入关注列表。
工具 advisory_impact_pin/watch/refresh/report/open/lookup 默认返回摘要，清单最多 20 条并标明截断；report 工具保存报告，open 工具返回已校验路径和大小。
所有项目文件使用固定文件名；缓存位于插件自有 ~/.cache/dsh-advisory-impact，官方判定旁保留来源与 UTC+8 抓取时间。
命令可直接运行，无需聊天模型；DSH 原生面板仍在开发中。`

export type Action = 'help' | 'pin' | 'watch' | 'refresh' | 'report' | 'open' | 'lookup'
export interface ActionArgs { project?: string; version?: string; component?: string; maven?: string; remove?: boolean; watch?: string[]; save?: boolean; id?: string }
export interface SurfaceResult { text: string; summary: unknown }

export function parseInput(input: string): { action: Action; args: ActionArgs } {
  const [verb = 'help', ...parts] = input.trim().split(/\s+/).filter(Boolean)
  const action = verb as Action
  const bad = (): never => { throw new Error('命令参数无效。\n' + HELP) }
  if (action === 'pin') {
    if (!parts.length) return { action, args: {} }
    if (parts[0] === 'remove' && parts.length === 2) return { action, args: { remove: true, project: parts[1] } }
    if (parts.length < 2 || parts.length > 4) bad()
    const args: ActionArgs = { project: parts[0], version: parts[1] }
    for (const option of parts.slice(2)) {
      const match = /^(component|maven)=(.+)$/.exec(option)
      if (!match || args[match[1] as 'component' | 'maven'] !== undefined) bad()
      args[match![1] as 'component' | 'maven'] = match![2]!
    }
    return { action, args }
  }
  if (action === 'watch' && parts.length <= 1) return { action, args: parts[0] ? { watch: parts[0] === 'none' ? [] : parts[0].split(',') } : {} }
  if (action === 'lookup' && parts.length === 1) return { action, args: { id: parts[0] } }
  if (action === 'report' && parts.length === 1 && parts[0] === 'save') return { action, args: { save: true } }
  if (['help', 'refresh', 'report', 'open'].includes(action) && !parts.length) return { action, args: {} }
  return bad()
}

/** The command, tools and later native UI share this model-free service. */
export class AdvisoryService {
  private chain: Promise<unknown> = Promise.resolve()
  constructor(private readonly options: Omit<EvaluateOptions, 'projectDirectory' | 'force'>) {}

  execute(directory: string | undefined, action: Action, args: ActionArgs, signal: AbortSignal): Promise<SurfaceResult> {
    const run = this.chain.then(() => this.perform(directory, action, args, signal))
    this.chain = run.catch(() => {})
    return run
  }

  private async perform(directory: string | undefined, action: Action, args: ActionArgs, signal: AbortSignal): Promise<SurfaceResult> {
    signal.throwIfAborted()
    if (action === 'help') return { text: HELP, summary: { help: HELP } }
    if (!directory) throw new Error('当前会话没有项目目录，请先选择本地项目')
    const respond = (summary: unknown, heading: string): SurfaceResult => ({ summary, text: heading + '\n' + JSON.stringify(summary, null, 2) })
    if (action === 'pin' || action === 'watch') {
      const settings = await loadSettings(this.options.config, directory)
      const editPin = action === 'pin' && args.project !== undefined
      if (editPin) {
        parseSettings({ watch: [args.project] })
        settings.pins = settings.pins.filter(p => p.project !== args.project)
        if (!args.remove) settings.pins.push({ project: args.project!, version: args.version!,
          ...(args.component ? { component: args.component } : {}), ...(args.maven ? { maven: args.maven } : {}) } satisfies ProductPin)
      }
      if (action === 'watch' && args.watch !== undefined) settings.watch = args.watch
      const changed = editPin || action === 'watch' && args.watch !== undefined
      signal.throwIfAborted()
      if (changed) await saveSettings(directory, settings)
      return respond({ ...settings, projectDirectory: directory, file: PIN_FILE, saved: changed }, changed ? '已保存项目配置。' : '当前项目配置：')
    }
    if (action === 'open') {
      const report = await openReport(directory)
      signal.throwIfAborted()
      return { text: report.path + '\n\n' + report.markdown, summary: { path: report.path, bytes: Buffer.byteLength(report.markdown) } }
    }
    const id = args.id?.toUpperCase()
    if (action === 'lookup' && (!id || !/^CVE-\d{4}-\d{4,}$/.test(id))) throw new Error('lookup 需要有效 CVE id，例如 CVE-YYYY-NNNN')
    const evaluation = await evaluatePins({ ...this.options, projectDirectory: directory, force: action === 'refresh', signal })
    signal.throwIfAborted()
    const view = createViewModel(evaluation)
    if (action === 'refresh') return respond(summarize(view), '来源刷新完成，请核对各来源的失败/陈旧状态：')
    if (action === 'lookup') {
      const official = view.projects.flatMap(p => (p.advisories ?? []).filter(a => a.id === id).map(a => ({ project: p.project, ...a })))
      const osv = official[0]?.osv.lookup ?? osvView(await this.options.osv.lookup(id!, evaluation.settings.cacheTtlMs))
      signal.throwIfAborted()
      return respond({ id, official, ...(official.length ? {} : { verdict: 'unknown', label: '无法判断',
        reason: '当前关注列表的可用官方清单中未找到此条目，不能推断不受影响', sources: view.projects.map(p => ({ project: p.project, source: p.source, error: p.error })) }),
      osv, suppressions: view.suppressions.items?.filter(s => s.id === id) ?? [], suppressionSource: view.suppressions.source,
      osvOnly: view.projects.flatMap(p => p.osvOnly.items.filter(i => i.id === id || i.aliases.includes(id!))),
      guidance: view.guidance }, '单条 CVE 核对（官方优先，OSV 第二来源）：')
    }
    const markdown = renderReport(view)
    signal.throwIfAborted()
    const saved = args.save ? await saveReport(directory, markdown) : undefined
    return { text: saved ? '已保存中文 Markdown 报告：' + saved : markdown,
      summary: { ...summarize(view), ...(saved ? { path: saved } : {}) } }
  }
}
