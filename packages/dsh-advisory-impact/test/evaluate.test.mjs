import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { parse } from 'node-html-parser'
import { SourceCache, OsvClient, evaluatePins, evaluateProject, saveSettings, PIN_FILE, createHttpClient, createOsvHttpClient } from '../index.js'
import { SOURCES } from '../lib/http.js'
import { AT, document, fixtureFetch } from './fixture-http.mjs'
import { osvFixtureFetch } from './osv-fixture-http.mjs'

const kept = ['CVE-2026-114349', 'CVE-2026-112375', 'CVE-2024-31141', 'CVE-2026-35554']
// Controlled inventory omission using unchanged recorded advisory sections, to exercise OSV-only grouping.
async function kafkaSubset() {
  const doc = await document(SOURCES.kafka)
  const root = parse(doc.payload)
  for (const heading of root.querySelectorAll('h2')) {
    if (!/^CVE-/.test(heading.id) || kept.includes(heading.id)) continue
    let node = heading.nextSibling
    while (node && node.rawTagName !== 'h2') {
      const next = node.nextSibling
      node.remove()
      node = next
    }
    heading.remove()
  }
  return root.toString()
}

async function setup(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'advisory-evaluate-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  let time = Date.parse(AT), failAll = false
  const failures = new Set(), calls = []
  const now = () => new Date(time)
  const subset = await kafkaSubset()
  const fixture = fixtureFetch(new Map([[SOURCES.kafka, () => new Response(subset)]]))
  const cache = new SourceCache(path.join(root, 'official-cache'), createHttpClient({ now, fetch: async (url, init) => {
    calls.push(url)
    if (failAll || failures.has(url)) throw new Error(`fixture source unavailable: ${url}`)
    return fixture(url, init)
  } }), now)
  const osvFetch = osvFixtureFetch()
  const osv = new OsvClient(new SourceCache(path.join(root, 'osv-cache'), createOsvHttpClient({ now, fetch: async (url, init) => {
    if (failAll) throw new Error('fixture OSV unavailable')
    return osvFetch(url, init)
  } }), now))
  return { root, cache, osv, failures, calls, tick: ms => { time += ms }, failAll: () => { failAll = true } }
}
const config = { watch: ['kafka'], pins: [{ project: 'kafka', version: '3.7.0', maven: 'org.apache.kafka:kafka-clients' }], cacheTtlMs: 1000 }

test('shared pipeline keeps official verdicts authoritative, 404 visible, ranges separate, suppressions and OSV-only distinct', async t => {
  const s = await setup(t)
  const result = await evaluatePins({ ...s, config })
  const project = result.projects[0]
  assert.equal(project.source.state, 'fresh')
  const plain = evaluateProject(project.source.data, [{ version: '3.7.0', maven: 'org.apache.kafka:kafka-clients' }], result.suppressions.data)
  assert.deepEqual(project.verdicts.advisories.map(({ osv, ...a }) => a), plain.advisories)
  const found = project.verdicts.advisories.find(a => a.id === 'CVE-2024-31141')
  assert.equal(found.verdict, 'affected')
  assert.equal(found.url, SOURCES.kafka + '#CVE-2024-31141')
  assert.equal(found.fetchedAt, AT)
  assert.equal(found.osv.lookup.data.status, 'found')
  assert.equal(found.osv.comparison, 'different_ranges')
  assert.match(found.osv.note, /官方判定保持不变/)
  assert.equal(found.osv.queryMatches[0].record.id, 'GHSA-2x2g-32r7-p4x8')
  const absent = project.verdicts.advisories.find(a => a.id === 'CVE-2026-112375')
  assert.equal(absent.osv.lookup.data.label, 'OSV 未收录 / HTTP 404')
  assert.equal(absent.osv.lookup.data.record, null)
  assert.equal(absent.verdict, plain.advisories.find(a => a.id === absent.id).verdict)
  assert.equal(project.verdicts.suppressions.title, '扫描器报了，但官方说明不适用')
  for (const suppression of project.verdicts.suppressions.suppressions) {
    assert.equal(suppression.url, SOURCES.suppressions)
    assert.equal(suppression.fetchedAt, AT)
    assert.ok(!project.verdicts.advisories.some(a => a.id === suppression.id && a.verdict === 'affected'))
  }
  assert.equal(project.osvOnly.title, '仅见 OSV，未见官方公告')
  assert.equal(project.osvOnly.inventoryAvailable, true)
  assert.equal(project.osvOnly.items.length, 2)
  for (const item of project.osvOnly.items) {
    assert.ok(!('verdict' in item))
    assert.ok(item.record.aliases.every(id => !kept.includes(id)))
    assert.equal(item.fetchedAt, AT)
    assert.equal(item.url, 'https://api.osv.dev/v1/query')
  }
  const aliasMatch = project.verdicts.advisories.find(a => a.id === 'CVE-2026-35554')
  assert.equal(aliasMatch.osv.queryMatches[0].record.id, 'GHSA-5qcv-4rpc-jp93')
  assert.equal(aliasMatch.osv.lookup.state, 'error', 'uncaptured lookup is a fixture error, never a fabricated 404')
  assert.equal(result.guidance.data.url, SOURCES.guidance)
  assert.ok(!JSON.stringify(result).includes('<html'))
})

