import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { createHttpClient } from '../lib/http.js'

// Any accidental use of the production transport fails before opening a socket.
globalThis.fetch = async () => { throw new Error('Live network disabled in npm test') }

export const manifest = JSON.parse(await readFile(new URL('./fixtures/provenance.json', import.meta.url), 'utf8'))
export const AT = '2026-11-11T08:00:00.000Z'
export const NOW = () => new Date(AT)

export async function document(url) {
  const entry = manifest.find(entry => entry.url === url)
  assert.ok(entry, `Unrecorded URL: ${url}`)
  const payload = await readFile(new URL(`./fixtures/${entry.file}`, import.meta.url), 'utf8')
  assert.equal(createHash('sha256').update(payload).digest('hex'), entry.sha256)
  return { url, payload, fetchedAt: AT }
}

export function fixtureFetch(overrides = new Map()) {
  return async (url, init) => {
    assert.ok(manifest.some(entry => entry.url === url), 'fixture URL must be recorded')
    const override = overrides.get(url)
    if (override) return override(url, init)
    const doc = await document(url)
    return new Response(doc.payload, { headers: { 'Content-Type': url.endsWith('.xml') ? 'application/xml' : 'text/html' } })
  }
}

export const fixtureHttp = () => createHttpClient({ fetch: fixtureFetch(), now: NOW })
