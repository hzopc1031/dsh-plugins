import { parse } from 'parse5'
import { clean, elements, fetchReleases, link, object, SOURCES, text } from './fetchers.js'
import type { HttpClient, SourceResponse } from './http.js'
import { singaporeTime } from './counts.js'
import { resolveWatchList } from './watch.js'

export const PROPOSAL_SOURCES = {
  kafka: 'https://cwiki.apache.org/confluence/display/KAFKA/Kafka+Improvement+Proposals',
  flink: 'https://cwiki.apache.org/confluence/display/FLINK/Flink+Improvement+Proposals',
} as const
export const KAFKA_DOWNLOADS = 'https://kafka.apache.org/community/downloads/'
const jiraProjects: Record<string, readonly string[]> = {
  kafka: ['KAFKA'], hadoop: ['HADOOP', 'HDFS', 'MAPREDUCE', 'YARN'], flink: ['FLINK'],
}

export interface FeedWindow {
  start: string; end: string; days: number; timezone: 'Asia/Singapore'; mode: 'rolling'; label: string
}
export function rollingWindow(now = new Date(), days = 7): FeedWindow {
  if (!Number.isFinite(now.getTime()) || !Number.isSafeInteger(days) || days <= 0) throw new Error('Invalid rolling window')
  const start = new Date(now.getTime() - days * 86_400_000).toISOString()
  const end = now.toISOString()
  return { start, end, days, timezone: 'Asia/Singapore', mode: 'rolling',
    label: `滚动最近 ${days} 天：${singaporeTime(start)} 至 ${singaporeTime(end)}（含两端）；仅日期按 UTC+8 当日零时筛选，日期未知项另列，不计作窗口内动态。` }
}

export interface FeedItem {
  project: string
  kind: 'release' | 'jira' | 'proposal'
  title: string
  url: string
  sourceUrl: string
  date?: string
  dateBasis?: 'catalogue-day' | 'updated' | 'created' | 'source-date'
  status?: string
  statusText?: string
  version?: string
  key?: string
  issueType?: string
  fixVersions?: string[]
  notesUrl?: string
  notesStatus?: 'found' | 'missing' | 'failed'
}
export interface FeedSource {
  project?: string
  kind: FeedItem['kind'] | 'release-notes'
  url?: string
  status: 'ok' | 'cached' | 'stale' | 'failed' | 'unavailable'
  fetchedAt?: string
  sourceTimestamp?: string
  error?: string
  warnings: string[]
}
export interface FeedReport {
  watchList: string[]
  window: FeedWindow
  sources: FeedSource[]
  items: FeedItem[]
  undatedItems: FeedItem[]
}
export interface FeedCacheEntry extends SourceResponse { sourceTimestamp?: string }
export type FeedCache = Map<string, FeedCacheEntry>
interface Parsed<T> { data: T; sourceTimestamp?: string; warnings: string[] }

function date(value: unknown): string {
  const result = text(value)
  const day = result.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day) throw new Error('Invalid feed date')
  if (result === day) return result
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/.test(result) && Number.isFinite(Date.parse(result))) return result
  throw new Error('Invalid feed date')
}
function sourceTime(root: Record<string, unknown>): string | undefined {
  const value = root.generated ?? root.last_updated
  return value === undefined ? undefined : text(value)
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Expected source array')
  return value
}

export function jiraSearchUrl(project: string, window: FeedWindow): string {
  if (!Object.hasOwn(jiraProjects, project)) throw new Error('JIRA adapter unavailable for this watched project')
  // JIRA's anonymous server timezone is unspecified; overfetch boundary days and filter returned timestamps locally.
  const lower = new Date(Date.parse(window.start) - 86_400_000).toISOString().slice(0, 10)
  const upper = new Date(Date.parse(window.end) + 2 * 86_400_000).toISOString().slice(0, 10)
  const jql = `project in (${jiraProjects[project]!.join(',')}) AND updated >= "${lower}" AND updated < "${upper}" ORDER BY updated DESC, key ASC`
  const url = new URL('https://issues.apache.org/jira/rest/api/2/search')
  url.search = new URLSearchParams({ jql, maxResults: '100', startAt: '0', fields: 'summary,issuetype,fixVersions,status,created,updated' }).toString()
  return url.href
}