test('same fixtures/pins give deterministic result structure; fixed-version official outcome survives a failed OSV lookup', async t => {
  const s = await setup(t)
  const fixedConfig = { ...config, pins: [{ project: 'kafka', version: '3.7.1', component: 'kafka-clients' }] }
  const first = await evaluatePins({ ...s, config: fixedConfig, force: true })
  const second = await evaluatePins({ ...s, config: fixedConfig, force: true })
  assert.deepEqual(first, second)
  const found = first.projects[0].verdicts.advisories.find(a => a.id === 'CVE-2024-31141')
  assert.equal(found.verdict, 'not_affected')
  assert.equal(found.osv.lookup.data.status, 'found')
  assert.deepEqual(first.projects[0].queries, [], 'no Maven coordinate means no version query/upload')
  s.failAll()
  const stale = await evaluatePins({ ...s, config: fixedConfig, force: true })
  assert.equal(stale.projects[0].source.state, 'stale')
  assert.equal(stale.projects[0].verdicts.advisories.find(a => a.id === found.id).verdict, 'not_affected')
  assert.equal(stale.projects[0].verdicts.advisories.find(a => a.id === found.id).osv.lookup.state, 'stale')
})

test('an OSV Maven hit conflicting with a fixed official pin is explicitly flagged without replacing the verdict', async t => {
  const s = await setup(t)
  // Deliberate fixed-field mutation of a recorded section for conflict testing, not an official data claim.
  const cache = {
    async load(...args) {
      const result = await s.cache.load(...args)
      if (args[0] === SOURCES.kafka && result.data) {
        result.data.advisories = result.data.advisories.map(a => a.id === 'CVE-2024-31141' ? { ...a, fixedText: '3.7.0' } : a)
      }
      return result
    },
  }
  const result = await evaluatePins({ ...s, cache, config })
  const item = result.projects[0].verdicts.advisories.find(a => a.id === 'CVE-2024-31141')
  assert.equal(item.verdict, 'not_affected')
  assert.equal(item.osv.comparison, 'query_disagreement')
  assert.match(item.osv.note, /OSV Maven 查询命中.*官方判定为不受影响/)
  assert.equal(item.osv.queryMatches.length, 1)
})

test('watched projects without pins retain every official advisory as unknown and keep the Flink pointer separate', async t => {
  const s = await setup(t)
  const result = await evaluatePins(s)
  assert.deepEqual(result.projects.map(p => p.project), ['kafka', 'hadoop', 'flink'])
  for (const project of result.projects) {
    assert.equal(project.verdicts.advisories.length, project.source.data.advisories.length)
    for (const item of project.verdicts.advisories) {
      assert.equal(item.verdict, 'unknown')
      assert.equal(item.reason, '未填写运行版本，无法判断')
      assert.equal(item.fetchedAt, AT)
    }
    assert.deepEqual(project.queries, [])
  }
  assert.equal(result.flinkPointer.data.kind, 'pointer')
  assert.match(result.projects[2].verdicts.notices.join(''), /实验性.*2023.*滞后/)
  assert.equal(result.projects[1].verdicts.suppressions, null)
  assert.equal(result.projects[2].verdicts.suppressions, null)
})

