import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Socket } from 'node:net'
import { createHttpClient, USER_AGENT } from '../lib/http.js'

// No test can silently fall back to a live endpoint, including through another HTTP library.
globalThis.fetch = async () => { throw new Error('Live fetch forbidden in tests') }
Socket.prototype.connect = function () { throw new Error('Live socket forbidden in tests') }

export const manifest = JSON.parse(await readFile(new URL('./fixtures/provenance.json', import.meta.url), 'utf8'))
export const FETCHED_AT = '2026-11-11T03:00:00.000Z'
export const fixture = file => readFile(new URL(`./fixtures/${file}`, import.meta.url), 'utf8')
export function fixtureHttp() {
  return createHttpClient({
    now: () => new Date(FETCHED_AT),
    fetch: async (url, init) => {
      assert.equal(init.headers['User-Agent'], USER_AGENT)
      assert.equal(init.redirect, 'error')
      assert.equal(init.credentials, 'omit')
      assert.ok(init.signal instanceof AbortSignal)
      const entry = manifest.sources.find(source => source.url === url)
      assert.ok(entry, `No fixture for ${url}`)
      return new Response(await fixture(entry.file))
    },
  })
}
