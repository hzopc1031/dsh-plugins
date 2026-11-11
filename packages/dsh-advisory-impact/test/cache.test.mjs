import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm, writeFile, symlink, mkdir } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { SourceCache } from '../index.js'
import { SOURCES, createHttpClient } from '../lib/http.js'
import { parseAdvisories } from '../lib/fetchers.js'
import { AT, fixtureFetch } from './fixture-http.mjs'

async function setup(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'advisory-cache-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  let at = Date.parse(AT), calls = 0, fail = false, bad = false
  const now = () => new Date(at)
  const fixture = fixtureFetch()
  const http = createHttpClient({ now, fetch: async (url, init) => {
    calls++
    if (fail) throw new DOMException('fixture deadline', 'TimeoutError')
    if (bad) return new Response('<html><body>truncated')
    return fixture(url, init)
  } })
  const cache = new SourceCache(dir, http, now)
  return { dir, cache, count: () => calls, tick: ms => { at += ms }, fail: () => { fail = true }, bad: () => { bad = true } }
}
const parse = doc => parseAdvisories('kafka', doc)

test('cache persists URL, fetch time, payload, source timestamp; TTL boundary refetches and restart reuses disk', async t => {
  const s = await setup(t)
  const first = await s.cache.load(SOURCES.kafka, parse, 1000)
  assert.equal(first.state, 'fresh')
  const [name] = await readdir(s.dir)
  const entry = JSON.parse(await readFile(path.join(s.dir, name), 'utf8'))
  assert.equal(entry.url, SOURCES.kafka)
  assert.equal(entry.fetchedAt, AT)
  assert.equal(entry.sourceTimestamp, first.data.sourceTimestamp)
  assert.match(entry.payload, /<html/)
  s.tick(999)
  assert.equal((await s.cache.load(SOURCES.kafka, parse, 1000)).state, 'cached')
  assert.equal(s.count(), 1)
  const restarted = new SourceCache(s.dir, async () => { throw new Error('must use persisted cache') }, () => new Date(AT))
  assert.deepEqual((await restarted.load(SOURCES.kafka, parse, 1000)).data, first.data)
  s.tick(1)
  const expired = await s.cache.load(SOURCES.kafka, parse, 1000)
  assert.equal(expired.state, 'fresh')
  assert.equal(expired.fetchedAt, '2026-11-11T08:00:01.000Z')
  assert.equal(s.count(), 2)
  await s.cache.load(SOURCES.kafka, parse, 1000, true)
  assert.equal(s.count(), 3)
  await s.cache.load(SOURCES.kafka, parse, 0)
  assert.equal(s.count(), 4)
})

test('fetch timeout and malformed fresh payload preserve last good bytes and evidence time', async t => {
  for (const failure of ['fail', 'bad']) {
    const s = await setup(t)
    const first = await s.cache.load(SOURCES.kafka, parse, 1)
    const [name] = await readdir(s.dir)
    const before = await readFile(path.join(s.dir, name), 'utf8')
    s.tick(2); s[failure]()
    const result = await s.cache.load(SOURCES.kafka, parse, 1)
    assert.equal(result.state, 'stale')
    assert.deepEqual(result.data, first.data)
    assert.equal(result.fetchedAt, AT)
    assert.match(result.error, failure === 'fail' ? /fixture deadline/ : /truncated/)
    assert.equal(await readFile(path.join(s.dir, name), 'utf8'), before)
  }
})

test('no last-good payload yields explicit failure with null data, never an empty inventory', async t => {
  const s = await setup(t)
  s.fail()
  const result = await s.cache.load(SOURCES.kafka, parse, 1000)
  assert.equal(result.state, 'error')
  assert.equal(result.data, null)
  assert.equal(result.fetchedAt, undefined)
  assert.match(result.error, /fixture deadline/)
  assert.deepEqual(await readdir(s.dir), [])
  for (const ttl of [-1, NaN, 0.1]) await assert.rejects(s.cache.load(SOURCES.kafka, parse, ttl), /TTL/)
})

test('corrupt/future cache is surfaced/refetched, and symlink cache files are never followed', async t => {
  const s = await setup(t)
  await s.cache.load(SOURCES.kafka, parse, 1000)
  const [name] = await readdir(s.dir)
  const entry = JSON.parse(await readFile(path.join(s.dir, name), 'utf8'))
  await writeFile(path.join(s.dir, name), JSON.stringify({ ...entry, fetchedAt: '2099-01-01T00:00:00Z' }))
  assert.equal((await s.cache.load(SOURCES.kafka, parse, 1000)).state, 'fresh')
  await writeFile(path.join(s.dir, name), '{corrupt')
  const corrupt = await s.cache.load(SOURCES.kafka, parse, 1000)
  assert.equal(corrupt.state, 'fresh')
  assert.ok(corrupt.cacheError)
  const outside = path.join(s.dir, 'outside')
  await mkdir(outside)
  const victim = path.join(outside, 'victim.json')
  await writeFile(victim, 'keep me')
  await rm(path.join(s.dir, name))
  await symlink(victim, path.join(s.dir, name))
  const linked = await s.cache.load(SOURCES.kafka, parse, 1000)
  assert.equal(linked.state, 'fresh')
  assert.ok(linked.cacheError)
  assert.equal(await readFile(victim, 'utf8'), 'keep me')
  assert.equal(s.count(), 4)
})
