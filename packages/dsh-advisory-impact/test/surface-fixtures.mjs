import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { parse } from 'node-html-parser'
import { SourceCache, OsvClient, createHttpClient, createOsvHttpClient } from '../index.js'
import { SOURCES } from '../lib/http.js'
import { AT, document, fixtureFetch } from './fixture-http.mjs'
import { osvFixtureFetch } from './osv-fixture-http.mjs'

export const kept = ['CVE-2026-114349', 'CVE-2026-112375', 'CVE-2024-31141', 'CVE-2026-35554']
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

export async function setup(t) {
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
export const config = { watch: ['kafka'], pins: [{ project: 'kafka', version: '3.7.0', maven: 'org.apache.kafka:kafka-clients' }], cacheTtlMs: 1000 }
