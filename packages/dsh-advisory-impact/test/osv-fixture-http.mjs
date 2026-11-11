import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { createOsvHttpClient, OSV_QUERY_URL } from '../lib/http.js'
import { NOW } from './fixture-http.mjs'

export const osvManifest = JSON.parse(await readFile(new URL('./fixtures/osv-provenance.json', import.meta.url), 'utf8'))
const artifacts = {}
for (const entry of osvManifest) {
  const bytes = await readFile(new URL(`./fixtures/${entry.file}`, import.meta.url))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256)
  artifacts[entry.file] = JSON.parse(bytes)
}
export const lookups = artifacts['osv-cve-lookups.json']
export const queries = artifacts['osv-queries.json']

// The research preserved API extracts, not raw bodies. Map captured fields only; never fill missing ranges.
export function osvFixtureFetch() {
  return async (url, init) => {
    if (url === OSV_QUERY_URL) {
      assert.equal(init.method, 'POST')
      const body = JSON.parse(init.body)
      const captured = queries.find(q => JSON.stringify(q.query) === JSON.stringify(body))
      assert.ok(captured, 'Unrecorded Maven query')
      return new Response(JSON.stringify({ vulns: captured.ids.map(([id, summary, aliases]) => ({ id, summary, aliases })) }), { status: captured.http })
    }
    assert.equal(init.method, 'GET')
    const captured = lookups.find(row => url === `https://api.osv.dev/v1/vulns/${row.id}`)
    assert.ok(captured, `Unrecorded OSV lookup: ${url}`)
    if (captured.error) {
      assert.equal(captured.error, 'HTTP Error 404: Not Found')
      // No response body was captured for these 404s.
      return new Response(null, { status: 404 })
    }
    return new Response(JSON.stringify({ id: captured.osv_id, summary: captured.summary, aliases: captured.aliases,
      affected: captured.affected.map(a => ({
        ...(a.name ? { package: { name: a.name, ecosystem: a.ecosystem } } : {}),
        versions: a.versions_sample, ranges: a.ranges,
      })),
    }), { status: captured.http })
  }
}
export const osvFixtureHttp = () => createOsvHttpClient({ fetch: osvFixtureFetch(), now: NOW })
