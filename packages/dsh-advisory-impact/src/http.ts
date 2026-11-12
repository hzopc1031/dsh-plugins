import { createIntranetHttp, describeNetworkError, effectiveTimeout, fetchOfficial, type IntranetSettings } from './intranet-http.js'
import { setTimeout as delay } from 'node:timers/promises'
import type { HttpClient, MavenQuery, SourceDocument } from './types.js'

export const SOURCES = {
  kafka: 'https://kafka.apache.org/community/cve-list/',
  hadoop: 'https://hadoop.apache.org/cve_list.html',
  flink: 'https://security.apache.org/projects/flink/',
  flinkPointer: 'https://flink.apache.org/what-is-flink/security/',
  suppressions: 'https://raw.githubusercontent.com/apache/kafka/trunk/gradle/resources/dependencycheck-suppressions.xml',
  guidance: 'https://security.apache.org/report-dependency/',
} as const

export const USER_AGENT = 'dsh-advisory-impact/0.1.4 (https://github.com/hzopc1031/dsh-plugins)'
const allowed = new Set<string>(Object.values(SOURCES))

export class SourceError extends Error {
  constructor(public readonly url: string, message: string, options?: ErrorOptions) {
    super(`${message} (${url})`, options)
    this.name = 'SourceError'
  }
}

export function assertSourceUrl(url: string): void {
  // Exact public endpoints also exclude credentials, login, reporter.apache.org and arbitrary redirects.
  if (!allowed.has(url)) throw new Error('Only documented anonymous official source URLs are allowed')
}

export interface HttpOptions extends IntranetSettings {
  fetch?: typeof globalThis.fetch
  now?: () => Date
  sleep?: (ms: number) => Promise<unknown>
  timeoutMs?: number
  maxBytes?: number
}

async function readPayload(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) throw new Error('Empty response body')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) throw new Error('Response exceeds size limit')
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally {
    reader.releaseLock()
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
}

/** Serial anonymous GETs, one bounded 429 retry, bounded official redirects and no implicit live requests. */
export function createHttpClient(options: HttpOptions = {}): HttpClient & Pick<ReturnType<typeof createIntranetHttp>, 'close' | 'diagnose'> {
  return transport(false, options)
}

export const OSV_QUERY_URL = 'https://api.osv.dev/v1/query'
export const OSV_ID = /^(?:CVE-\d{4}-\d{4,}|GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4})$/
export function osvUrl(id: string): string {
  if (!OSV_ID.test(id)) throw new Error('Invalid CVE/GHSA id')
  return `https://api.osv.dev/v1/vulns/${id}`
}

export function assertOsvRequest(url: string, query?: MavenQuery): void {
  if (query) {
    if (url !== OSV_QUERY_URL || !/^[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+$/.test(query.maven)
      || !query.version || query.version.length > 200 || /[\x00-\x20\x7f]/.test(query.version)) throw new Error('OSV query requires a pinned Maven coordinate and version')
  } else if (!url.startsWith('https://api.osv.dev/v1/vulns/') || osvUrl(url.slice('https://api.osv.dev/v1/vulns/'.length)) !== url) {
    throw new Error('Only documented anonymous OSV endpoints are allowed')
  }
}

export function createOsvHttpClient(options: HttpOptions = {}): HttpClient & Pick<ReturnType<typeof createIntranetHttp>, 'close' | 'diagnose'> {
  return transport(true, options)
}

function transport(osv: boolean, options: HttpOptions): HttpClient & Pick<ReturnType<typeof createIntranetHttp>, 'close' | 'diagnose'> {
  const network = createIntranetHttp(options)
  const fetch = options.fetch ?? network.fetch
  const now = options.now ?? (() => new Date())
  const sleep = options.sleep ?? delay
  const timeoutMs = options.timeoutMs ?? effectiveTimeout(options)
  const maxBytes = options.maxBytes ?? 4 * 1024 * 1024
  for (const n of [timeoutMs, maxBytes]) {
    if (!Number.isSafeInteger(n) || n <= 0) throw new Error('HTTP limits must be positive integers')
  }
  const request = async (url: string, query?: MavenQuery): Promise<SourceDocument> => {
    if (osv) assertOsvRequest(url, query)
    else {
      assertSourceUrl(url)
      if (query) throw new Error('Official sources accept GET only')
    }
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await fetchOfficial(fetch, url, {
          method: query ? 'POST' : 'GET', redirect: 'manual', credentials: 'omit',
          headers: { 'User-Agent': USER_AGENT, Accept: osv ? 'application/json' : 'text/html, application/xml, text/xml, text/plain',
            ...(query ? { 'Content-Type': 'application/json' } : {}) },
          ...(query ? { body: JSON.stringify({ package: { name: query.maven, ecosystem: 'Maven' }, version: query.version }) } : {}),
          signal: AbortSignal.timeout(timeoutMs),
        }, new Set(osv ? ['api.osv.dev'] : Object.values(SOURCES).map(url => new URL(url).hostname)))
        if (response.status === 429 && attempt === 0) {
          await response.body?.cancel()
          const retry = response.headers.get('retry-after')
          const ms = retry === null ? 1_000 : /^\d+$/.test(retry)
            ? Number(retry) * 1_000 : Date.parse(retry) - now().getTime()
          if (!Number.isFinite(ms) || ms > 60_000) throw new Error('HTTP 429; retry later')
          await sleep(Math.max(1_000, ms))
          continue
        }
        if (osv && !query && response.status === 404) {
          const payload = response.body ? await readPayload(response, maxBytes) : ''
          return { url, payload, status: 404, fetchedAt: now().toISOString() }
        }
        if (!response.ok) {
          await response.body?.cancel()
          throw new Error(`HTTP ${response.status}`)
        }
        const payload = await readPayload(response, maxBytes)
        if (!payload.trim()) throw new Error('Empty response body')
        return { url, payload, ...(osv ? { status: response.status } : {}), fetchedAt: now().toISOString() }
      }
      throw new Error('HTTP 429; retry later')
    } catch (error) {
      const info = describeNetworkError(error)
      const detail = error instanceof Error ? error.message : 'fetch failed'
      const hint = !detail.includes(info.hintZh) && (info.code !== 'NETWORK_ERROR' || /fetch failed/i.test(detail)) ? `；${info.code}；${info.hintZh}` : ''
      throw new SourceError(url, detail + hint, { cause: error })
    }
  }
  let pending: Promise<unknown> = Promise.resolve()
  const client: HttpClient = (url, query) => {
    const result = pending.then(() => request(url, query))
    pending = result.catch(() => {})
    return result
  }
  return Object.assign(client, { close: network.close, diagnose: network.diagnose })
}
