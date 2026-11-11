import {
  SOURCES, fetchChooser, fetchCommittees, fetchPodlings, fetchPublicPodlings,
  fetchRetiredCommittees, fetchRetiredProjects, fetchAtticProjects,
  type Podling,
} from './fetchers.js'
import type { HttpClient } from './http.js'
import { readCachedSource, type CacheOptions } from './feed-cache.js'

const fetchers = {
  chooser: fetchChooser, committees: fetchCommittees, podlings: fetchPodlings,
  publicPodlings: fetchPublicPodlings, retired: fetchRetiredCommittees,
  retiredProjects: fetchRetiredProjects, attic: fetchAtticProjects,
}
type SourceKey = keyof typeof fetchers
type Result<K extends SourceKey> = Awaited<ReturnType<(typeof fetchers)[K]>>
export interface SourceFailure { error: string }
export type CountSources = { [K in SourceKey]?: Result<K> | SourceFailure }
export interface Citation {
  url: string
  fetchedAt: string | null
  fetchedAtDisplay: string | null
  sourceTimestamp?: string
  cacheStatus?: 'ok' | 'cached' | 'stale'
  cacheError?: string
}
export interface Member { id: string; name: string }
interface Evidence { id: string; label: string; sources: Citation[] }
export type CountRow = Evidence & { note: string } & (
  { status: 'ok'; value: number } | { status: 'error'; error: string }
)
export type Comparison = Evidence & { note: string } & (
  { status: 'match' | 'mismatch'; onlyLeft: Member[]; onlyRight: Member[] } |
  { status: 'error'; error: string }
)
export type Categories = Evidence & (
  { status: 'ok'; official: true; multiLabel: true; rows: (CountRow & { members: Member[] })[] } |
  { status: 'error'; error: string }
)
export interface CountsReport {
  timezone: 'Asia/Singapore'
  explanation: string
  counts: CountRow[]
  retired: CountRow[]
  comparisons: Comparison[]
  categories: Categories
}

