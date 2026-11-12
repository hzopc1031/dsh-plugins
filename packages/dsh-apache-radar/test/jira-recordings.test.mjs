import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { collectWatchFeeds, jiraSearchUrl, parseJira, PROPOSAL_SOURCES } from '../lib/feeds.js'
import { fetchCountsReport } from '../lib/counts.js'
import { renderWeeklyBrief } from '../lib/brief.js'
import { message } from '../lib/messages.js'
import { fixture, manifest } from './helpers.mjs'

const recording = JSON.parse(await fixture('jira-provenance.json'))
const feeds = JSON.parse(await fixture('feed-provenance.json'))
const now = new Date(recording.window.end)
const records = [...manifest.sources, ...feeds.sources, ...recording.sources]
const http = async url => {
  const source = records.find(s => s.url === url || s.file === (url === PROPOSAL_SOURCES.kafka ? 'kip-index.html' : url === PROPOSAL_SOURCES.flink ? 'flip-index.html' : ''))
  assert.ok(source, `No recorded source for ${url}`)
  return { url, fetchedAt: source.fetchedAt, payload: await fixture(source.file) }
}

test('dated anonymous JIRA recordings retain provenance and original fields for all default watched projects', async () => {
  assert.deepEqual(recording.sources.map(s => s.project), ['kafka', 'hadoop', 'flink'])
  for (const source of recording.sources) {
    const payload = await fixture(source.file)
    assert.equal(createHash('sha256').update(payload).digest('hex'), source.fixtureSha256)
    assert.match(source.originalSha256, /^[a-f0-9]{64}$/)
    assert.ok(Number.isFinite(Date.parse(source.fetchedAt)))
    assert.equal(source.url, jiraSearchUrl(source.project, recording.window))
    assert.doesNotMatch(payload, /"(assignee|reporter|emailAddress|avatarUrls|description|body)"\s*:/)
    const raw = JSON.parse(payload)
    const parsed = parseJira(payload, source.project, source.url)
    assert.equal(parsed.data.length, raw.issues.length)
    assert.ok(parsed.data.length > 0)
    assert.ok(parsed.warnings.includes(message('feed.partialJira')))
    for (const [index, item] of parsed.data.entries()) {
      const issue = raw.issues[index]
      assert.equal(item.kind, 'jira')
      assert.equal(item.url, `https://issues.apache.org/jira/browse/${issue.key}`)
      assert.equal(item.title, issue.fields.summary)
      assert.equal(item.status, issue.fields.status.name)
      assert.equal(item.date, issue.fields.updated)
      assert.equal(item.dateBasis, 'updated')
      assert.deepEqual(item.fixVersions, issue.fields.fixVersions.map(v => v.name))
    }
  }
})

test('recorded rolling queries produce deterministic linked JIRA brief items without failures or shipment inference', async () => {
  const report = await collectWatchFeeds(http, { now })
  const counts = await fetchCountsReport(http, { now })
  assert.deepEqual(report.watchList, ['kafka', 'hadoop', 'flink'])
  assert.deepEqual(report.sources.filter(s => s.kind === 'jira').map(s => s.status), ['ok', 'ok', 'ok'])
  for (const source of recording.sources) {
    const raw = JSON.parse(await fixture(source.file))
    const expected = raw.issues.filter(i => Date.parse(i.fields.updated) >= Date.parse(report.window.start)
      && Date.parse(i.fields.updated) <= now.getTime())
    const items = report.items.filter(i => i.project === source.project && i.kind === 'jira')
    assert.ok(items.length > 0)
    assert.deepEqual(items.map(i => i.key), expected.map(i => i.key))
    assert.equal(report.sources.find(s => s.url === source.url).fetchedAt, source.fetchedAt)
  }
  const brief = renderWeeklyBrief(counts, report)
  assert.equal(brief, renderWeeklyBrief(counts, await collectWatchFeeds(http, { now })))
  for (const source of recording.sources) assert.ok(brief.includes(source.url))
  for (const item of report.items.filter(i => i.kind === 'jira')) assert.ok(brief.includes(item.url))
  assert.match(brief, /fixVersion.*不.*已发布/)
  assert.match(brief, /Hadoop 没有已验证的通用 HIP/)
})
