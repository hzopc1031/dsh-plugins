import { publicSourceUrl, type HttpClient, type SourceResponse } from './http.js'
import type { FeedCache, FeedCacheEntry } from './feeds.js'
import { readLocal, writeLocal } from './local-files.js'

const filename = '.apache-radar-feed-cache.json'
function validate(value: unknown): FeedCacheEntry {
  if (!value || typeof value !== 'object') throw new Error('Invalid feed cache entry')
  const entry = value as Partial<FeedCacheEntry>
  if (typeof entry.url !== 'string' || publicSourceUrl(entry.url) !== entry.url
    || typeof entry.payload !== 'string' || typeof entry.fetchedAt !== 'string' || !Number.isFinite(Date.parse(entry.fetchedAt))
    || (entry.sourceTimestamp !== undefined && typeof entry.sourceTimestamp !== 'string')) throw new Error('Invalid feed cache metadata')
  return { url: entry.url, fetchedAt: entry.fetchedAt, payload: entry.payload, sourceTimestamp: entry.sourceTimestamp }
}

export async function loadFeedCache(directory: string): Promise<FeedCache> {
  const content = await readLocal(directory, filename)
  if (content === undefined) return new Map()
  const raw: unknown = JSON.parse(content)
  if (!Array.isArray(raw)) throw new Error('Invalid feed cache document')
  const result: FeedCache = new Map()
  for (const value of raw) {
    const entry = validate(value)
    if (result.has(entry.url)) throw new Error('Duplicate feed cache URL')
    result.set(entry.url, entry)
  }
  return result
}
export async function saveFeedCache(directory: string, cache: FeedCache): Promise<void> {
  const entries = [...cache.entries()].map(([url, value]) => {
    const entry = validate(value)
    if (url !== entry.url) throw new Error('Feed cache URL mismatch')
    return entry
  })
  await writeLocal(directory, filename, JSON.stringify(entries))
}

export interface CacheOptions { cache?: FeedCache; now?: Date; ttlMs?: number }
export async function readCachedSource<T extends { sourceTimestamp?: string }>(
  http: HttpClient, url: string, parser: (response: SourceResponse) => Promise<T> | T, options: CacheOptions = {},
): Promise<T & { url: string; fetchedAt: string; cacheStatus: 'ok' | 'cached' | 'stale'; cacheError?: string }> {
  publicSourceUrl(url)
  const now = options.now ?? new Date()
  const ttlMs = options.ttlMs ?? 3_600_000
  if (!Number.isFinite(now.getTime()) || !Number.isSafeInteger(ttlMs) || ttlMs < 0) throw new Error('Invalid cache clock or TTL')
  const previous = options.cache?.get(url)
  const age = previous ? now.getTime() - Date.parse(previous.fetchedAt) : NaN
  const parse = async (response: FeedCacheEntry) => {
    validate(response)
    if (response.url !== url) throw new Error('Cache response URL mismatch')
    const parsed = await parser(response)
    return { ...parsed, url, fetchedAt: response.fetchedAt, sourceTimestamp: parsed.sourceTimestamp ?? response.sourceTimestamp }
  }
  try {
    if (previous && age >= 0 && age < ttlMs) return { ...await parse(previous), cacheStatus: 'cached' }
    const response = await http(url)
    const result = await parse(response)
    options.cache?.set(url, { ...response, sourceTimestamp: result.sourceTimestamp })
    return { ...result, cacheStatus: 'ok' }
  } catch (cause) {
    const cacheError = `${url}: ${cause instanceof Error ? cause.message : String(cause)}`
    if (previous) {
      try { return { ...await parse(previous), cacheStatus: 'stale', cacheError } }
      catch { throw new Error(`${cacheError}; 上次缓存也不可解析，未使用。`, { cause }) }
    }
    throw new Error(cacheError, { cause })
  }
}
