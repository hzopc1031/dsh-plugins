import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fetchCountsReport, singaporeTime } from '../lib/counts.js'
import { collectWatchFeeds, parseProposals } from '../lib/feeds.js'
import { renderWeeklyBrief, writeWeeklyBrief } from '../lib/brief.js'
import { SOURCES } from '../lib/fetchers.js'
import { fixture, radarFixtureHttp, FETCHED_AT } from './helpers.mjs'

const now = new Date(FETCHED_AT)
async function reports(options = {}) {
  const http = radarFixtureHttp()
  return { counts: await fetchCountsReport(http, { now }), feeds: await collectWatchFeeds(http, { now, ...options }) }
}

test('Chinese Markdown brief is deterministic, copyable, and reuses cited counts, parallel retired scopes and multi-label categories', async () => {
  const { counts, feeds } = await reports()
  const before = structuredClone({ counts, feeds })
  const text = renderWeeklyBrief(counts, feeds)
  assert.equal(text, renderWeeklyBrief(counts, feeds, FETCHED_AT))
  assert.equal(text, renderWeeklyBrief((await reports()).counts, (await reports()).feeds))
  assert.deepEqual({ counts, feeds }, before)
  for (const phrase of ['# Apache 社区周报', '生成时间：2026-11-11 11:00:00', 'Asia/Singapore', '滚动最近 7 天', '不是单一官方总数', '无需模型', '官方领域分类（多标签）', '退休委员会（Whimsy）', '退休委员会（projects.apache.org）', 'Attic PMC 行', 'Attic 子项目行', '名单有差异', 'flume', '### kafka', '### hadoop', '### flink', 'Hadoop 没有已验证的通用 HIP', 'New Feature / fixVersion']) assert.ok(text.includes(phrase), phrase)
  for (const row of [...counts.counts, ...counts.retired, ...counts.categories.rows]) {
    assert.ok(text.includes(`| ${row.value} |`))
    for (const source of row.sources) {
      assert.ok(text.includes(source.url))
      assert.ok(text.includes(singaporeTime(source.fetchedAt)))
      if (source.sourceTimestamp) assert.ok(text.includes(source.sourceTimestamp))
    }
  }
  for (const item of [...feeds.items, ...feeds.undatedItems]) {
    assert.ok(text.includes(item.url.replace(/[()<>]/g, c => '%' + c.charCodeAt(0).toString(16))))
  }
  assert.ok(text.includes('日期未知参考项（不计作本周新增）'))
  assert.match(text, /hadoop \/ JIRA 工单：失败/)
  assert.match(text, /flink \/ JIRA 工单：失败/)
  assert.doesNotMatch(text, /0 更新|安全升级|性能提升/)
})

test('release version, date, source and notes links remain in their stated rolling seven-day window', async () => {
  const { counts, feeds } = await reports({ now: new Date('2026-10-21T00:00:00+08:00'), watchList: ['kafka'] })
  const text = renderWeeklyBrief(counts, feeds)
  const releases = feeds.items.filter(i => i.kind === 'release')
  assert.ok(releases.length > 0)
  assert.match(text, /滚动最近 7 天/)
  for (const release of releases) {
    assert.ok(text.includes(release.version))
    assert.ok(text.includes(release.date))
    if (release.notesUrl) assert.ok(text.includes(release.notesUrl))
  }
  const weekly = text.slice(text.indexOf('## 关注项目动态'), text.indexOf('#### 日期未知参考项'))
  assert.ok(!weekly.includes('Kafka-4.3.1'))
})

test('proposal status and recorded implementation limits survive verbatim; injected security and limiting phrases remain labelled', async () => {
  const { counts, feeds } = await reports({ watchList: ['kafka', 'flink'] })
  const proposal = parseProposals(await fixture('kip-index.html'), 'kafka').data.find(i => /partially implemented/.test(i.statusText))
  assert.ok(proposal)
  // Explicit synthetic wording exercises rendering, not assertions about actual release/security history.
  const limited = { ...proposal, title: 'Preview; default-off; component-limited; breaking-change', statusText: proposal.statusText + '; Preview; default-off; component-limited; breaking-change' }
  const jira = { project: 'kafka', kind: 'jira', title: 'CVE-2026-00000 security test notice', url: 'https://issues.apache.org/jira/browse/KAFKA-1', sourceUrl: 'https://issues.apache.org/jira/', status: 'Open', date: '2026-11-10', issueType: 'New Feature', fixVersions: ['test-version'] }
  const text = renderWeeklyBrief(counts, { ...feeds, items: [jira], undatedItems: [...feeds.undatedItems, limited] })
  assert.match(text, /\*\*安全 \/ JIRA 工单\*\*/)
  assert.match(text, /目标 fixVersion：test-version（不代表已发布）/)
  for (const phrase of ['Preview', 'default-off', 'component-limited', 'breaking-change', 'partially implemented', '状态：discussion', '状态：accepted', '状态：implemented', '状态：released']) assert.ok(text.includes(phrase), phrase)
  assert.doesNotMatch(text, /已接受.*已发布特性/)
})

test('failed count/feed refresh renders last-good times plus errors rather than an empty week', async () => {
  const cache = new Map()
  const http = radarFixtureHttp()
  await fetchCountsReport(http, { cache, now })
  await collectWatchFeeds(http, { cache, now })
  const later = new Date('2026-11-11T05:00:00Z')
  const failure = async () => { throw new Error('Injected timeout') }
  const counts = await fetchCountsReport(failure, { cache, now: later })
  const feeds = await collectWatchFeeds(failure, { cache, now: later })
  const text = renderWeeklyBrief(counts, feeds)
  assert.match(text, /刷新失败.*沿用上次成功缓存/)
  assert.match(text, /Injected timeout/)
  assert.ok(text.includes(singaporeTime(FETCHED_AT)))
  assert.ok(feeds.undatedItems.length > 0)
  for (const row of counts.counts) {
    assert.equal(row.status, 'ok')
    assert.equal(row.sources[0].cacheStatus, 'stale')
    assert.equal(row.sources[0].fetchedAt, FETCHED_AT)
  }
  const noCache = await fetchCountsReport(failure, { now })
  const empty = await collectWatchFeeds(failure, { now })
  const failedText = renderWeeklyBrief(noCache, empty)
  assert.ok(noCache.counts.every(row => row.status === 'error' && !('value' in row)))
  assert.match(failedText, /无成功抓取时间/)
  assert.doesNotMatch(failedText, /本周更新：0|窗口内条目：0/)
})

test('brief write is confined, rejects parent/ancestor/target symlinks and does not overwrite outside files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'radar-brief-'))
  const inside = join(root, 'inside')
  await mkdir(inside)
  const { counts, feeds } = await reports({ watchList: [] })
  try {
    const path = await writeWeeklyBrief(inside, counts, feeds)
    assert.equal(path, join(inside, '.apache-radar-brief.md'))
    assert.equal(await readFile(path, 'utf8'), renderWeeklyBrief(counts, feeds))
    const outside = join(root, 'outside.md')
    await writeFile(outside, 'outside sentinel')
    await rm(path)
    await symlink(outside, path)
    await assert.rejects(writeWeeklyBrief(inside, counts, feeds), /symlink/)
    const alias = join(root, 'alias')
    await symlink(inside, alias)
    for (const directory of [alias, alias + '/child', inside + '/../inside']) {
      await assert.rejects(writeWeeklyBrief(directory, counts, feeds))
    }
    assert.equal(await readFile(outside, 'utf8'), 'outside sentinel')
  } finally { await rm(root, { recursive: true, force: true }) }
})
