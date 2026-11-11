import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHttpClient, HttpError, publicSourceUrl } from '../lib/http.js'
import { SOURCES } from '../lib/fetchers.js'
import './helpers.mjs'

test('source boundary rejects reporter, credentials, ports, non-HTTPS and other hosts before transport', () => {
  const http = createHttpClient({ fetch: async () => { assert.fail('Transport must not be reached') } })
  for (const url of ['https://reporter.apache.org/', 'https://a.reporter.apache.org/', 'https://REPORTER.APACHE.ORG/',
    'http://projects.apache.org/', 'https://example.com/', 'https://user:pass@projects.apache.org/',
    'https://projects.apache.org:8443/', 'https://projects.apache.org.evil.example/']) {
    assert.throws(() => http(url), /forbidden|public ASF/)
  }
  assert.equal(publicSourceUrl(SOURCES.chooser), SOURCES.chooser)
  assert.throws(() => createHttpClient({ timeoutMs: 0 }), /timeout/)
})

test('HTTP failures and injected timeouts surface with URL, with no empty success', async () => {
  const http = createHttpClient({ fetch: async () => new Response('unavailable', { status: 503 }) })
  await assert.rejects(http(SOURCES.releases), error => error instanceof HttpError && error.status === 503 && error.url === SOURCES.releases)
  const timeout = createHttpClient({ fetch: async () => { throw new DOMException('Recorded timeout', 'TimeoutError') } })
  await assert.rejects(timeout(SOURCES.releases), /Fetch failed:.*releases.json: Recorded timeout/)
})

test('429 Retry-After seconds, HTTP date and fallback back off the next request without retrying silently', async () => {
  for (const retryAfter of ['5', 'Wed, 11 Nov 2026 03:00:05 GMT', null, 'invalid', '9'.repeat(30)]) {
    let ms = Date.parse('2026-11-11T03:00:00Z')
    let calls = 0
    const sleeps = []
    const http = createHttpClient({
      now: () => new Date(ms),
      sleep: async duration => { sleeps.push(duration); ms += duration },
      fetch: async () => ++calls === 1
        ? new Response('', { status: 429, headers: retryAfter ? { 'retry-after': retryAfter } : {} })
        : new Response('recorded success'),
    })
    await assert.rejects(http(SOURCES.chooser), error => error instanceof HttpError && error.status === 429 && Boolean(error.retryAt))
    assert.equal(calls, 1)
    assert.deepEqual(sleeps, [])
    const response = await http(SOURCES.chooser)
    assert.equal(response.payload, 'recorded success')
    assert.deepEqual(sleeps, [retryAfter === '5' || retryAfter?.startsWith('Wed,') ? 5000 : 60000])
    assert.equal(response.fetchedAt, new Date(ms).toISOString())
  }
})

test('requests serialize through body consumption and recover after failure', async () => {
  const order = []
  let release
  const gate = new Promise(resolve => { release = resolve })
  const http = createHttpClient({ fetch: async url => {
    order.push(url)
    if (url === SOURCES.chooser) {
      await gate
      throw new Error('Recorded disconnect')
    }
    return new Response('{}')
  } })
  const first = http(SOURCES.chooser)
  const rejected = assert.rejects(first, /Recorded disconnect/)
  const second = http(SOURCES.releases)
  await Promise.resolve()
  assert.deepEqual(order, [SOURCES.chooser])
  release()
  await rejected
  await second
  assert.deepEqual(order, [SOURCES.chooser, SOURCES.releases])
})