export function parseJira(payload: string, project: string, url: string): Parsed<FeedItem[]> {
  if (!Object.hasOwn(jiraProjects, project)) throw new Error('JIRA adapter unavailable for this watched project')
  const root = object(JSON.parse(payload))
  const issues = list(root.issues)
  for (const field of ['total', 'startAt', 'maxResults']) {
    if (!Number.isSafeInteger(root[field]) || (root[field] as number) < 0) throw new Error('Invalid JIRA pagination')
  }
  if ((root.total as number) < (root.startAt as number) + issues.length || issues.length > (root.maxResults as number)) throw new Error('Inconsistent JIRA pagination')
  const warnings = ['JIRA 工单及 fixVersion / New Feature 不代表完整已发布特性列表。']
  // shortcut: one capped JIRA page per watched project; add polite pagination if complete history is required.
  if (root.startAt !== 0 || (root.total as number) > issues.length) warnings.push('JIRA 响应仅含部分结果；未扫描其他页，不能视为完整时间窗。')
  const data = issues.map(value => {
    const issue = object(value)
    const key = text(issue.key)
    if (!jiraProjects[project]!.some(prefix => new RegExp(`^${prefix}-[1-9][0-9]*$`).test(key))) throw new Error('JIRA returned an unwatched project')
    const fields = object(issue.fields)
    const dateBasis = fields.updated !== undefined ? 'updated' : fields.created !== undefined ? 'created' : undefined
    return { project, kind: 'jira', title: text(fields.summary), key,
      url: `https://issues.apache.org/jira/browse/${key}`, sourceUrl: url,
      status: text(object(fields.status).name), issueType: text(object(fields.issuetype).name),
      fixVersions: list(fields.fixVersions).map(v => text(object(v).name)),
      ...(dateBasis ? { date: date(fields[dateBasis]), dateBasis } : {}),
    } satisfies FeedItem
  })
  if (data.some(item => !item.date)) warnings.push('部分 JIRA 工单缺少日期，另列为日期未知参考项。')
  return { data, sourceTimestamp: sourceTime(root), warnings }
}

function html(payload: string) {
  if (!/<\/html>\s*$/i.test(payload)) throw new Error('Truncated feed HTML')
  return parse(payload)
}
export function parseProposals(payload: string, project: 'kafka' | 'flink'): Parsed<FeedItem[]> {
  const document = html(payload)
  const prefix = project === 'kafka' ? /\bKIP[- ]\d+/i : /\bFLIP[- ]\d+/i
  const data: FeedItem[] = []
  const warnings: string[] = []
  let section: string | undefined
  let tables = 0
  function walk(node: Parameters<typeof clean>[0]): void {
    if ('tagName' in node && node.tagName === 'h2') {
      const heading = clean(node)
      section = /under discussion/i.test(heading) ? 'discussion'
        : /^(adopted kips|accepted)$/i.test(heading) ? 'accepted'
        : /^implemented$/i.test(heading) ? 'implemented'
        : /^released$/i.test(heading) ? 'released'
        : /^discarded$/i.test(heading) ? 'discarded' : undefined
    }
    if ('tagName' in node && node.tagName === 'table' && section) {
      const headers = elements(node, 'th').map(clean)
      if (!/^(KIP|Title)/.test(headers[0] ?? '')) throw new Error('Missing proposal table header')
      tables++
      for (const row of elements(node, 'tr')) {
        const cells = elements(row, 'td')
        if (!cells.length) continue
        if (cells.length < 2) throw new Error('Invalid proposal row')
        const a = elements(cells[0]!, 'a').find(a => prefix.test(clean(a)))
        if (!a) { warnings.push('提案行缺少原文链接，已跳过。'); continue }
        const href = a.attrs.find(attr => attr.name === 'href')?.value
        if (!href) { warnings.push('提案行缺少原文链接，已跳过。'); continue }
        const url = link(new URL(href, PROPOSAL_SOURCES[project]).href)
        if (new URL(url).hostname !== 'cwiki.apache.org') throw new Error('Invalid proposal original URL')
        const statusText = clean(cells[1]!)
        const status = /\bimplemented\b/i.test(statusText) && !/\b(not|unimplemented)\b/i.test(statusText) ? 'implemented' : section
        const time = elements(row, 'time')[0]?.attrs.find(attr => attr.name === 'datetime')?.value
        data.push({ project, kind: 'proposal', title: text(clean(cells[0]!)), url, sourceUrl: PROPOSAL_SOURCES[project],
          status, statusText: `${section}; ${statusText}`,
          ...(time ? { date: date(time), dateBasis: 'source-date' as const } : {}) })
      }
      return
    }
    if ('childNodes' in node) node.childNodes.forEach(walk)
  }
  walk(document)
  if (!tables) throw new Error('Missing proposal index tables')
  if (data.some(item => !item.date)) warnings.push('索引未提供条目日期；日期未知项为参考提案，不是本周新增。')
  return { data, warnings: [...new Set(warnings)] }
}

export function parseKafkaNotes(payload: string): Parsed<Map<string, string>> {
  const document = html(payload)
  const data = new Map<string, string>()
  let version: string | undefined
  function walk(node: Parameters<typeof clean>[0]): void {
    if ('tagName' in node && /^h[1-6]$/.test(node.tagName)) {
      const title = clean(node)
      version = /^\d+\.\d+\.\d+(?:[-.\w]*)?$/.test(title) ? title : undefined
    }
    if ('tagName' in node && node.tagName === 'a' && version && clean(node) === 'Release Notes') {
      const href = node.attrs.find(attr => attr.name === 'href')?.value
      if (href) data.set(`Kafka-${version}`, link(new URL(href, KAFKA_DOWNLOADS).href))
    }
    if ('childNodes' in node) node.childNodes.forEach(walk)
  }
  walk(document)
  if (!elements(document, 'h3').length) throw new Error('Missing Kafka download version headings')
  return { data, warnings: [] }
}

