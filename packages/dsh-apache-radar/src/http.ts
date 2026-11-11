import { setTimeout as delay } from 'node:timers/promises'

export interface SourceResponse {
  url: string
  fetchedAt: string
  payload: string
}
export type HttpClient = (url: string) => Promise<SourceResponse>
export const USER_AGENT = 'dsh-apache-radar/0.1.0 (+https://github.com/hzopc1031/dsh-plugins)'

const hosts = new Set(['projects.apache.org', 'whimsy.apache.org', 'attic.apache.org',
  'incubator.apache.org', 'kafka.apache.org', 'svn.apache.org', 'issues.apache.org', 'cwiki.apache.org',
  'release-catalog.apache.org', 'www.apache.org', 'apache.org'])

export function publicSourceUrl(input: string): string {
  const url = new URL(input)
  if (url.hostname === 'reporter.apache.org' || url.hostname.endsWith('.reporter.apache.org')) {
    throw new Error('reporter.apache.org is forbidden')
  }
  if (url.protocol !== 'https:' || !hosts.has(url.hostname) || url.username || url.password || url.port) {
    throw new Error('Only documented public ASF HTTPS hosts are allowed')
  }
  return url.href
}

export class HttpError extends Error {
  constructor(readonly url: string, readonly status: number, readonly retryAt?: string) {
    super(`HTTP ${status}: ${url}${retryAt ? `; back off until ${retryAt}` : ''}`)
  }
}

export function createHttpClient(options: {
  fetch?: typeof globalThis.fetch
  now?: () => Date
  timeoutMs?: number
  sleep?: (ms: number) => Promise<unknown>
} = {}): HttpClient {
  const fetcher = options.fetch ?? globalThis.fetch
  const now = options.now ?? (() => new Date())
  const sleep = options.sleep ?? delay
  const timeoutMs = options.timeoutMs ?? 15_000
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('Invalid HTTP timeout')
  let queue: Promise<unknown> = Promise.resolve()
  let blockedUntil = 0
  return input => {
    const url = publicSourceUrl(input)
    const request = queue.then(async () => {
      const remaining = blockedUntil - now().getTime()
      if (remaining > 0) await sleep(remaining)
      try {
        const response = await fetcher(url, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, text/html, application/xml;q=0.9' },
          signal: AbortSignal.timeout(timeoutMs), redirect: 'error', credentials: 'omit',
        })
        if (!response.ok) {
          if (response.status === 429) {
            const retry = response.headers.get('retry-after')
            const until = retry && /^\d+$/.test(retry)
              ? now().getTime() + Number(retry) * 1000 : Date.parse(retry ?? '')
            blockedUntil = Math.max(now().getTime() + 1000, Number.isFinite(new Date(until).getTime()) ? until : now().getTime() + 60_000)
          }
          await response.body?.cancel()
          throw new HttpError(url, response.status, response.status === 429 ? new Date(blockedUntil).toISOString() : undefined)
        }
        const payload = await response.text()
        return { url, fetchedAt: now().toISOString(), payload }
      } catch (cause) {
        if (cause instanceof HttpError) throw cause
        throw new Error(`Fetch failed: ${url}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause })
      }
    })
    queue = request.catch(() => {})
    return request
  }
}