export function singaporeTime(timestamp: string): string {
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid fetch time: ${timestamp}`)
  return `${new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(date)} Asia/Singapore (UTC+8)`
}

const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)
const sorted = (members: Member[]) => [...members].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
const tlps = (data: Result<'chooser'>['data']) => [...new Set(data.projects
  .filter(p => p.pmc !== 'incubator' && p.pmc !== 'attic').map(p => p.pmc))]
const chooserPodlings = (data: Result<'chooser'>['data']) => data.projects
  .filter(p => p.pmc === 'incubator').map(p => ({ id: p.id.replace(/^incubator-/, ''), name: p.name }))
const currentPodlings = (data: Podling[]) => data.filter(p => p.status === 'current')

export function buildCountsReport(inputs: CountSources): CountsReport {
  function source<K extends SourceKey>(key: K): Result<K> {
    const input = inputs[key]
    if (!input) throw new Error(`来源缺失：${SOURCES[key]}`)
    if ('error' in input) throw new Error(input.error)
    return input as Result<K>
  }
  function citation(key: SourceKey): Citation {
    const input = inputs[key]
    if (!input || 'error' in input) return { url: SOURCES[key], fetchedAt: null, fetchedAtDisplay: null }
    return { url: input.url, fetchedAt: input.fetchedAt, fetchedAtDisplay: singaporeTime(input.fetchedAt),
      ...(input.cacheStatus === undefined ? {} : { cacheStatus: input.cacheStatus }),
      ...(input.cacheError === undefined ? {} : { cacheError: input.cacheError }),
      ...(input.sourceTimestamp === undefined ? {} : { sourceTimestamp: input.sourceTimestamp }) }
  }
  function measure<K extends SourceKey>(id: string, label: string, key: K,
    value: (data: Result<K>['data']) => number, note: string): CountRow {
    const evidence = { id, label, sources: [citation(key)], note }
    try {
      return { ...evidence, status: 'ok', value: value(source(key).data) }
    } catch (error) {
      return { ...evidence, status: 'error', error: errorText(error) }
    }
  }
  function compare<L extends SourceKey, R extends SourceKey>(id: string, label: string,
    left: L, right: R, leftMembers: (data: Result<L>['data']) => Member[],
    rightMembers: (data: Result<R>['data']) => Member[], note: string): Comparison {
    const evidence = { id, label, sources: [citation(left), citation(right)], note }
    try {
      const l = leftMembers(source(left).data)
      const r = rightMembers(source(right).data)
      const leftIds = new Set(l.map(m => m.id))
      const rightIds = new Set(r.map(m => m.id))
      const onlyLeft = sorted(l.filter(m => !rightIds.has(m.id)))
      const onlyRight = sorted(r.filter(m => !leftIds.has(m.id)))
      return { ...evidence, status: onlyLeft.length || onlyRight.length ? 'mismatch' : 'match', onlyLeft, onlyRight }
    } catch (error) {
      return { ...evidence, status: 'error', error: errorText(error) }
    }
  }
  const counts = [
    measure('currently-listed', '当前列示（TLP + 孵化项目）', 'chooser',
      data => tlps(data).length + chooserPodlings(data).length, 'chooser 的当前 TLP 与当前孵化项目之和；不是唯一官方总数。'),
    measure('chooser-tlps', '当前 TLP（chooser）', 'chooser', data => tlps(data).length,
      '按 chooser 的 PMC 标识去重，排除 Incubator 和 Attic；另与委员会来源交叉核对。'),
    measure('chooser-podlings', '当前孵化项目（chooser）', 'chooser', data => chooserPodlings(data).length,
      'chooser 中 PMC 为 incubator 的项目。'),
    measure('pmcs', 'PMC（Whimsy）', 'committees', data => data.pmcCount, '含 Incubator 和 Attic。'),
    measure('all-committees', '全部委员会（Whimsy）', 'committees', data => data.committeeCount, '包括非 PMC 委员会。'),
    measure('podlings', '当前孵化项目（projects.apache.org）', 'podlings', data => currentPodlings(data).length,
      '当前 podlings 目录。'),
    measure('public-podlings', '当前孵化项目（Whimsy）', 'publicPodlings', data => currentPodlings(data).length,
      '仅 status=current；不含已毕业或已退休的孵化项目。'),
  ]
  const retired = [
    measure('retired-whimsy', '退休委员会（Whimsy）', 'retired', data => data.length, 'Whimsy retired committees 口径。'),
    measure('retired-projects', '退休委员会（projects.apache.org）', 'retiredProjects', data => data.length,
      'projects.apache.org retired committees 口径。'),
    measure('attic-pmcs', 'Attic PMC 行', 'attic', data => data.filter(p => p.type === 'PMC').length, '仅 Attic 表中的 PMC 行。'),
    measure('attic-subprojects', 'Attic 子项目行', 'attic', data => data.filter(p => p.type === 'Subproject').length,
      '仅 Attic 表中的 Subproject 行；不合并为退休总数。'),
  ]
  const retiredNote = '按原始标识比较名单；来源口径不同，差异保留，不推断一一对应或自行调平。'
  const comparisons = [
    compare('tlp-cross-check', 'chooser TLP ↔ Whimsy PMC 排除 Incubator、Attic', 'chooser', 'committees',
      data => tlps(data).map(id => ({ id, name: data.projects.find(p => p.pmc === id)!.name })),
      data => {
        for (const id of ['incubator', 'attic']) {
          if (!data.committees.some(c => c.id === id && c.pmc)) throw new Error(`PMC 交叉核对缺少 ${id}`)
        }
        return data.committees.filter(c => c.pmc && c.id !== 'incubator' && c.id !== 'attic')
      }, '以实际委员会标识排除 Incubator、Attic；比较名单，不只比较数量。'),
    compare('podlings-chooser-projects', 'chooser ↔ projects.apache.org 当前孵化项目', 'chooser', 'podlings',
      chooserPodlings, currentPodlings, 'chooser 孵化项目标识去掉 incubator- 前缀后比较；保留名单差异。'),
    compare('podlings-projects-whimsy', 'projects.apache.org ↔ Whimsy 当前孵化项目', 'podlings', 'publicPodlings',
      currentPodlings, currentPodlings, '仅比较当前孵化项目名单。'),
    compare('retired-whimsy-projects', 'Whimsy ↔ projects.apache.org 退休委员会', 'retired', 'retiredProjects',
      data => data, data => data, retiredNote),
    compare('retired-whimsy-attic', 'Whimsy 退休委员会 ↔ Attic PMC', 'retired', 'attic',
      data => data, data => data.filter(p => p.type === 'PMC'), retiredNote),
    compare('retired-projects-attic', 'projects.apache.org 退休委员会 ↔ Attic PMC', 'retiredProjects', 'attic',
      data => data, data => data.filter(p => p.type === 'PMC'), retiredNote),
  ]
  const categoryEvidence = { id: 'chooser-areas', label: '官方 chooser 领域标签', sources: [citation('chooser')] }
  let categories: Categories
  try {
    const { data } = source('chooser')
    categories = { ...categoryEvidence, status: 'ok', official: true, multiLabel: true,
      rows: data.categories.map(label => {
        const members = sorted(data.projects.filter(p => p.areas.includes(label)))
        return { ...measure(label, label, 'chooser', () => members.length, '官方领域标签，可多选；分类数量不能相加作为项目总数。'),
          members: members.map(({ id, name }) => ({ id, name })) }
      }) }
  } catch (error) {
    categories = { ...categoryEvidence, status: 'error', error: errorText(error) }
  }
  return { timezone: 'Asia/Singapore',
    explanation: '并列展示各来源口径。当前列示 = chooser 当前 TLP + 当前孵化项目；另以 Whimsy PMC 排除 Incubator、Attic 交叉核对。退休口径分别展示，不合并为单一退休总数。',
    counts, retired, comparisons, categories }
}

export async function fetchCountsReport(http: HttpClient, options: CacheOptions = {}): Promise<CountsReport> {
  const inputs: CountSources = {}
  // The HTTP client owns concurrency and rate-limit handling; one failure must not erase other sources.
  for (const key of Object.keys(fetchers) as SourceKey[]) {
    try {
      Object.assign(inputs, { [key]: await readCachedSource<Result<SourceKey>>(http, SOURCES[key], async response => fetchers[key](async () => response), options) })
    } catch (error) {
      inputs[key] = { error: errorText(error) }
    }
  }
  return buildCountsReport(inputs)
}

const markdown = (text: string) => text.replace(/[\\`*_[\]<>|]/g, '\\$&').replace(/[\r\n]+/g, ' ')
const membersText = (members: Member[]) => members.length ? members.map(m => `${markdown(m.name)} (${markdown(m.id)})`).join('、') : '无'
const citationsText = (sources: Citation[]) => sources.map(s =>
  `[${markdown(s.url)}](${s.url})；抓取：${s.fetchedAtDisplay ?? '无成功抓取时间'}${s.sourceTimestamp === undefined ? '' : `；源文件时间：${markdown(s.sourceTimestamp)}`}；缓存：${s.fetchedAt ? s.cacheStatus ?? 'ok' : '无可用缓存'}${s.cacheError ? `；刷新失败：${markdown(s.cacheError)}（沿用上次成功缓存）` : ''}`).join('； ')

