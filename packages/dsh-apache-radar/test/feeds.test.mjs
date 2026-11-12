import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { collectWatchFeeds, jiraSearchUrl, KAFKA_DOWNLOADS, parseJira, parseKafkaNotes, parseProposals, PROPOSAL_SOURCES, rollingWindow } from '../lib/feeds.js'
import { SOURCES } from '../lib/fetchers.js'
import { createHttpClient } from '../lib/http.js'
import { DEFAULT_WATCH_LIST, resolveWatchList } from '../lib/watch.js'
import { apply, Config } from '../index.js'
import { fixture, FETCHED_AT } from './helpers.mjs'

const provenance = JSON.parse(await fixture('feed-provenance.json'))
const now = new Date(FETCHED_AT)
const files = new Map([[SOURCES.releases, 'releases.json'], [KAFKA_DOWNLOADS, 'kafka-downloads.html'],
  [PROPOSAL_SOURCES.kafka, 'kip-index.html'], [PROPOSAL_SOURCES.flink, 'flip-index.html']])
function replay({ requests = [], fail = () => false, at = FETCHED_AT } = {}) {
  return createHttpClient({ now: () => new Date(at), fetch: async url => {
    requests.push(url)
    if (fail(url)) return new Response('injected failure', { status: 503 })
    if (files.has(url)) return new Response(await fixture(files.get(url)))
    const query = new URL(url)
    // Protocol replay of the recorded historical Kafka query, not a recording of this rolling query.
    if (query.pathname.endsWith('/search') && query.searchParams.get('jql').startsWith('project in (KAFKA)')) {
      return new Response(await fixture('jira-kafka-newfeature.json'))
    }
    throw new Error('No recorded anonymous search fixture for this project')
  } })
}
const options = { now }

test('watch list defaults, config replacement adds/removes/reorders, and validation rejects malformed ids', () => {
  assert.deepEqual(DEFAULT_WATCH_LIST, ['kafka', 'hadoop', 'flink'])
  const defaults = resolveWatchList()
  defaults.pop()
  assert.deepEqual(resolveWatchList(), ['kafka', 'hadoop', 'flink'])
  assert.deepEqual(Config({}).watchList, resolveWatchList())
  for (const watchList of [['flink', 'kafka'], ['hadoop', 'spark', 'flink', 'kafka'], []]) {
    assert.deepEqual(resolveWatchList(Config({ watchList }).watchList), watchList)
  }
  assert.deepEqual(resolveWatchList([' Kafka ', 'FLINK']), ['kafka', 'flink'])
  for (const bad of [null, 'kafka', ['../kafka'], ['kafka', 'KAFKA'], [''], [2], ['kafka AND project=ALL']]) {
    assert.throws(() => resolveWatchList(bad), /watch|project/i)
  }
  assert.throws(() => apply({}, { watchList: ['../escape'] }), /project id/)
})

test('new recorded fixtures retain original URLs, completion times, hashes and explicit transformations', async () => {
  for (const source of provenance.sources) {
    assert.ok(Date.parse(source.fetchedAt))
    assert.match(source.originalSha256, /^[a-f0-9]{64}$/)
    const payload = await fixture(source.file)
    assert.equal(createHash('sha256').update(payload).digest('hex'), source.fixtureSha256)
    assert.match(source.transformation, /Keep recorded/)
    assert.ok(source.url.startsWith('https://'))
    assert.doesNotMatch(payload, /atlassian-token|ajs-remote-user|<script/)
  }
})

test('rolling seven-day window is explicit Asia/Singapore, deterministic and validates its bounds', () => {
  const window = rollingWindow(now)
  assert.equal(window.start, '2026-11-04T03:00:00.000Z')
  assert.equal(window.end, FETCHED_AT)
  assert.equal(window.timezone, 'Asia/Singapore')
  assert.equal(window.mode, 'rolling')
  assert.match(window.label, /滚动最近 7 天.*UTC\+8.*日期未知/)
  assert.equal(Date.parse(window.end) - Date.parse(window.start), 7 * 86_400_000)
  for (const days of [0, -1, 1.5, Infinity]) assert.throws(() => rollingWindow(now, days), /Invalid/)
  assert.throws(() => rollingWindow(new Date(NaN)), /Invalid/)
})

