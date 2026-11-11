import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import * as f from '../lib/fetchers.js'
import { FETCHED_AT, fixture, fixtureHttp, manifest } from './helpers.mjs'

const fetchers = [f.fetchChooser, f.fetchCommittees, f.fetchRetiredCommittees, f.fetchRetiredProjects,
  f.fetchPodlings, f.fetchPublicPodlings, f.fetchReleases, f.fetchAtticProjects]

test('recorded fixtures keep source URLs, original completion times and integrity hashes', async () => {
  assert.equal(manifest.sources.length, fetchers.length)
  for (const source of manifest.sources) {
    assert.ok(Date.parse(source.fetchedAt))
    assert.ok(source.url.startsWith('https://'))
    assert.match(source.originalSha256, /^[a-f0-9]{64}$/)
    assert.equal(createHash('sha256').update(await fixture(source.file)).digest('hex'), source.fixtureSha256)
  }
})

test('all directory fetchers preserve source URL, injected fetch time and deterministic data', async () => {
  const http = fixtureHttp()
  for (const fetcher of fetchers) {
    const result = await fetcher(http)
    assert.ok(Object.values(f.SOURCES).includes(result.url))
    assert.equal(result.fetchedAt, FETCHED_AT)
    assert.deepEqual(result, await fetcher(http))
  }
})

test('chooser keeps official categories and every multi-label tag', async () => {
  const result = await f.fetchChooser(fixtureHttp())
  const raw = JSON.parse(await fixture('chooser.json'))
  assert.equal(result.sourceTimestamp, raw.generated)
  assert.deepEqual(result.data.categories, raw.questions.find(q => q.id === 'area').options.map(o => o.value))
  assert.equal(result.data.projects.length, raw.projects.length)
  const kafka = result.data.projects.find(p => p.id === 'kafka')
  assert.deepEqual(kafka.areas, raw.projects.find(p => p.id === 'kafka').area)
  assert.ok(kafka.areas.length > 1)
  assert.equal(result.data.projects.find(p => p.id === 'incubator-amoro').pmc, 'incubator')
})

test('committee PMC flags and source totals stay separate; current podlings cross-check', async () => {
  const http = fixtureHttp()
  const committees = await f.fetchCommittees(http)
  assert.equal(committees.data.committeeCount, committees.data.committees.length)
  assert.equal(committees.data.pmcCount, committees.data.committees.filter(c => c.pmc).length)
  assert.ok(committees.data.committeeCount > committees.data.pmcCount)
  assert.equal(committees.sourceTimestamp, JSON.parse(await fixture('committee-info.json')).last_updated)
  const current = await f.fetchPodlings(http)
  const all = await f.fetchPublicPodlings(http)
  assert.deepEqual(current.data.map(p => p.id).sort(), all.data.filter(p => p.status === 'current').map(p => p.id).sort())
  assert.equal(all.sourceTimestamp, JSON.parse(await fixture('public_podlings.json')).last_updated)
  assert.ok(all.data.some(p => p.status === 'graduated'))
  assert.ok(all.data.some(p => p.status === 'retired'))
})

test('retired lists and Attic rows retain differences, types, notes and original links', async () => {
  const http = fixtureHttp()
  const whimsy = await f.fetchRetiredCommittees(http)
  const projects = await f.fetchRetiredProjects(http)
  const attic = await f.fetchAtticProjects(http)
  assert.equal(whimsy.sourceTimestamp, JSON.parse(await fixture('committee-retired.json')).last_updated)
  assert.ok(projects.data.some(p => p.id === 'xmlbeans'))
  assert.ok(whimsy.data.some(p => p.id === 'flume'))
  assert.equal(attic.data.find(p => p.id === 'flume'), undefined)
  assert.ok(attic.data.some(p => p.type === 'PMC'))
  assert.ok(attic.data.some(p => p.type === 'Subproject'))
  const xmlbeans = attic.data.find(p => p.id === 'xmlbeans')
  assert.equal(xmlbeans.url, 'https://attic.apache.org/projects/xmlbeans.html')
  assert.ok(xmlbeans.description)
  assert.equal(attic.sourceTimestamp, undefined)
})

test('release records preserve exact catalog labels, dates and original catalog source link', async () => {
  const result = await f.fetchReleases(fixtureHttp())
  const raw = JSON.parse(await fixture('releases.json'))
  for (const project of ['kafka', 'hadoop', 'flink']) {
    assert.deepEqual(result.data.filter(r => r.project === project), Object.entries(raw[project]).map(([version, date]) => ({ project, version, date, url: f.SOURCES.releases })))
  }
  assert.ok(result.data.some(r => r.version.includes('Thirdparty')))
})

test('invalid, empty and truncated payloads fail with source context, never as zero entries', async () => {
  for (const fetcher of fetchers) {
    for (const payload of ['{', '{}', '[]', 'null', '<html><table><tr>']) {
      await assert.rejects(fetcher(async url => ({ url, fetchedAt: FETCHED_AT, payload })), /Invalid source payload/)
    }
  }
  const raw = await fixture('attic-projects.html')
  await assert.rejects(f.fetchAtticProjects(async url => ({ url, fetchedAt: FETCHED_AT, payload: raw.slice(0, -100) })), /Truncated/)
})

test('malformed source fields and inconsistent counts fail clearly', async () => {
  const broken = async (file, fetcher, change) => {
    const raw = JSON.parse(await fixture(file))
    change(raw)
    await assert.rejects(fetcher(async url => ({ url, fetchedAt: FETCHED_AT, payload: JSON.stringify(raw) })), /Invalid source payload/)
  }
  await broken('chooser.json', f.fetchChooser, r => { r.projects[0].area = ['Invented area'] })
  await broken('committee-info.json', f.fetchCommittees, r => { r.committee_count++ })
  await broken('committee-info.json', f.fetchCommittees, r => { r.committees.kafka.pmc = 'yes' })
  await broken('committee-retired.json', f.fetchRetiredCommittees, r => { r.retired_count++ })
  await broken('podlings.json', f.fetchPodlings, r => { r.amoro.podling = false })
  await broken('public_podlings.json', f.fetchPublicPodlings, r => { r.podling.amoro.status = 'shipped' })
  await broken('public_podlings.json', f.fetchPublicPodlings, r => { r.status_counts.current++ })
  await broken('releases.json', f.fetchReleases, r => { r.kafka['Kafka-4.4.0'] = '2026-02-30' })
  const raw = await fixture('attic-projects.html')
  for (const payload of [raw.replace('>PMC</td>', '>Unknown</td>'), raw.replace('href="/projects/abdera.html">Apache Abdera', 'href="javascript:alert(1)">Apache Abdera')]) {
    await assert.rejects(f.fetchAtticProjects(async url => ({ url, fetchedAt: FETCHED_AT, payload })), /Invalid source payload/)
  }
})
