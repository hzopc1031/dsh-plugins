import { parse, type DefaultTreeAdapterMap } from 'parse5'
import type { HttpClient } from './http.js'

export const SOURCES = {
  chooser: 'https://projects.apache.org/json/foundation/chooser.json',
  committees: 'https://whimsy.apache.org/public/committee-info.json',
  retired: 'https://whimsy.apache.org/public/committee-retired.json',
  retiredProjects: 'https://projects.apache.org/json/foundation/committees-retired.json',
  podlings: 'https://projects.apache.org/json/foundation/podlings.json',
  publicPodlings: 'https://whimsy.apache.org/public/public_podlings.json',
  releases: 'https://projects.apache.org/json/foundation/releases.json',
  attic: 'https://attic.apache.org/projects.html',
} as const

export interface SourceResult<T> {
  url: string
  fetchedAt: string
  sourceTimestamp?: string
  data: T
  cacheStatus?: 'ok' | 'cached' | 'stale'
  cacheError?: string
}
export interface Project { id: string; name: string; homepage: string; pmc: string; areas: string[] }
export interface Committee { id: string; name: string; pmc: boolean }
export interface RetiredCommittee { id: string; name: string; retired: string }
export interface Podling { id: string; name: string; status: 'current' | 'graduated' | 'retired'; homepage?: string }
export interface Release { project: string; version: string; date: string; url: string }
export interface AtticProject {
  id: string; name: string; type: 'PMC' | 'Subproject'; url: string
  description: string; established: string; retired: string
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object')
  return value as Record<string, unknown>
}
function entries(value: unknown): [string, unknown][] {
  const result = Object.entries(object(value))
  if (!result.length) throw new Error('Missing source entries')
  return result
}
export function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Expected a nonempty string')
  return value
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value) || !value.length) throw new Error('Expected a nonempty array')
  return value
}
function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Expected a boolean')
  return value
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Expected a source count')
  return value
}
export function link(value: unknown): string {
  const url = new URL(text(value))
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid source link')
  return url.href
}
function timestamp(raw: Record<string, unknown>): string | undefined {
  const value = raw.generated ?? raw.last_updated
  return value === undefined ? undefined : text(value)
}
async function json<T>(http: HttpClient, url: string, normalize: (raw: unknown) => T): Promise<SourceResult<T>> {
  const response = await http(url)
  try {
    const raw: unknown = JSON.parse(response.payload)
    return { url: response.url, fetchedAt: response.fetchedAt,
      sourceTimestamp: Array.isArray(raw) ? undefined : timestamp(object(raw)), data: normalize(raw) }
  } catch (cause) {
    throw new Error(`Invalid source payload: ${url}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause })
  }
}

export function fetchChooser(http: HttpClient) {
  return json(http, SOURCES.chooser, raw => {
    const root = object(raw)
    const questions = array(root.questions).map(object)
    const area = questions.find(q => q.id === 'area')
    const categories = array(area?.options).map(o => text(object(o).value))
    const projects: Project[] = array(root.projects).map(value => {
      const p = object(value)
      if (!Array.isArray(p.area) || p.area.some(a => typeof a !== 'string' || !categories.includes(a))) throw new Error('Invalid chooser area tags')
      return { id: text(p.id), name: text(p.name), homepage: link(p.homepage), pmc: text(p.pmc), areas: p.area as string[] }
    })
    return { projects, categories }
  })
}

export function fetchCommittees(http: HttpClient) {
  return json(http, SOURCES.committees, raw => {
    const root = object(raw)
    const committees: Committee[] = entries(root.committees).map(([id, value]) => {
      const c = object(value)
      return { id, name: text(c.display_name), pmc: bool(c.pmc) }
    })
    const committeeCount = count(root.committee_count)
    const pmcCount = count(root.pmc_count)
    if (committees.length !== committeeCount || committees.filter(c => c.pmc).length !== pmcCount) throw new Error('Committee source counts do not match entries')
    return { committees, committeeCount, pmcCount }
  })
}

export function fetchRetiredCommittees(http: HttpClient) {
  return json(http, SOURCES.retired, raw => {
    const root = object(raw)
    const committees: RetiredCommittee[] = entries(root.retired).map(([id, value]) => {
      const c = object(value)
      return { id, name: text(c.display_name), retired: text(c.retired) }
    })
    if (count(root.retired_count) !== committees.length) throw new Error('Retired source count does not match entries')
    return committees
  })
}

export function fetchRetiredProjects(http: HttpClient) {
  return json(http, SOURCES.retiredProjects, raw => array(raw).map(value => {
    const c = object(value)
    return { id: text(c.id), name: text(c.name), retired: text(c.retired) } satisfies RetiredCommittee
  }))
}

export function fetchPodlings(http: HttpClient) {
  return json(http, SOURCES.podlings, raw => entries(raw).map(([id, value]) => {
    const p = object(value)
    if (p.podling !== true || p.pmc !== 'incubator') throw new Error('Invalid current podling')
    return { id, name: text(p.name), status: 'current', homepage: link(p.homepage) } satisfies Podling
  }))
}

export function fetchPublicPodlings(http: HttpClient) {
  return json(http, SOURCES.publicPodlings, raw => {
    const root = object(raw)
    const podlings: Podling[] = entries(root.podling).map(([id, value]) => {
      const p = object(value)
      if (p.status !== 'current' && p.status !== 'graduated' && p.status !== 'retired') throw new Error('Invalid podling status')
      return { id, name: text(p.name), status: p.status, homepage: p.homepage ? link(p.homepage) : undefined }
    })
    if (count(root.podling_count) !== podlings.length) throw new Error('Podling source count does not match entries')
    const statusCounts = object(root.status_counts)
    for (const status of ['current', 'graduated', 'retired']) {
      if (count(statusCounts[status]) !== podlings.filter(p => p.status === status).length) throw new Error('Podling status count does not match entries')
    }
    return podlings
  })
}

export function fetchReleases(http: HttpClient) {
  return json(http, SOURCES.releases, raw => entries(raw).flatMap(([project, values]) =>
    Object.entries(object(values)).map(([version, value]) => {
      const date = text(value)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error(`Invalid release date: ${project}/${version}`)
      return { project, version: text(version), date, url: SOURCES.releases } satisfies Release
    })))
}

type Node = DefaultTreeAdapterMap['node']
type Element = DefaultTreeAdapterMap['element']
export function elements(node: Node, tag: string): Element[] {
  const matches = 'tagName' in node && node.tagName === tag ? [node] : []
  return matches.concat('childNodes' in node ? node.childNodes.flatMap(child => elements(child, tag)) : [])
}
function content(node: Node): string {
  if (node.nodeName === '#text' && 'value' in node) return node.value
  return 'childNodes' in node ? node.childNodes.map(content).join('') : ''
}
export const clean = (node: Node) => content(node).replace(/\s+/g, ' ').trim()

export async function fetchAtticProjects(http: HttpClient): Promise<SourceResult<AtticProject[]>> {
  const response = await http(SOURCES.attic)
  try {
    if (!/<\/html>\s*$/i.test(response.payload)) throw new Error('Truncated Attic document')
    const tables = elements(parse(response.payload), 'table').filter(table =>
      elements(table, 'th').map(clean).join('|') === 'Project|Type|Description|Establish|Retire')
    if (tables.length !== 1) throw new Error('Missing or ambiguous Attic project table')
    const rows = elements(tables[0]!, 'tr').filter(row => elements(row, 'td').length > 0)
    if (!rows.length) throw new Error('Missing Attic rows')
    const data = rows.map(row => {
      const cells = elements(row, 'td')
      if (cells.length !== 5) throw new Error('Invalid Attic row')
      const a = elements(cells[0]!, 'a')[0]
      const href = a?.attrs.find(attr => attr.name === 'href')?.value
      if (!a || !href || !/^\/projects\/[\w-]+\.html$/.test(href)) throw new Error('Invalid Attic project link')
      const type = clean(cells[1]!)
      if (type !== 'PMC' && type !== 'Subproject') throw new Error('Unknown Attic project type')
      return { id: href.slice('/projects/'.length, -'.html'.length), name: text(clean(a)), type,
        url: new URL(href, SOURCES.attic).href, description: clean(cells[2]!),
        established: clean(cells[3]!), retired: text(clean(cells[4]!)) } satisfies AtticProject
    })
    return { url: response.url, fetchedAt: response.fetchedAt, data }
  } catch (cause) {
    throw new Error(`Invalid source payload: ${SOURCES.attic}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause })
  }
}