export async function collectWatchFeeds(http: HttpClient, options: {
  watchList?: readonly string[]
  now?: Date
  days?: number
  ttlMs?: number
  cache?: FeedCache
} = {}): Promise<FeedReport> {
  const watchList = resolveWatchList(options.watchList)
  const now = options.now ?? new Date()
  const window = rollingWindow(now, options.days)
  const ttlMs = options.ttlMs ?? 3_600_000
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 0) throw new Error('Invalid feed cache TTL')
  const cache = options.cache ?? new Map<string, FeedCacheEntry>()
  const report: FeedReport = { watchList, window, sources: [], items: [], undatedItems: [] }
  async function read<T>(kind: FeedSource['kind'], url: string, parser: (payload: string) => Parsed<T> | Promise<Parsed<T>>, project?: string): Promise<T | undefined> {
    const source: FeedSource = { project, kind, url, status: 'ok', warnings: [] }
    report.sources.push(source)
    const previous = cache.get(url)
    const age = previous ? now.getTime() - Date.parse(previous.fetchedAt) : NaN
    try {
      if (previous && age >= 0 && age < ttlMs) {
        const parsed = await parser(previous.payload)
        Object.assign(source, { status: 'cached', fetchedAt: previous.fetchedAt, sourceTimestamp: parsed.sourceTimestamp ?? previous.sourceTimestamp, warnings: parsed.warnings })
        return parsed.data
      }
      const response = await http(url)
      if (response.url !== url || !Number.isFinite(Date.parse(response.fetchedAt))) throw new Error('Invalid feed response metadata')
      const parsed = await parser(response.payload)
      cache.set(url, { ...response, sourceTimestamp: parsed.sourceTimestamp })
      Object.assign(source, { fetchedAt: response.fetchedAt, sourceTimestamp: parsed.sourceTimestamp, warnings: parsed.warnings })
      return parsed.data
    } catch (error) {
      source.status = 'failed'
      source.error = `${url}: ${error instanceof Error ? error.message : String(error)}`
      if (previous) {
        try {
          const parsed = await parser(previous.payload)
          Object.assign(source, { status: 'stale', fetchedAt: previous.fetchedAt, sourceTimestamp: parsed.sourceTimestamp ?? previous.sourceTimestamp, warnings: parsed.warnings })
          return parsed.data
        } catch { source.warnings.push('上次缓存也不可解析，未使用。') }
      }
      return undefined
    }
  }
  function add(items: FeedItem[]) {
    for (const item of items) {
      if (!item.date) { report.undatedItems.push(item); continue }
      const time = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(item.date) ? `${item.date}T00:00:00+08:00` : item.date)
      if (time >= Date.parse(window.start) && time <= Date.parse(window.end)) report.items.push(item)
    }
  }
  if (!watchList.length) return report
  const releases = await read('release', SOURCES.releases, async payload => {
    const result = await fetchReleases(async url => ({ url, payload, fetchedAt: now.toISOString() }))
    return { data: result.data, sourceTimestamp: result.sourceTimestamp, warnings: [] }
  })
  for (const project of watchList) {
    const notes = project === 'kafka' ? await read('release-notes', KAFKA_DOWNLOADS, parseKafkaNotes, project) : undefined
    const notesSource = report.sources.find(source => source.project === project && source.kind === 'release-notes')
    add((releases ?? []).filter(item => item.project === project).map(item => ({
      ...item, kind: 'release', title: item.version, sourceUrl: SOURCES.releases, dateBasis: 'catalogue-day', status: 'catalogued',
      notesUrl: notes?.get(item.version), notesStatus: notes?.has(item.version) ? 'found'
        : notesSource?.status === 'failed' || notesSource?.status === 'stale' ? 'failed' : 'missing',
      statusText: notes?.has(item.version) ? '目录已收录；附项目原文链接。' : '目录已收录；未找到版本说明，不推断变更内容。',
    })))
    if (Object.hasOwn(jiraProjects, project)) {
      const url = jiraSearchUrl(project, window)
      const items = await read('jira', url, payload => parseJira(payload, project, url), project)
      if (items) add(items)
    } else report.sources.push({ project, kind: 'jira', status: 'unavailable', warnings: ['此项目尚无已验证的匿名 JIRA 适配器。'] })
    if (project === 'kafka' || project === 'flink') {
      const items = await read('proposal', PROPOSAL_SOURCES[project], payload => parseProposals(payload, project), project)
      if (items) add(items)
    } else report.sources.push({ project, kind: 'proposal', status: 'unavailable', warnings: [project === 'hadoop'
      ? 'Hadoop 没有已验证的通用 HIP 索引；研究中的候选地址返回 404，不抓取或虚构 HIP 表。'
      : '此项目尚无已验证的提案索引。'] })
  }
  return report
}
