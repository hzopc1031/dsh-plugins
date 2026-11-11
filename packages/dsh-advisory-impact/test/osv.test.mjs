import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { SourceCache, OsvClient, createOsvHttpClient } from '../index.js'
import { OSV_QUERY_URL, osvUrl, USER_AGENT } from '../lib/http.js'
import { parseOsvLookup, parseOsvQuery } from '../lib/osv.js'
import { AT, NOW } from './fixture-http.mjs'
import { osvManifest, osvFixtureFetch, osvFixtureHttp } from './osv-fixture-http.mjs'

async function temp(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'advisory-osv-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}

test('recorded OSV extracts retain provenance; GET 404 is not indexed, GET 200 is second source', async t => {
  for (const entry of osvManifest) {
    assert.ok(Number.isFinite(Date.parse(entry.originalFetchTime)))
    assert.match(entry.captureKind, /not a complete raw HTTP response/)
  }
  const dir = await temp(t)
  const osv = new OsvClient(new SourceCache(dir, osvFixtureHttp(), NOW))
  for (const id of ['CVE-2026-114349', 'CVE-2026-112375', 'CVE-2026-111115']) {
    const result = await osv.lookup(id, 1000)
    assert.equal(result.data.status, 'not_indexed')
    assert.equal(result.data.label, 'OSV 未收录 / HTTP 404')
    assert.equal(result.data.record, null)
    assert.equal(result.fetchedAt, AT)
    assert.equal((await osv.lookup(id, 1000)).state, 'cached')
  }
  const found = await osv.lookup('CVE-2024-31141', 1000)
  assert.equal(found.data.status, 'found')
  assert.equal(found.data.label, 'OSV 第二来源')
  assert.equal(found.data.record.id, 'CVE-2024-31141')
  assert.deepEqual(found.data.record.aliases, ['GHSA-2x2g-32r7-p4x8'])
  assert.ok(!('verdict' in found.data))
})

test('OSV transport admits only pinned Maven POST and valid CVE/GHSA GET, with anonymous bounded requests', async () => {
  const fixture = osvFixtureFetch()
  let calls = 0
  const http = createOsvHttpClient({ now: NOW, fetch: async (url, init) => {
    calls++
    assert.equal(init.credentials, 'omit')
    assert.equal(init.redirect, 'manual')
    assert.equal(init.headers['User-Agent'], USER_AGENT)
    assert.equal(init.headers.Authorization, undefined)
    assert.ok(init.signal instanceof AbortSignal)
    if (url === OSV_QUERY_URL) assert.deepEqual(JSON.parse(init.body), {
      package: { name: 'org.apache.kafka:kafka-clients', ecosystem: 'Maven' }, version: '3.7.0',
    })
    return fixture(url, init)
  } })
  await http(osvUrl('CVE-2024-31141'))
  const result = parseOsvQuery(await http(OSV_QUERY_URL, { maven: 'org.apache.kafka:kafka-clients', version: '3.7.0' }))
  assert.equal(result.records.length, 4)
  for (const [url, query] of [[OSV_QUERY_URL], [OSV_QUERY_URL, { maven: 'bad', version: '1.0' }],
    ['https://api.osv.dev/v1/vulns/CVE-2024-31141?secret=x'], ['https://user:pass@api.osv.dev/v1/vulns/CVE-2024-31141'],
    ['https://reporter.apache.org/'], ['https://api.osv.dev/v1/vulns/../../query'],
    [osvUrl('CVE-2024-31141'), { maven: 'g:a', version: '1.0' }]]) await assert.rejects(http(url, query))
  assert.equal(calls, 2)
  assert.equal(osvUrl('GHSA-2x2g-32r7-p4x8'), 'https://api.osv.dev/v1/vulns/GHSA-2x2g-32r7-p4x8')
})

test('Maven query cache keys include coordinate/version; recorded empty query is a second-source result only', async t => {
  const dir = await temp(t)
  const osv = new OsvClient(new SourceCache(dir, osvFixtureHttp(), NOW))
  const results = []
  for (const version of ['3.7.0', '4.1.0', '4.2.0']) results.push(await osv.query({ maven: 'org.apache.kafka:kafka-clients', version }, 1000))
  assert.deepEqual(results.map(r => r.data.records.length), [4, 2, 0])
  assert.equal((await readdir(dir)).length, 3)
  assert.equal((await osv.query({ maven: 'org.apache.kafka:kafka-clients', version: '4.1.0' }, 1000)).state, 'cached')
  assert.equal((await osv.query({ version: '4.1.0', maven: 'org.apache.kafka:kafka-clients' }, 1000)).state, 'cached')
  assert.equal((await readdir(dir)).length, 3)
})

test('invalid OSV bodies fail; 503/timeouts stay failures and preserve a cached record', async t => {
  const id = 'CVE-2024-31141', url = osvUrl(id)
  for (const payload of ['{', '{}', '{"id":"wrong","affected":[]}', '{"id":"CVE-2024-31141","aliases":"bad"}', '{"id":"CVE-2024-31141","affected":[null]}']) {
    assert.throws(() => parseOsvLookup(id, { url, status: 200, payload, fetchedAt: AT }))
  }
  for (const payload of ['{', 'null', '{"vulns":{}}', '{"next_page_token":"more"}']) assert.throws(() => parseOsvQuery({ url: OSV_QUERY_URL, status: 200, payload, fetchedAt: AT }))
  const dir = await temp(t)
  let fail = false
  const fixture = osvFixtureFetch()
  const cache = new SourceCache(dir, createOsvHttpClient({ now: NOW, fetch: (u, i) => fail ? new Response('', { status: 503 }) : fixture(u, i) }), NOW)
  const osv = new OsvClient(cache)
  const first = await osv.lookup(id, 1000)
  fail = true
  const stale = await osv.lookup(id, 1000, true)
  assert.equal(stale.state, 'stale')
  assert.deepEqual(stale.data, first.data)
  assert.match(stale.error, /503/)
  const freshError = await osv.lookup('CVE-2026-114349', 1000)
  assert.equal(freshError.state, 'error')
  assert.equal(freshError.data, null)
  assert.match(freshError.error, /503/)
})