test('catalogued releases preserve versions, dates and notes links only when recorded, outside-window releases excluded', async () => {
  const end = new Date('2026-10-21T00:00:00+08:00')
  const report = await collectWatchFeeds(replay(), { now: end })
  const raw = JSON.parse(await fixture('releases.json'))
  const expected = Object.entries(raw.kafka).filter(([, day]) => {
    const t = Date.parse(day + 'T00:00:00+08:00')
    return t >= Date.parse(report.window.start) && t <= end.getTime()
  })
  const kafka = report.items.filter(i => i.project === 'kafka' && i.kind === 'release')
  assert.ok(kafka.length > 0)
  assert.deepEqual(kafka.map(i => [i.version, i.date]), expected)
  const release = kafka.find(i => i.version === 'Kafka-4.4.0')
  assert.equal(release.url, SOURCES.releases)
  assert.equal(release.date, '2026-10-15')
  assert.equal(release.notesStatus, 'found')
  assert.match(release.notesUrl, /\/kafka\/4\.4\.0\/RELEASE_NOTES\.html/)
  assert.ok(report.items.every(i => Date.parse(i.date + 'T00:00:00+08:00') >= Date.parse(report.window.start)))
  const noNotes = await collectWatchFeeds(replay(), { now: new Date('2026-11-04T00:00:00+08:00'), watchList: ['hadoop'] })
  assert.ok(noNotes.items.length > 0)
  assert.ok(noNotes.items.every(i => i.notesStatus === 'missing' && /未找到版本说明/.test(i.statusText)))
})

test('date-only release boundaries use stated Singapore midnight without admitting the next day', async () => {
  const end = new Date('2026-10-22T00:00:00+08:00')
  const report = await collectWatchFeeds(replay(), { now: end, watchList: ['kafka'] })
  assert.ok(report.items.some(i => i.version === 'Kafka-4.4.0'))
  const after = await collectWatchFeeds(replay(), { now: new Date(end.getTime() + 1), watchList: ['kafka'] })
  assert.ok(!after.items.some(i => i.version === 'Kafka-4.4.0'))
})

test('recorded JIRA keeps issue links/type/fixVersion and unknown dates; partial results are explicit', async () => {
  const source = provenance.sources.find(s => s.file === 'jira-kafka-newfeature.json')
  const result = parseJira(await fixture(source.file), 'kafka', source.url)
  const raw = JSON.parse(await fixture(source.file))
  assert.equal(result.data.length, raw.issues.length)
  for (const [index, item] of result.data.entries()) {
    assert.equal(item.kind, 'jira')
    assert.equal(item.title, raw.issues[index].fields.summary)
    assert.equal(item.status, raw.issues[index].fields.status.name)
    assert.equal(item.url, `https://issues.apache.org/jira/browse/${raw.issues[index].key}`)
    assert.equal(item.issueType, 'New Feature')
    assert.deepEqual(item.fixVersions, raw.issues[index].fields.fixVersions.map(v => v.name))
    assert.equal(item.date, undefined)
    assert.equal(item.description, undefined)
    assert.equal(item.body, undefined)
  }
  assert.match(result.warnings.join(' '), /不代表完整已发布.*部分结果.*缺少日期/)
  assert.throws(() => parseJira(JSON.stringify(raw), 'hadoop', source.url), /unwatched/)
})

test('JIRA queries are restricted to mapped watched projects; Hadoop includes its component trackers', () => {
  for (const [project, expected] of [['kafka', 'KAFKA'], ['hadoop', 'HADOOP,HDFS,MAPREDUCE,YARN'], ['flink', 'FLINK']]) {
    const url = new URL(jiraSearchUrl(project, rollingWindow(now)))
    assert.match(url.searchParams.get('jql'), new RegExp(`^project in \\(${expected}\\) AND updated`))
    assert.equal(url.searchParams.get('maxResults'), '100')
    assert.equal(url.searchParams.get('fields'), 'summary,issuetype,fixVersions,status,created,updated')
  }
  for (const project of ['ALL', 'spark', 'kafka OR project=ALL', 'toString']) {
    assert.throws(() => jiraSearchUrl(project, rollingWindow(now)), /unavailable/)
  }
})