export function renderCountsMarkdown(report: CountsReport): string {
  const table = (rows: CountRow[]) => [
    '| 口径 | 数量 / 状态 | 来源与时间 | 说明 |', '| --- | --- | --- | --- |',
    ...rows.map(row => `| ${markdown(row.label)} | ${row.status === 'ok' ? row.value : `错误：${markdown(row.error)}`} | ${citationsText(row.sources)} | ${markdown(row.note)} |`),
  ].join('\n')
  const comparisons = report.comparisons.map(c => `- ${markdown(c.label)}：${c.status === 'error'
    ? `错误：${markdown(c.error)}`
    : `${c.status === 'match' ? '名单一致' : '名单有差异'}；仅左侧：${membersText(c.onlyLeft)}；仅右侧：${membersText(c.onlyRight)}`}。${markdown(c.note)} 来源顺序为左、右：${citationsText(c.sources)}`)
  const categories = report.categories.status === 'error'
    ? `错误：${markdown(report.categories.error)}。${citationsText(report.categories.sources)}`
    : `${table(report.categories.rows)}\n\n${report.categories.rows.map(row => `- ${markdown(row.label)}：${membersText(row.members)}`).join('\n')}`
  return `## Apache 官方数量口径\n\n${report.explanation}\n\n${table(report.counts)}\n\n### 退休来源并列\n\n${table(report.retired)}\n\n### 名单交叉核对\n\n${comparisons.join('\n')}\n\n### 官方领域分类（多标签）\n\n${categories}\n`
}
