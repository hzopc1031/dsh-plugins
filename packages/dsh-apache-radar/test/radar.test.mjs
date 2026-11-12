import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { runRadar, itemSummary } from '../lib/radar.js'
import { loadFeedCache } from '../lib/feed-cache.js'
import { apply } from '../index.js'
import { radarFixtureHttp, FETCHED_AT, pluginContext } from './helpers.mjs'

const options = { http: radarFixtureHttp(), now: () => new Date(FETCHED_AT) }
async function inDirectory(fn) {
  const directory = await mkdtemp(join(tmpdir(), 'radar-run-'))
  try { return await fn(directory) } finally { await rm(directory, { recursive: true, force: true }) }
}

test('refresh and brief work on recorded responses without a model, persist cache, and return summary payloads', async () => inDirectory(async directory => {
  const fresh = JSON.parse(await runRadar(directory, 'refresh', {}, options))
  assert.deepEqual(fresh.watchList, ['kafka', 'hadoop', 'flink'])
  assert.equal(fresh.window.mode, 'rolling')
  assert.equal(fresh.window.days, 7)
  assert.equal(fresh.window.timezone, 'Asia/Singapore')
  assert.ok(fresh.sources.some(s => s.status === 'failed'))
  assert.equal(fresh.items, undefined)
  assert.equal(fresh.undatedItems, undefined)
  assert.ok(fresh.counts.categories.rows.every(row => row.members === undefined))
  assert.ok(fresh.counts.comparisons.some(c => c.onlyLeft?.some(m => m.id === 'flume')))
  const cache = await loadFeedCache(directory)
  assert.ok(cache.size > 0)
  for (const [url, entry] of cache) {
    assert.equal(url, entry.url)
    assert.equal(entry.fetchedAt, FETCHED_AT)
    assert.equal(typeof entry.payload, 'string')
  }
  const result = JSON.parse(await runRadar(directory, 'brief', {}, { ...options, http: async () => { throw new Error('injected offline') } }))
  const text = await readFile(result.path, 'utf8')
  assert.match(text, /^# Apache 社区周报/)
  assert.ok(result.path.startsWith(directory + '/'))
  assert.equal(result.markdown, undefined)
  assert.doesNotMatch(JSON.stringify(result), /"body"|"description"|KIP-1357/)
  const opened = JSON.parse(await runRadar(directory, 'open'))
  assert.deepEqual(opened, { path: result.path })
  const full = JSON.parse(await runRadar(directory, 'open', { includeMarkdown: true }))
  assert.equal(full.markdown, text)
}))

test('lookup uses only collected linked items, supports versions, caps summaries and preserves source statuses after restart', async () => inDirectory(async directory => {
  await assert.rejects(runRadar(directory, 'lookup', { query: 'KIP' }, options), /尚无已采集/)
  await runRadar(directory, 'refresh', {}, options)
  let calls = 0
  const offline = { ...options, http: async () => { calls++; throw new Error('Lookup must never fetch') } }
  const found = JSON.parse(await runRadar(directory, 'lookup', { query: 'KIP', project: 'kafka' }, offline))
  assert.equal(calls, 0)
  assert.equal(found.hasMore, true)
  assert.equal(found.items.length, 20)
  assert.ok(found.items.every(i => ['jira', 'proposal'].includes(i.kind) && i.project === 'kafka' && i.url && i.status && i.sourceUrl))
  assert.ok(found.sources.some(s => s.project === 'hadoop' && s.kind === 'jira' && s.status === 'failed'))
  assert.equal(found.collectedAt, FETCHED_AT)
  assert.ok(found.items.every(i => i.date === undefined))
  const versions = JSON.parse(await runRadar(directory, 'lookup', { query: '4.4.0', project: 'kafka' }, offline))
  assert.ok(versions.items.some(i => i.status === 'accepted'))
  assert.match(versions.note, /不作兼容性或生产升级判断/)
  const empty = JSON.parse(await runRadar(directory, 'lookup', { query: 'is it safe to upgrade to production?' }, offline))
  assert.deepEqual(empty.items, [])
  assert.match(empty.note, /未匹配不表示没有更新/)
  const expired = JSON.parse(await runRadar(directory, 'lookup', { query: 'KIP' }, { ...offline, now: () => new Date('2026-11-12T03:00:00Z') }))
  assert.ok(expired.sources.some(s => s.status === 'stale' && s.fetchedAt === FETCHED_AT && /已过期/.test(s.error)))
  assert.equal(calls, 0)
  await assert.rejects(runRadar(directory, 'lookup', { query: '' }, offline), /关键词/)
  await assert.rejects(runRadar(directory, 'lookup', { query: 'KIP', project: 'spark' }, offline), /不在关注列表/)
  const projected = itemSummary({ ...found.items[0], title: 'known title', body: 'secret body', description: 'full issue', custom: 'future raw field' })
  assert.equal(projected.body, undefined)
  assert.equal(projected.description, undefined)
  assert.equal(projected.custom, undefined)
  assert.equal(projected.security, false)
  assert.equal(itemSummary({ ...projected, title: 'CVE-2026-00000 security test notice' }).security, true)
}))

test('watch-list state is local and configurable, mutations survive calls and invalidate old collection context', async () => inDirectory(async directory => {
  const invoke = async (action, args = {}, opts = options) => JSON.parse(await runRadar(directory, action, args, opts))
  assert.deepEqual((await invoke('watch')).watchList, ['kafka', 'hadoop', 'flink'])
  await invoke('refresh')
  assert.deepEqual((await invoke('watch', {}, { ...options, watchList: ['flink'] })).watchList, ['flink'])
  await assert.rejects(invoke('watch', { operation: 'invent' }), /operation/)
  assert.deepEqual((await invoke('watch', { operation: 'add', project: 'spark' })).watchList, ['kafka', 'hadoop', 'flink', 'spark'])
  assert.deepEqual((await invoke('watch', { operation: 'remove', project: 'hadoop' })).watchList, ['kafka', 'flink', 'spark'])
  assert.deepEqual((await invoke('watch', {}, { ...options, watchList: [] })).watchList, ['kafka', 'flink', 'spark'])
  await assert.rejects(invoke('watch', { operation: 'add', project: '../escape' }), /project id/)
  await invoke('refresh')
  await invoke('watch', { operation: 'remove', project: 'kafka' })
  await assert.rejects(invoke('lookup', { query: 'KIP' }), /尚无已采集/)
}))

test('registered tool lookup/open use persisted recorded data and default to summaries; slash open yields copyable Markdown', async () => inDirectory(async directory => {
  await runRadar(directory, 'brief', {}, options)
  const agent = { session: { header: { cwd: directory } } }
  const host = pluginContext()
  try {
    apply(host.ctx)
    const opened = JSON.parse(await host.tools.get('apache_radar_open').execute({}, { agent }))
    assert.equal(opened.markdown, undefined)
    const full = JSON.parse(await host.tools.get('apache_radar_open').execute({ includeMarkdown: true }, { agent }))
    assert.equal(full.markdown, await readFile(opened.path, 'utf8'))
    const response = await host.command.handler({ rawInput: 'open', agent })
    assert.equal(response.kind, 'success')
    assert.equal(response.text, full.markdown)
    const found = JSON.parse(await host.tools.get('apache_radar_lookup').execute({ query: 'KIP-1356' }, { agent }))
    assert.ok(found.items.some(i => i.title.startsWith('KIP-1356')))
    assert.doesNotMatch(JSON.stringify(found), /"description"|"body"/)
    assert.ok(found.items.every(i => i.url))
  } finally { host.dispose() }
}))

test('state trust boundary fails explicitly on malformed documents and rejects a symlink before changing its target', async () => inDirectory(async directory => {
  const stateFile = join(directory, '.apache-radar-state.json')
  for (const value of ['{', 'null', '[]', '{"watchList":"kafka"}', '{"collectedAt":"yesterday"}']) {
    await writeFile(stateFile, value)
    await assert.rejects(runRadar(directory, 'watch', {}, options))
  }
  await rm(stateFile)
  const outside = join(directory, 'outside.json')
  await writeFile(outside, '{"watchList":[]}')
  await symlink(outside, stateFile)
  await assert.rejects(runRadar(directory, 'watch', { operation: 'add', project: 'kafka' }, options), /symlink/)
  assert.equal(await readFile(outside, 'utf8'), '{"watchList":[]}')
}))

test('imported snapshot powers the offline dashboard and explicit refresh never calls live HTTP', async () => inDirectory(async source => inDirectory(async target => {
  await runRadar(source, 'refresh', {}, options)
  const snapshot = await runRadar(source, 'export')
  let calls = 0
  const offline = { ...options, offlineOnly: true, http: async () => { calls++; assert.fail('offline transport reached') } }
  const imported = JSON.parse(await runRadar(target, 'import', { snapshot }, offline))
  assert.equal(imported.localSnapshot, true)
  assert.equal(imported.counts.counts[0].status, 'ok')
  assert.ok(imported.items.length + imported.undatedItems.length > 0)
  const refreshed = JSON.parse(await runRadar(target, 'dashboard', { refresh: true }, offline))
  assert.equal(refreshed.localSnapshot, true)
  assert.equal(refreshed.counts.counts[0].status, 'ok')
  assert.equal(calls, 0)
})))


test('offline commands with no cache give a Chinese recovery message', async () => inDirectory(async directory => {
  await assert.rejects(runRadar(directory, 'refresh', {}, { offlineOnly: true, http: async () => assert.fail('offline') }), /没有可用缓存.*导入.*快照/)
}))
