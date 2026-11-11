import { constants } from 'node:fs'
import { lstat, mkdtemp, open, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { publicSourceUrl } from './http.js'
import type { FeedCache, FeedCacheEntry } from './feeds.js'

const filename = '.apache-radar-feed-cache.json'
async function target(directory: string): Promise<string> {
  if (!directory || directory.split(/[\\/]/).includes('..')) throw new Error('Cache directory traversal rejected')
  const root = resolve(directory)
  if (await realpath(root) !== root || !(await lstat(root)).isDirectory()) throw new Error('Cache directory symlink or invalid directory rejected')
  const path = join(root, filename)
  try {
    if (!(await lstat(path)).isFile()) throw new Error('Cache target symlink or non-file rejected')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  return path
}
function validate(value: unknown): FeedCacheEntry {
  if (!value || typeof value !== 'object') throw new Error('Invalid feed cache entry')
  const entry = value as Partial<FeedCacheEntry>
  if (typeof entry.url !== 'string' || publicSourceUrl(entry.url) !== entry.url
    || typeof entry.payload !== 'string' || typeof entry.fetchedAt !== 'string' || !Number.isFinite(Date.parse(entry.fetchedAt))
    || (entry.sourceTimestamp !== undefined && typeof entry.sourceTimestamp !== 'string')) throw new Error('Invalid feed cache metadata')
  return { url: entry.url, fetchedAt: entry.fetchedAt, payload: entry.payload, sourceTimestamp: entry.sourceTimestamp }
}

export async function loadFeedCache(directory: string): Promise<FeedCache> {
  const path = await target(directory)
  let file
  try { file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Map()
    throw error
  }
  try {
    const raw: unknown = JSON.parse(await file.readFile('utf8'))
    if (!Array.isArray(raw)) throw new Error('Invalid feed cache document')
    const result: FeedCache = new Map()
    for (const value of raw) {
      const entry = validate(value)
      if (result.has(entry.url)) throw new Error('Duplicate feed cache URL')
      result.set(entry.url, entry)
    }
    return result
  } finally { await file.close() }
}

export async function saveFeedCache(directory: string, cache: FeedCache): Promise<void> {
  const entries = [...cache.entries()].map(([url, value]) => {
    const entry = validate(value)
    if (url !== entry.url) throw new Error('Feed cache URL mismatch')
    return entry
  })
  const path = await target(directory)
  const temporary = await mkdtemp(join(resolve(directory), '.apache-radar-cache-'))
  try {
    const staged = join(temporary, 'cache.json')
    await writeFile(staged, JSON.stringify(entries), { flag: 'wx', mode: 0o600 })
    await target(directory)
    await rename(staged, path)
  } finally { await rm(temporary, { recursive: true, force: true }) }
}