test('file edits change watch list/pins without restart; unsupported projects report unavailable sources', async t => {
  const s = await setup(t)
  await saveSettings(s.root, config)
  const first = await evaluatePins({ ...s, projectDirectory: s.root })
  assert.equal(first.projects[0].verdicts.advisories.find(a => a.id === 'CVE-2024-31141').verdict, 'affected')
  await writeFile(path.join(s.root, PIN_FILE), JSON.stringify({ ...config, pins: [{ project: 'kafka', version: '3.7.1', component: 'kafka-clients' }] }))
  const edited = await evaluatePins({ ...s, projectDirectory: s.root })
  assert.equal(edited.projects[0].source.state, 'cached')
  assert.equal(edited.projects[0].verdicts.advisories.find(a => a.id === 'CVE-2024-31141').verdict, 'not_affected')
  await saveSettings(s.root, { watch: ['hadoop', 'my-project'] })
  const changed = await evaluatePins({ ...s, projectDirectory: s.root })
  assert.deepEqual(changed.projects.map(p => p.project), ['hadoop', 'my-project'])
  assert.equal(changed.projects[1].verdicts, null)
  assert.match(changed.projects[1].error, /官方来源/)
  assert.equal(changed.suppressions, null)
  assert.equal(changed.flinkPointer, null)
})

test('source failure without cache is unavailable, never zero advisories; missing suppression gates Kafka verdicts', async t => {
  const s = await setup(t)
  s.failures.add(SOURCES.suppressions)
  const noSuppression = await evaluatePins({ ...s, config })
  assert.equal(noSuppression.suppressions.state, 'error')
  assert.equal(noSuppression.projects[0].verdicts.suppressions, null)
  for (const a of noSuppression.projects[0].verdicts.advisories) {
    assert.equal(a.verdict, 'unknown')
    assert.match(a.reason, /suppressions 来源不可用/)
    assert.ok(a.pins.every(p => p.verdict === 'unknown'))
  }
  s.failures.add(SOURCES.hadoop)
  const noSource = await evaluatePins({ ...s, config: { watch: ['hadoop'] } })
  assert.equal(noSource.projects[0].source.state, 'error')
  assert.equal(noSource.projects[0].source.data, null)
  assert.equal(noSource.projects[0].verdicts, null)
  assert.equal(noSource.projects[0].osvOnly.inventoryAvailable, false)
  assert.match(noSource.projects[0].error, /unavailable/)
})

test('pipeline TTL expiry forces a fixture refetch and source outages retain original timestamps and last-good suppressions', async t => {
  const s = await setup(t)
  const first = await evaluatePins({ ...s, config })
  const count = s.calls.length
  assert.equal((await evaluatePins({ ...s, config })).projects[0].source.state, 'cached')
  assert.equal(s.calls.length, count)
  s.tick(1000)
  const refreshed = await evaluatePins({ ...s, config })
  assert.equal(refreshed.projects[0].source.state, 'fresh')
  assert.equal(s.calls.length, count * 2)
  const fetchedAt = refreshed.projects[0].source.fetchedAt
  s.failAll(); s.tick(1000)
  const stale = await evaluatePins({ ...s, config })
  assert.equal(stale.projects[0].source.state, 'stale')
  assert.match(stale.projects[0].source.error, /unavailable/)
  assert.equal(stale.suppressions.state, 'stale')
  assert.equal(stale.projects[0].source.fetchedAt, fetchedAt)
  assert.deepEqual(stale.projects[0].verdicts.advisories.map(({ osv, ...a }) => a), refreshed.projects[0].verdicts.advisories.map(({ osv, ...a }) => a))
  assert.deepEqual(stale.projects[0].verdicts.suppressions, refreshed.projects[0].verdicts.suppressions)
  assert.equal(first.projects[0].source.fetchedAt, AT)
})
