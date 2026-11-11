import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as f from '../lib/fetchers.js'
import { buildCountsReport, fetchCountsReport, renderCountsMarkdown, singaporeTime } from '../lib/counts.js'
import { HttpError } from '../lib/http.js'
import { FETCHED_AT, fixture, fixtureHttp, manifest } from './helpers.mjs'

async function sources() {
  const http = fixtureHttp()
  return {
    chooser: await f.fetchChooser(http), committees: await f.fetchCommittees(http),
    podlings: await f.fetchPodlings(http), publicPodlings: await f.fetchPublicPodlings(http),
    retired: await f.fetchRetiredCommittees(http), retiredProjects: await f.fetchRetiredProjects(http),
    attic: await f.fetchAtticProjects(http),
  }
}
const row = (rows, id) => {
  const result = rows.find(r => r.id === id)
  assert.ok(result, id)
  return result
}

test('counts are computed from recorded sources with parallel scopes, citations and file timestamps', async () => {
  const inputs = await sources()
  const report = buildCountsReport(inputs)
  assert.equal(report.timezone, 'Asia/Singapore')
  assert.match(report.explanation, /当前列示 = chooser 当前 TLP \+ 当前孵化项目/)
  const pmcs = inputs.committees.data.pmcCount
  const podlings = inputs.chooser.data.projects.filter(p => p.pmc === 'incubator').length
  const tlps = pmcs - ['incubator', 'attic'].filter(id => inputs.committees.data.committees.some(c => c.id === id && c.pmc)).length
  assert.equal(row(report.counts, 'chooser-tlps').value, tlps)
  assert.equal(row(report.counts, 'chooser-podlings').value, podlings)
  assert.equal(row(report.counts, 'currently-listed').value, tlps + podlings)
  assert.equal(row(report.counts, 'pmcs').value, pmcs)
  assert.equal(row(report.counts, 'all-committees').value, inputs.committees.data.committeeCount)
  assert.notEqual(row(report.counts, 'pmcs').value, row(report.counts, 'all-committees').value)
  for (const id of ['chooser-podlings', 'podlings', 'public-podlings']) assert.equal(row(report.counts, id).value, podlings)
  for (const check of report.comparisons.filter(c => c.id.startsWith('podlings-') || c.id === 'tlp-cross-check')) assert.equal(check.status, 'match')
  for (const measure of [...report.counts, ...report.retired, ...report.categories.rows]) {
    assert.equal(measure.status, 'ok')
    assert.equal(measure.sources.length, 1)
    const citation = measure.sources[0]
    const input = Object.values(inputs).find(s => s.url === citation.url)
    assert.ok(input)
    assert.equal(citation.fetchedAt, FETCHED_AT)
    assert.equal(citation.fetchedAtDisplay, '2026-11-11 11:00:00 Asia/Singapore (UTC+8)')
    assert.equal(citation.sourceTimestamp, input.sourceTimestamp)
  }
  assert.equal(row(report.retired, 'attic-pmcs').sources[0].sourceTimestamp, undefined)
  assert.equal(singaporeTime('2026-11-10T20:30:00Z'), '2026-11-11 04:30:00 Asia/Singapore (UTC+8)')
  assert.throws(() => singaporeTime('not a date'), /Invalid fetch time/)
})

test('retired scopes stay separate and exact identifier mismatches remain visible in JSON and Markdown', async () => {
  const inputs = await sources()
  const report = buildCountsReport(inputs)
  assert.deepEqual(report.retired.map(r => r.id), ['retired-whimsy', 'retired-projects', 'attic-pmcs', 'attic-subprojects'])
  assert.equal(row(report.retired, 'retired-whimsy').value, inputs.retired.data.length)
  assert.equal(row(report.retired, 'retired-projects').value, inputs.retiredProjects.data.length)
  for (const [id, type] of [['attic-pmcs', 'PMC'], ['attic-subprojects', 'Subproject']]) {
    assert.equal(row(report.retired, id).value, inputs.attic.data.filter(p => p.type === type).length)
  }
  assert.equal(report.retiredTotal, undefined)
  const mismatch = row(report.comparisons, 'retired-whimsy-attic')
  assert.equal(mismatch.status, 'mismatch')
  assert.ok(mismatch.onlyLeft.some(m => m.id === 'flume'))
  assert.deepEqual(mismatch.onlyLeft.map(m => m.id), inputs.retired.data
    .filter(p => !inputs.attic.data.some(a => a.type === 'PMC' && a.id === p.id)).map(m => m.id).sort())
  assert.deepEqual(mismatch.onlyRight.map(m => m.id), inputs.attic.data
    .filter(p => p.type === 'PMC' && !inputs.retired.data.some(r => r.id === p.id)).map(m => m.id).sort())
  assert.deepEqual(mismatch.sources.map(s => s.url), [f.SOURCES.retired, f.SOURCES.attic])
  const text = renderCountsMarkdown(report)
  for (const phrase of ['退休委员会（Whimsy）', '退休委员会（projects.apache.org）', 'Attic PMC 行', 'Attic 子项目行', 'flume', '名单有差异', '不推断一一对应']) assert.ok(text.includes(phrase), phrase)
})

