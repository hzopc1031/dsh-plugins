import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { radarFixtureHttp, fixture } from './helpers.mjs'

export const securityAt = '2026-11-11T08:00:00.000Z'
export const securityNow = () => new Date(securityAt)
export const advisoryManifest = JSON.parse(await fixture('advisory/provenance.json'))
export const osvManifest = JSON.parse(await fixture('advisory/osv-provenance.json'))
for (const item of [...advisoryManifest, ...osvManifest]) {
  const bytes = await fixture(`advisory/${item.file}`)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256)
}
const lookups = JSON.parse(await fixture('advisory/osv-cve-lookups.json'))
export function osvResponse(url) {
  const captured = lookups.find(row => url === `https://api.osv.dev/v1/vulns/${row.id}`)
  assert.ok(captured, `Unrecorded OSV lookup: ${url}`)
  if (captured.error) return { status: 404, payload: '' }
  return { status: captured.http, payload: JSON.stringify({ id: captured.osv_id, summary: captured.summary, aliases: captured.aliases,
    affected: captured.affected.map(a => ({ ...(a.name ? { package: { name: a.name, ecosystem: a.ecosystem } } : {}), versions: a.versions_sample, ranges: a.ranges })) }) }
}
const jiraManifest = JSON.parse(await fixture('jira-provenance.json'))
export function securityHttp({ requests = [], at = securityAt, fail = () => false } = {}) {
  return async url => {
    requests.push(url)
    if (fail(url)) throw new Error('Injected advisory timeout')
    if (url.startsWith('https://api.osv.dev/')) return { url, fetchedAt: at, ...osvResponse(url) }
    const source = advisoryManifest.find(s => s.url === url)
    if (source) return { url, fetchedAt: at, payload: await fixture(`advisory/${source.file}`) }
    const jira = jiraManifest.sources.find(s => s.url === url)
    if (jira) return { url, fetchedAt: at, payload: await fixture(jira.file) }
    return radarFixtureHttp({ at })(url)
  }
}
export async function browserExports() {
  const React = await import('react')
  const { runInNewContext } = await import('node:vm')
  let client
  const loader = { load: entry => { client = entry.factory(name => {
    if (name === 'react') return React
    if (name === '@deepseek-ai/dsh-client-ui-primitives') return { MarkdownText: ({ text }) => React.createElement('pre', null, text) }
    throw new Error('Unshipped client import: ' + name)
  }) } }
  runInNewContext(await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'), { window: { __ModuleLoader__: loader }, URL, Intl })
  return client
}
