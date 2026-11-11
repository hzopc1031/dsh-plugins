import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { apply, HELP } from '../index.js'
import { renderCommandResult } from '../lib/command.js'
import { message } from '../lib/messages.js'
import { runRadar } from '../lib/radar.js'
import { loadFeedCache, saveFeedCache } from '../lib/feed-cache.js'
import { singaporeTime } from '../lib/counts.js'
import { SOURCES } from '../lib/fetchers.js'
import { FETCHED_AT, pluginContext, radarFixtureHttp } from './helpers.mjs'

async function withCommand(fn) {
  const directory = await mkdtemp(join(tmpdir(), 'radar-command-'))
  const host = pluginContext()
  const agent = { session: { header: { cwd: directory } } }
  try {
    apply(host.ctx)
    const invoke = rawInput => host.command.handler({ rawInput, agent })
    await fn({ directory, host, agent, invoke })
  } finally { host.dispose(); await rm(directory, { recursive: true, force: true }) }
}

test('locale catalogs cover the same nonempty messages and placeholders, and Chinese command copy comes from them', async () => {
  const read = lang => readFile(new URL(`../locale/${lang}.json`, import.meta.url), 'utf8').then(JSON.parse)
  const [zh, en] = await Promise.all([read('zh'), read('en')])
  assert.deepEqual(Object.keys(zh.messages).sort(), Object.keys(en.messages).sort())
  for (const [key, value] of Object.entries(zh.messages)) {
    assert.equal(typeof value, 'string')
    assert.ok(value.trim() && en.messages[key].trim(), key)
    const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort()
    assert.deepEqual(placeholders(value), placeholders(en.messages[key]), key)
  }
  assert.equal(HELP, zh.messages['command.help'])
  assert.doesNotMatch(zh.meta.description + en.meta.description, /脚手架|尚未接通|scaffold/i)
  assert.equal(message('command.watchList', { projects: '{literal}' }), '关注项目：{literal}')
  assert.throws(() => message('missing.key'), /Missing Apache Radar message/)
  assert.throws(() => message('command.watchList'), /Missing Apache Radar message value/)
})

test('slash grammar validates all subcommands before I/O and keeps watch get/add/remove readable and local', async () => withCommand(async ({ directory, invoke }) => {
  for (const rawInput of ['help extra', 'counts ../escape', 'brief extra', 'refresh /tmp', 'open x', 'watch add', 'watch remove kafka extra', 'watch get', 'watch add ../escape', 'lookup', 'unknown']) {
    const reply = await invoke(rawInput)
    assert.equal(reply.kind, 'error', rawInput)
    assert.match(reply.text, /用法|参数|项目 id|未知操作/, rawInput)
  }
  assert.equal((await invoke('help')).text, HELP)
  assert.match((await invoke('watch')).text, /kafka \/ hadoop \/ flink/)
  assert.match((await invoke('watch add Spark')).text, /kafka \/ hadoop \/ flink \/ spark/)
  assert.match((await invoke('watch remove kafka')).text, /关注项目：hadoop \/ flink \/ spark/)
  assert.deepEqual(JSON.parse(await readFile(join(directory, '.apache-radar-state.json'), 'utf8')).watchList, ['hadoop', 'flink', 'spark'])
  assert.match((await invoke('lookup KIP')).text, /尚无已采集动态/)
  assert.match((await invoke('open')).text, /尚无本地周报/)
}))

