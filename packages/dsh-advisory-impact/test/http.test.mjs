import test from 'node:test'
import assert from 'node:assert/strict'
import { createHttpClient, SOURCES, USER_AGENT, SourceError } from '../lib/http.js'
import { fetchAdvisories } from '../lib/fetchers.js'
import { AT, NOW, fixtureFetch } from './fixture-http.mjs'

test('HTTP uses anonymous GET, identifying user agent, deadline and injected completion time', async () => {
  const fixture = fixtureFetch()
  const http = createHttpClient({ now: NOW, fetch: async (url, init) => {
    assert.equal(init.method, 'GET')
    assert.equal(init.redirect, 'manual')
    assert.equal(init.credentials, 'omit')
    assert.equal(init.headers['User-Agent'], USER_AGENT)
    assert.equal(init.headers.Authorization, undefined)
    assert.ok(init.signal instanceof AbortSignal)
    return fixture(url, init)
  } })
  const doc = await http(SOURCES.kafka)
  assert.equal(doc.url, SOURCES.kafka)
  assert.equal(doc.fetchedAt, AT)
  assert.match(doc.payload, /<html/)
})

test('HTTP 429 retries once with Retry-After and does not hammer long backoff responses', async () => {
  for (const retryAfter of ['2', 'Wed, 11 Nov 2026 08:00:03 GMT', 'invalid', '120']) {
    const waits = []
    let calls = 0
    const http = createHttpClient({ now: NOW, sleep: async ms => { waits.push(ms) }, fetch: async () => {
      calls++
      return calls === 1 ? new Response('', { status: 429, headers: { 'Retry-After': retryAfter } }) : fixtureFetch()(SOURCES.kafka)
    } })
    if (['invalid', '120'].includes(retryAfter)) {
      await assert.rejects(http(SOURCES.kafka), /HTTP 429/)
      assert.equal(calls, 1)
      assert.deepEqual(waits, [])
    } else {
      await http(SOURCES.kafka)
      assert.equal(calls, 2)
      assert.deepEqual(waits, [retryAfter === '2' ? 2000 : 3000])
    }
  }
  let calls = 0
  const http = createHttpClient({ sleep: async () => {}, fetch: async () => { calls++; return new Response('', { status: 429 }) } })
  await assert.rejects(http(SOURCES.kafka), /HTTP 429/)
  assert.equal(calls, 2)
})

test('HTTP failure, redirect, timeout and body errors surface as errors, never empty inventories', async () => {
  for (const status of [302, 401, 403, 404, 500, 503]) {
    const http = createHttpClient({ fetch: async () => new Response('', { status }) })
    await assert.rejects(fetchAdvisories('kafka', http), new RegExp(`HTTP ${status}`))
  }
  const timedOut = createHttpClient({ fetch: async () => { throw new DOMException('fixture timeout', 'TimeoutError') } })
  await assert.rejects(timedOut(SOURCES.kafka), error => error instanceof SourceError && error.cause.name === 'TimeoutError')
  const oversized = createHttpClient({ maxBytes: 2, fetch: fixtureFetch() })
  await assert.rejects(oversized(SOURCES.kafka), /size limit/)
  await assert.rejects(createHttpClient({ fetch: async () => new Response('') })(SOURCES.kafka), /Empty response body/)
  await assert.rejects(createHttpClient({ fetch: async () => new Response(new Uint8Array([0xff])) })(SOURCES.kafka), SourceError)
  await assert.rejects(createHttpClient()(SOURCES.kafka), /NETWORK_ERROR/)
})

test('only exact public official endpoints are admitted; redirects cannot reach login or reporter', async () => {
  let called = false
  const http = createHttpClient({ fetch: async () => { called = true; throw new Error('must not call') } })
  for (const url of ['https://reporter.apache.org/', 'https://kafka.apache.org.evil.test/', SOURCES.kafka + '?token=x', 'https://user:password@kafka.apache.org/community/cve-list/', 'http://kafka.apache.org/community/cve-list/', 'https://github.com/login', 'https://api.osv.dev/v1/vulns/CVE-2024-31141']) {
    await assert.rejects(http(url), /Only documented anonymous/)
  }
  assert.equal(called, false)
})

test('requests are serial and a failed request does not poison the queue', async () => {
  let active = 0
  let peak = 0
  let calls = 0
  const http = createHttpClient({ fetch: async () => {
    active++; peak = Math.max(peak, active); calls++
    await Promise.resolve()
    active--
    if (calls === 1) throw new Error('fixture failure')
    return fixtureFetch()(SOURCES.kafka)
  } })
  const results = await Promise.allSettled([http(SOURCES.kafka), http(SOURCES.kafka), http(SOURCES.kafka)])
  assert.deepEqual(results.map(result => result.status), ['rejected', 'fulfilled', 'fulfilled'])
  assert.equal(peak, 1)
  for (const options of [{ timeoutMs: 0 }, { maxBytes: -1 }, { timeoutMs: NaN }]) assert.throws(() => createHttpClient(options), /positive integers/)
})
