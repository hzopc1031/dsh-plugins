import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, symlink, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadFeedCache, saveFeedCache } from '../lib/feed-cache.js'
import { collectWatchFeeds } from '../lib/feeds.js'
import { SOURCES } from '../lib/fetchers.js'
import { fixture, FETCHED_AT } from './helpers.mjs'

const filename = '.apache-radar-feed-cache.json'

test('local cache persists URL/time/payload/source timestamp and reloads last good data after a failed refresh', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'apache-radar-'))
  try {
    const cache = await loadFeedCache(directory)
    const original = { url: SOURCES.releases, fetchedAt: FETCHED_AT, payload: await fixture('releases.json'), sourceTimestamp: 'recorded source timestamp' }
    cache.set(SOURCES.releases, original)
    await saveFeedCache(directory, cache)
    assert.deepEqual(await loadFeedCache(directory), cache)
    const disk = JSON.parse(await readFile(join(directory, filename), 'utf8'))
    assert.deepEqual(disk, [original])
    const reloaded = await loadFeedCache(directory)
    const report = await collectWatchFeeds(async () => { throw new Error('Injected timeout') }, {
      cache: reloaded, now: new Date('2026-11-11T05:00:00Z'), watchList: ['hadoop'], ttlMs: 1,
    })
    assert.equal(report.sources[0].status, 'stale')
    assert.equal(report.sources[0].fetchedAt, FETCHED_AT)
    assert.match(report.sources[0].error, /timeout/)
    await saveFeedCache(directory, reloaded)
    assert.deepEqual(await loadFeedCache(directory), cache)
    await assert.rejects(saveFeedCache(directory, new Map([[SOURCES.releases, { ...original, url: 'https://reporter.apache.org/' }]])), /forbidden/)
    assert.deepEqual(await loadFeedCache(directory), cache)
    await writeFile(join(directory, filename), '{')
    await assert.rejects(loadFeedCache(directory), /JSON/)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('cache rejects parent traversal and symlink escapes on reads/writes without modifying outside files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'apache-radar-path-'))
  const inside = join(directory, 'inside')
  const outside = join(directory, 'outside.json')
  await mkdir(inside)
  await writeFile(outside, 'outside sentinel')
  try {
    const aliases = join(directory, 'alias')
    await symlink(inside, aliases)
    for (const bad of [join(inside, 'missing') + '/..', aliases, directory + '/inside/../inside']) {
      await assert.rejects(loadFeedCache(bad), /traversal|symlink/)
      await assert.rejects(saveFeedCache(bad, new Map()), /traversal|symlink/)
    }
    await symlink(outside, join(inside, filename))
    await assert.rejects(loadFeedCache(inside), /symlink/)
    await assert.rejects(saveFeedCache(inside, new Map()), /symlink/)
    assert.equal(await readFile(outside, 'utf8'), 'outside sentinel')
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('malformed cache entries are explicit failures, never empty successful caches', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'apache-radar-invalid-'))
  try {
    for (const value of [{}, [null], [{ url: SOURCES.releases, fetchedAt: 'invalid', payload: '{}' }],
      [{ url: 'https://untrusted.invalid/', fetchedAt: FETCHED_AT, payload: '{}' }]]) {
      await writeFile(join(directory, filename), JSON.stringify(value))
      await assert.rejects(loadFeedCache(directory))
    }
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('counts share persistent TTL caching with feeds; expiry refetches and malformed/failed refresh preserves the last good payload', async () => {
  const { fetchCountsReport, renderCountsMarkdown } = await import('../lib/counts.js')
  const { radarFixtureHttp } = await import('./helpers.mjs')
  const directory = await mkdtemp(join(tmpdir(), 'apache-radar-count-cache-'))
  try {
    const cache = new Map()
    const requests = []
    await fetchCountsReport(radarFixtureHttp({ requests }), { cache, now: new Date(FETCHED_AT) })
    assert.equal(requests.length, 7)
    await saveFeedCache(directory, cache)
    const disk = await loadFeedCache(directory)
    const before = structuredClone(disk.get(SOURCES.chooser))
    assert.ok(before.sourceTimestamp)
    const cached = await fetchCountsReport(async () => { throw new Error('No HTTP inside TTL') }, { cache: disk, now: new Date(FETCHED_AT) })
    assert.ok(cached.counts.every(row => row.sources[0].cacheStatus === 'cached'))
    const later = new Date('2026-11-11T05:00:00Z')
    for (const failure of ['timeout', 'malformed']) {
      const calls = []
      const fresh = radarFixtureHttp({ requests: calls, at: later.toISOString() })
      const report = await fetchCountsReport(async url => {
        if (url !== SOURCES.chooser) return fresh(url)
        calls.push(url)
        if (failure === 'timeout') throw new Error('Injected timeout')
        return { url, fetchedAt: later.toISOString(), payload: '{' }
      }, { cache: disk, now: later, ttlMs: 1000 })
      assert.ok(calls.includes(SOURCES.chooser))
      const source = report.counts[0].sources[0]
      assert.equal(source.cacheStatus, 'stale')
      assert.equal(source.fetchedAt, FETCHED_AT)
      assert.match(source.cacheError, /timeout|Invalid source payload/)
      assert.deepEqual(disk.get(SOURCES.chooser), before)
      assert.match(renderCountsMarkdown(report), /刷新失败/)
    }
    await saveFeedCache(directory, disk)
    assert.deepEqual((await loadFeedCache(directory)).get(SOURCES.chooser), before)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