test('KIP and FLIP retain section statuses, original links and limiting text without guessing dates or shipment', async () => {
  const kip = parseProposals(await fixture('kip-index.html'), 'kafka')
  const flip = parseProposals(await fixture('flip-index.html'), 'flink')
  for (const [result, project] of [[kip, 'kafka'], [flip, 'flink']]) {
    assert.ok(result.data.length > 0)
    for (const item of result.data) {
      assert.equal(item.kind, 'proposal')
      assert.equal(item.project, project)
      assert.match(item.url, /^https?:\/\/cwiki\.apache\.org\/confluence\//)
      assert.ok(item.title)
      assert.equal(item.date, undefined)
    }
    assert.ok(result.data.some(i => i.status === 'discussion'))
    assert.ok(result.data.some(i => i.status === 'accepted'))
    assert.match(result.warnings.join(' '), /不是本周新增/)
  }
  assert.ok(kip.data.some(i => i.status === 'implemented' && /partially implemented/.test(i.statusText)))
  assert.ok(kip.data.some(i => i.status === 'accepted' && /target 4\.4\.0/.test(i.statusText)))
  assert.ok(flip.data.some(i => i.status === 'released'))
  assert.ok(flip.data.some(i => i.status === 'accepted' && /2\.4\.0/.test(i.statusText)))
  assert.ok(!kip.data.some(i => i.status === 'released'))
})

test('collector preserves watch order and date-unknown references, never requests Hadoop HIP or unwatched trackers', async () => {
  const requests = []
  const report = await collectWatchFeeds(replay({ requests }), { ...options, watchList: ['flink', 'hadoop', 'kafka'] })
  assert.deepEqual(report.watchList, ['flink', 'hadoop', 'kafka'])
  assert.equal(report.sources.find(s => s.project === 'hadoop' && s.kind === 'proposal').status, 'unavailable')
  assert.match(report.sources.find(s => s.project === 'hadoop' && s.kind === 'proposal').warnings[0], /HIP.*404/)
  assert.ok(!requests.some(url => /HIP|Hadoop\+Improvement|github|reporter/.test(url)))
  assert.ok(report.undatedItems.some(i => i.kind === 'jira'))
  assert.ok(report.undatedItems.some(i => i.kind === 'proposal'))
  assert.ok(!report.items.some(i => i.kind === 'proposal' || i.kind === 'jira'))
  const oneRequests = []
  await collectWatchFeeds(replay({ requests: oneRequests }), { ...options, watchList: ['kafka'] })
  assert.ok(!oneRequests.some(u => /FLINK|HADOOP|HDFS|YARN|MAPREDUCE/.test(u)))
  const emptyRequests = []
  assert.deepEqual((await collectWatchFeeds(replay({ requests: emptyRequests }), { ...options, watchList: [] })).sources, [])
  assert.deepEqual(emptyRequests, [])
  const unknown = await collectWatchFeeds(replay(), { ...options, watchList: ['spark'] })
  assert.equal(unknown.sources.find(s => s.kind === 'jira').status, 'unavailable')
})

test('source failure is distinct from successful empty window and does not erase other sources', async () => {
  const report = await collectWatchFeeds(replay({ fail: url => url === PROPOSAL_SOURCES.kafka }), options)
  const failed = report.sources.find(s => s.url === PROPOSAL_SOURCES.kafka)
  assert.equal(failed.status, 'failed')
  assert.match(failed.error, /HTTP 503/)
  assert.equal(failed.fetchedAt, undefined)
  assert.equal(failed.count, undefined)
  assert.equal(report.sources.find(s => s.kind === 'release').status, 'ok')
  assert.ok(!report.items.some(i => i.kind === 'release'))
  assert.ok(report.undatedItems.some(i => i.project === 'flink'))
  for (const project of ['hadoop', 'flink']) {
    const missing = report.sources.find(s => s.project === project && s.kind === 'jira')
    assert.equal(missing.status, 'failed')
    assert.match(missing.error, /No recorded anonymous search fixture/)
  }
})

test('TTL cache retains raw payload/URL/fetch time and last-good data on HTTP, timeout or malformed refresh', async () => {
  const cache = new Map()
  const requests = []
  const first = await collectWatchFeeds(replay({ requests }), { ...options, cache, watchList: ['kafka'] })
  const before = structuredClone(cache.get(PROPOSAL_SOURCES.kafka))
  assert.equal(before.url, PROPOSAL_SOURCES.kafka)
  assert.equal(before.fetchedAt, FETCHED_AT)
  assert.equal(before.payload, await fixture('kip-index.html'))
  const cached = await collectWatchFeeds(async () => { throw new Error('TTL did not prevent fetch') }, { ...options, cache, watchList: ['kafka'] })
  assert.ok(cached.sources.every(s => s.status === 'cached'))
  assert.deepEqual(cached.items, first.items)
  for (const failure of ['http', 'timeout', 'truncated']) {
    const calls = []
    const replayHttp = replay({ requests: calls, at: '2026-11-11T05:00:00.000Z' })
    const http = async url => {
      if (url === PROPOSAL_SOURCES.kafka) {
        calls.push(url)
        if (failure === 'http') return replay({ fail: () => true })(url)
        if (failure === 'timeout') throw new Error('Injected timeout')
        return { url, fetchedAt: FETCHED_AT, payload: '<html><table>' }
      }
      return replayHttp(url)
    }
    const stale = await collectWatchFeeds(http, { now: new Date('2026-11-11T05:00:00.000Z'), cache, watchList: ['kafka'], ttlMs: 1000 })
    assert.ok(calls.includes(PROPOSAL_SOURCES.kafka))
    const source = stale.sources.find(s => s.url === PROPOSAL_SOURCES.kafka)
    assert.equal(source.status, 'stale')
    assert.equal(source.fetchedAt, before.fetchedAt)
    assert.match(source.error, /503|timeout|Truncated/)
    assert.deepEqual(cache.get(PROPOSAL_SOURCES.kafka), { ...before, cacheError: source.error })
    assert.deepEqual(stale.undatedItems.filter(i => i.kind === 'proposal'), first.undatedItems.filter(i => i.kind === 'proposal'))
  }
  const refreshed = await collectWatchFeeds(replay({ at: '2026-11-11T06:00:00.000Z' }), {
    now: new Date('2026-11-11T06:00:00.000Z'), cache, watchList: ['kafka'], ttlMs: 1000,
  })
  assert.equal(refreshed.sources.find(s => s.url === PROPOSAL_SOURCES.kafka).status, 'ok')
  assert.equal(cache.get(PROPOSAL_SOURCES.kafka).fetchedAt, '2026-11-11T06:00:00.000Z')
})

test('same fixtures produce deterministic feed structure and invalid source payloads fail clearly', async () => {
  assert.deepEqual(await collectWatchFeeds(replay(), options), await collectWatchFeeds(replay(), options))
  for (const payload of ['{', '{}', '[]', 'null']) assert.throws(() => parseJira(payload, 'kafka', 'https://issues.apache.org/jira/'))
  for (const payload of ['<html>', '<html><body>No index</body></html>']) {
    for (const project of ['kafka', 'flink']) assert.throws(() => parseProposals(payload, project), /Truncated|Missing/)
    assert.throws(() => parseKafkaNotes(payload), /Truncated|Missing/)
  }
  const raw = JSON.parse(await fixture('jira-kafka-newfeature.json'))
  raw.total = -1
  assert.throws(() => parseJira(JSON.stringify(raw), 'kafka', 'https://issues.apache.org/jira/'), /pagination/)
  raw.total = 0
  assert.throws(() => parseJira(JSON.stringify(raw), 'kafka', 'https://issues.apache.org/jira/'), /pagination/)
  await assert.rejects(collectWatchFeeds(replay(), { ...options, ttlMs: -1 }), /Invalid/)
})

test('injected date boundaries on recorded JIRA rows filter by updated time, retaining status and source timestamp', async () => {
  const raw = JSON.parse(await fixture('jira-kafka-newfeature.json'))
  const bounds = rollingWindow(now)
  // Boundary injection exercises filtering; these timestamps are test values, not recorded issue history.
  const dates = [bounds.start, bounds.end, new Date(Date.parse(bounds.start) - 1).toISOString(),
    new Date(Date.parse(bounds.end) + 1).toISOString(), '2026-11-10T23:30:00+0800']
  raw.issues.forEach((issue, i) => { issue.fields.updated = dates[i] })
  raw.generated = 'recorded-test-metadata'
  const source = jiraSearchUrl('kafka', bounds)
  const cache = new Map()
  const recorded = replay()
  const report = await collectWatchFeeds(async url => url === source
    ? { url, fetchedAt: FETCHED_AT, payload: JSON.stringify(raw) } : recorded(url), { ...options, watchList: ['kafka'], cache })
  const items = report.items.filter(i => i.kind === 'jira')
  assert.deepEqual(items.map(i => i.key), [raw.issues[0].key, raw.issues[1].key, raw.issues[4].key])
  assert.ok(items.every(i => i.dateBasis === 'updated' && i.status !== 'released'))
  assert.equal(report.sources.find(s => s.kind === 'jira').sourceTimestamp, raw.generated)
  assert.equal(cache.get(source).sourceTimestamp, raw.generated)
  const changed = structuredClone(raw)
  delete changed.issues[0].fields.updated
  changed.issues[0].fields.created = dates[0]
  assert.equal(parseJira(JSON.stringify(changed), 'kafka', source).data[0].dateBasis, 'created')
  for (const value of ['2026-02-30', '2026-02-30T03:00:00Z', 'yesterday', '2026-11-10T23:30:00']) {
    changed.issues[0].fields.created = value
    assert.throws(() => parseJira(JSON.stringify(changed), 'kafka', source), /Invalid feed date/)
  }
  const empty = { ...raw, issues: [], total: 0 }
  const result = parseJira(JSON.stringify(empty), 'kafka', source)
  assert.deepEqual(result.data, [])
  assert.ok(!result.warnings.some(w => /部分结果/.test(w)))
})

test('missing proposal URLs are omitted and dangerous links/malformed tables fail instead of becoming features', async () => {
  const payload = await fixture('flip-index.html')
  const withoutLinks = payload.replace(/<a\b[^>]*>|<\/a>/g, '')
  const omitted = parseProposals(withoutLinks, 'flink')
  assert.deepEqual(omitted.data, [])
  assert.match(omitted.warnings.join(' '), /缺少原文链接/)
  const dangerous = payload.replace(/href="[^"]*"/, 'href="javascript:alert(1)"')
  assert.throws(() => parseProposals(dangerous, 'flink'), /source link/)
  const broken = payload.replace(/<th\b[^>]*>.*?<\/th>/g, '')
  assert.throws(() => parseProposals(broken, 'flink'), /header/)
})

test('notes failures preserve catalogued releases and existing notes cache', async () => {
  const cache = new Map()
  const settings = { now: new Date('2026-10-21T00:00:00+08:00'), watchList: ['kafka'], cache, ttlMs: 1 }
  const first = await collectWatchFeeds(replay(), settings)
  const original = structuredClone(cache.get(KAFKA_DOWNLOADS))
  const failed = await collectWatchFeeds(replay({ fail: url => url === KAFKA_DOWNLOADS }), { ...settings, now: new Date('2026-10-21T00:00:01+08:00') })
  assert.deepEqual(failed.items, first.items)
  assert.equal(failed.sources.find(s => s.kind === 'release-notes').status, 'stale')
  assert.deepEqual(cache.get(KAFKA_DOWNLOADS), { ...original, cacheError: failed.sources.find(s => s.kind === 'release-notes').error })
  const noCache = await collectWatchFeeds(replay({ fail: url => url === KAFKA_DOWNLOADS }), { ...settings, cache: new Map() })
  assert.ok(noCache.items.length > 0)
  assert.ok(noCache.items.every(i => i.kind === 'release' && i.notesStatus === 'failed' && i.url === SOURCES.releases))
})

test('fresh trimmed canonical cwiki pages parse after replayed 302 and keep cwiki original links', async () => {
  const rows=JSON.parse(await fixture('canonical-provenance.json'))
  for(const row of rows){
    const payload=await fixture(row.file)
    assert.equal(createHash('sha256').update(payload).digest('hex'),row.fixtureSha256)
    let calls=0
    const http=createHttpClient({fetch:async()=>++calls===1?new Response(null,{status:302,headers:{Location:row.url+'?canonical=1'}}):new Response(payload)})
    const result=await http(row.url),parsed=parseProposals(result.payload,row.project)
    assert.equal(calls,2);assert.ok(parsed.data.length>0)
    assert.ok(parsed.data.every(p=>new URL(p.url).hostname==='cwiki.apache.org'))
  }
})