test('official category counts and sorted members preserve every multi-label membership', async () => {
  const inputs = await sources()
  const report = buildCountsReport(inputs)
  assert.equal(report.categories.status, 'ok')
  assert.equal(report.categories.official, true)
  assert.equal(report.categories.multiLabel, true)
  const raw = JSON.parse(await fixture('chooser.json'))
  const options = raw.questions.find(q => q.id === 'area').options
  assert.deepEqual(report.categories.rows.map(r => r.label), options.map(o => o.value))
  for (const category of report.categories.rows) {
    assert.equal(category.value, options.find(o => o.value === category.label).count)
    assert.deepEqual(category.members, inputs.chooser.data.projects.filter(p => p.areas.includes(category.label))
      .map(({ id, name }) => ({ id, name })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    assert.equal(category.sources[0].url, f.SOURCES.chooser)
  }
  const kafka = inputs.chooser.data.projects.find(p => p.id === 'kafka')
  assert.ok(kafka.areas.length > 1)
  assert.deepEqual(report.categories.rows.filter(r => r.members.some(m => m.id === 'kafka')).map(r => r.label),
    options.filter(o => kafka.areas.includes(o.value)).map(o => o.value))
  assert.ok(report.categories.rows.reduce((sum, r) => sum + r.value, 0) > row(report.counts, 'currently-listed').value)
})

test('cross-checks detect changed identities even when counts agree, without altering either source', async () => {
  const inputs = await sources()
  const original = structuredClone(inputs)
  inputs.publicPodlings.data.find(p => p.status === 'current').id = 'different-podling'
  const report = buildCountsReport(inputs)
  assert.equal(row(report.counts, 'podlings').value, row(report.counts, 'public-podlings').value)
  const check = row(report.comparisons, 'podlings-projects-whimsy')
  assert.equal(check.status, 'mismatch')
  assert.ok(check.onlyRight.some(m => m.id === 'different-podling'))
  assert.equal(check.onlyLeft.length, 1)
  assert.deepEqual(inputs.podlings, original.podlings)
  assert.equal(row(report.counts, 'currently-listed').value, buildCountsReport(original).counts[0].value)
  inputs.committees.data.committees = inputs.committees.data.committees.filter(c => c.id !== 'attic')
  assert.match(row(buildCountsReport(inputs).comparisons, 'tlp-cross-check').error, /缺少 attic/)
})

test('missing sources are explicit errors without fabricated values or success timestamps', () => {
  const report = buildCountsReport({})
  for (const result of [...report.counts, ...report.retired, ...report.comparisons, report.categories]) {
    assert.equal(result.status, 'error')
    assert.match(result.error, /来源缺失/)
    assert.equal(Object.hasOwn(result, 'value'), false)
    for (const source of result.sources) {
      assert.ok(source.url.startsWith('https://'))
      assert.equal(source.fetchedAt, null)
      assert.equal(source.fetchedAtDisplay, null)
    }
  }
  assert.match(renderCountsMarkdown(report), /错误：来源请求或数据解析失败：来源缺失/)
})

test('HTTP errors, timeouts, missing fixtures and invalid payloads remain source errors while other rows survive', async () => {
  for (const [url, failure] of [
    [f.SOURCES.attic, async () => { throw new HttpError(f.SOURCES.attic, 503) }],
    [f.SOURCES.chooser, async () => { throw new Error('Injected timeout') }],
    [f.SOURCES.retiredProjects, async () => { throw new Error('No recorded fixture') }],
    [f.SOURCES.committees, async () => ({ url: f.SOURCES.committees, fetchedAt: FETCHED_AT, payload: '{' })],
  ]) {
    const http = fixtureHttp()
    const report = await fetchCountsReport(request => request === url ? failure() : http(request))
    const measures = [...report.counts, ...report.retired]
    for (const result of measures.filter(r => r.sources.some(s => s.url === url))) {
      assert.equal(result.status, 'error')
      assert.ok(result.error)
      assert.equal(Object.hasOwn(result, 'value'), false)
    }
    for (const result of measures.filter(r => r.sources.every(s => s.url !== url))) assert.equal(result.status, 'ok')
    if (url === f.SOURCES.chooser) assert.equal(report.categories.status, 'error')
    assert.match(renderCountsMarkdown(report), /错误：/)
  }
})

test('recorded fetch times, deterministic report/Markdown and escaped source text are preserved', async () => {
  const inputs = await sources()
  for (const input of Object.values(inputs)) input.fetchedAt = manifest.sources.find(s => s.url === input.url).fetchedAt
  const before = structuredClone(inputs)
  const report = buildCountsReport(inputs)
  assert.deepEqual(inputs, before)
  assert.deepEqual(report, buildCountsReport(inputs))
  assert.deepEqual(JSON.parse(JSON.stringify(report)), report)
  const text = renderCountsMarkdown(report)
  assert.equal(text, renderCountsMarkdown(buildCountsReport(inputs)))
  for (const result of [...report.counts, ...report.retired, ...report.categories.rows]) {
    assert.ok(text.includes(result.sources[0].url))
    assert.ok(text.includes(singaporeTime(result.sources[0].fetchedAt)))
    if (result.sources[0].sourceTimestamp) assert.ok(text.includes(result.sources[0].sourceTimestamp))
  }
  assert.match(text, /分类数量不能相加/)
  const kafka = inputs.chooser.data.projects.find(p => p.id === 'kafka')
  kafka.name = '<b>name</b>|\n[link]'
  const escaped = renderCountsMarkdown(buildCountsReport(inputs))
  assert.ok(escaped.includes('\\<b\\>name\\</b\\>\\| \\[link\\]'))
  assert.ok(!escaped.includes(kafka.name))
  assert.deepEqual(await fetchCountsReport(fixtureHttp()), await fetchCountsReport(fixtureHttp()))
})