test('real command handlers consume cached recorded data for counts/refresh/brief/open/lookup; tools remain compact JSON', async () => withCommand(async ({ directory, host, agent, invoke }) => {
  // The fixture payloads are historical; only the injected cache clock is current for the host handler.
  const now = new Date()
  await runRadar(directory, 'refresh', {}, { now: () => now, http: radarFixtureHttp({ at: now.toISOString() }) })
  const counts = await invoke('counts')
  assert.equal(counts.kind, 'success')
  for (const phrase of ['## Apache 官方数量口径', '当前列示', 'TLP +', '退休委员会（Whimsy）', 'Attic PMC 行', 'Attic 子项目行', 'flume', '名单有差异', '官方领域分类（多标签）', SOURCES.chooser, singaporeTime(now.toISOString())]) assert.ok(counts.text.includes(phrase), phrase)
  assert.doesNotMatch(counts.text, /"counts"|"members"|\[object Object\]/)
  for (const action of ['refresh', 'brief']) {
    const result = await invoke(action)
    assert.equal(result.kind, 'success', result.text)
    for (const phrase of ['滚动最近 7 天', 'Asia/Singapore', '动态来源状态', 'JIRA 工单：失败', 'Hadoop 没有已验证的通用 HIP']) assert.ok(result.text.includes(phrase), phrase)
    if (action === 'brief') assert.ok(result.text.includes(join(directory, '.apache-radar-brief.md')))
    const tool = JSON.parse(await host.tools.get(`apache_radar_${action}`).execute({}, { agent }))
    assert.equal(tool.markdown, undefined)
    assert.equal(tool.items, undefined)
    assert.ok(tool.counts.categories.rows.every(row => row.members === undefined))
    assert.doesNotMatch(JSON.stringify(tool), /"body"|"description"|"payload"|KIP-1357/)
    assert.equal(tool.counts.retired.length, 4)
    for (const row of [...tool.counts.counts, ...tool.counts.retired, ...tool.counts.categories.rows]) {
      assert.ok(row.sources.every(source => source.url && source.fetchedAt))
    }
  }
  const opened = await invoke('open')
  assert.equal(opened.kind, 'success')
  assert.equal(opened.text, await readFile(join(directory, '.apache-radar-brief.md'), 'utf8'))
  assert.match(opened.text, /^# Apache 社区周报/)
  const found = await invoke('lookup KIP-1356')
  assert.equal(found.kind, 'success')
  for (const phrase of ['KIP-1356', 'https://cwiki.apache.org/', '状态：', '日期未知项不是本周新增']) assert.ok(found.text.includes(phrase), phrase)
  const missing = await invoke('lookup no-such-recorded-item')
  assert.match(missing.text, /未匹配到已采集条目；这不表示没有更新/)
  const many = await invoke('lookup KIP')
  assert.match(many.text, /仅展示前二十项/)
}))

test('command rendering is deterministic on fixtures and displays source failures and last-good times in Chinese', async () => withCommand(async ({ directory, invoke }) => {
  const serialized = await runRadar(directory, 'counts', {}, { now: () => new Date(FETCHED_AT), http: radarFixtureHttp() })
  assert.equal(renderCommandResult('counts', serialized), renderCommandResult('counts', serialized))
  // Force expiry independently of the machine date; the test transport rejects every live fetch.
  const cache = await loadFeedCache(directory)
  for (const entry of cache.values()) entry.fetchedAt = '2000-01-01T00:00:00.000Z'
  await saveFeedCache(directory, cache)
  const stale = await invoke('counts')
  assert.equal(stale.kind, 'success')
  for (const phrase of ['刷新失败', '沿用上次成功缓存', '来源请求或数据解析失败', SOURCES.chooser, '2000-01-01 08:00:00']) assert.ok(stale.text.includes(phrase), phrase)
  await rm(join(directory, '.apache-radar-feed-cache.json'))
  const failed = await invoke('counts')
  assert.match(failed.text, /错误：来源请求或数据解析失败/)
  assert.ok(failed.text.includes(SOURCES.chooser))
  assert.match(failed.text, /无成功抓取时间/)
  assert.doesNotMatch(failed.text, /\| 0 \|/)
}))

test('command path/state failures name local data and reject parent, ancestor and target symlink escapes without writes', async () => withCommand(async ({ directory, agent, invoke }) => {
  const outside = await mkdtemp(join(tmpdir(), 'radar-outside-'))
  try {
    const target = join(outside, 'protected.json')
    await writeFile(target, '{"watchList":[]}')
    const state = join(directory, '.apache-radar-state.json')
    await symlink(target, state)
    const rejected = await invoke('watch add spark')
    assert.equal(rejected.kind, 'error')
    assert.ok(rejected.text.includes(directory))
    assert.match(rejected.text, /本地目录、状态、缓存或周报操作失败.*符号链接/)
    assert.equal(await readFile(target, 'utf8'), '{"watchList":[]}')
    await rm(state)
    await writeFile(state, '{')
    assert.equal((await invoke('watch')).kind, 'error')
    assert.equal(await readFile(state, 'utf8'), '{')
    await rm(state)
    for (const filename of ['.apache-radar-feed-cache.json', '.apache-radar-brief.md']) {
      await symlink(target, join(directory, filename))
      assert.equal((await invoke(filename.endsWith('.md') ? 'open' : 'brief')).kind, 'error')
      assert.equal(await readFile(target, 'utf8'), '{"watchList":[]}')
      await rm(join(directory, filename))
    }
    const alias = join(directory, 'alias')
    await symlink(outside, alias)
    for (const cwd of [directory + '/missing/..', alias, join(alias, 'child')]) {
      agent.session.header.cwd = cwd
      const result = await invoke('watch add spark')
      assert.equal(result.kind, 'error')
      assert.match(result.text, /本地|路径逃逸|符号链接/)
    }
    assert.equal(await readFile(target, 'utf8'), '{"watchList":[]}')
  } finally { await rm(outside, { recursive: true, force: true }) }
}))
