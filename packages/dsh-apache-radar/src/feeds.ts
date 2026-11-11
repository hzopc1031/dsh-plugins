import { message } from './messages.js'
import { parse } from 'parse5'
import { clean, elements, fetchReleases, link, object, SOURCES, text } from './fetchers.js'
import type { HttpClient, SourceResponse } from './http.js'
import { singaporeTime } from './counts.js'
import { resolveWatchList } from './watch.js'
import { readCachedSource } from './feed-cache.js'

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
    label: message('feed.window', { days, start: singaporeTime(start), end: singaporeTime(end) }) }
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
export function isSecurityItem(item: FeedItem): boolean {
  return /\bCVE-\d{4}-\d+\b|\bsecurity\b|安全公告|漏洞/i.test(`${item.title} ${item.issueType ?? ''}`)
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
  const warnings = [message('feed.jiraWarning')]
  // shortcut: one capped JIRA page per watched project; add polite pagination if complete history is required.
  if (root.startAt !== 0 || (root.total as number) > issues.length) warnings.push(message('feed.partialJira'))
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
  if (data.some(item => !item.date)) warnings.push(message('feed.undatedJira'))
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
        if (!a) { warnings.push(message('feed.skippedProposal')); continue }
        const href = a.attrs.find(attr => attr.name === 'href')?.value
        if (!href) { warnings.push(message('feed.skippedProposal')); continue }
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
  if (data.some(item => !item.date)) warnings.push(message('feed.undatedProposals'))
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
  // Keep a saved collection window independent of the cache age clock.
  windowEnd?: Date
  ttlMs?: number
  cache?: FeedCache
} = {}): Promise<FeedReport> {
  const watchList = resolveWatchList(options.watchList)
  const now = options.now ?? new Date()
  const window = rollingWindow(options.windowEnd ?? now, options.days)
  const ttlMs = options.ttlMs ?? 3_600_000
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 0) throw new Error('Invalid feed cache TTL')
  const cache = options.cache ?? new Map<string, FeedCacheEntry>()
  const report: FeedReport = { watchList, window, sources: [], items: [], undatedItems: [] }
  async function read<T>(kind: FeedSource['kind'], url: string, parser: (payload: string) => Parsed<T> | Promise<Parsed<T>>, project?: string): Promise<T | undefined> {
    const source: FeedSource = { project, kind, url, status: 'ok', warnings: [] }
    report.sources.push(source)
    try {
      const result = await readCachedSource(http, url, response => parser(response.payload), { cache, now, ttlMs })
      Object.assign(source, { status: result.cacheStatus, fetchedAt: result.fetchedAt,
        sourceTimestamp: result.sourceTimestamp, warnings: result.warnings, error: result.cacheError })
      return result.data
    } catch (error) {
      source.status = 'failed'
      source.error = error instanceof Error ? error.message : String(error)
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
      statusText: notes?.has(item.version) ? message('feed.notesFound') : message('feed.notesMissing'),
    })))
    if (Object.hasOwn(jiraProjects, project)) {
      const url = jiraSearchUrl(project, window)
      const items = await read('jira', url, payload => parseJira(payload, project, url), project)
      if (items) add(items)
    } else report.sources.push({ project, kind: 'jira', status: 'unavailable', warnings: [message('feed.noJira')] })
    if (project === 'kafka' || project === 'flink') {
      const items = await read('proposal', PROPOSAL_SOURCES[project], payload => parseProposals(payload, project), project)
      if (items) add(items)
    } else report.sources.push({ project, kind: 'proposal', status: 'unavailable', warnings: [project === 'hadoop'
      ? message('feed.noHip')
      : message('feed.noProposal')] })
  }
  return report
}
