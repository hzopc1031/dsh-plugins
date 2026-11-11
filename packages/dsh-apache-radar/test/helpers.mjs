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

export function pluginContext(agents = []) {
  const tools = new Map()
  const events = new Map()
  const disposers = []
  let command, guard
  const ctx = {
    inject: () => {},
    effect: setup => { const dispose = setup(); disposers.push(dispose); return dispose },
    commands: { register: value => { command = value; return () => { command = undefined } } },
    tools: {
      register: tool => { tools.set(tool.name, tool); return () => tools.delete(tool.name) },
      guard: value => { guard = value; return () => { guard = undefined } },
      restrict: () => { throw new Error('restrict must use agent.ctx') },
    },
    agents: { list: () => agents },
    on: (name, handler) => {
      events.set(name, handler)
      disposers.push(() => events.delete(name))
    },
  }
  return { ctx, tools, events, get command() { return command }, get guard() { return guard },
    dispose: () => { for (const dispose of disposers.reverse()) dispose?.() },
  }
}

export function radarFixtureHttp({ at = FETCHED_AT, requests = [], fail = () => false } = {}) {
  return async url => {
    requests.push(url)
    if (fail(url)) throw new Error(`Injected timeout: ${url}`)
    const feedManifest = JSON.parse(await fixture('feed-provenance.json'))
    let source = [...manifest.sources, ...feedManifest.sources].find(s => s.url === url)
    // Replays a recorded historical Kafka query body; it is not a recorded rolling-query response.
    if (!source && new URL(url).pathname.endsWith('/search') && new URL(url).searchParams.get('jql')?.startsWith('project in (KAFKA)')) {
      source = feedManifest.sources.find(s => s.file === 'jira-kafka-newfeature.json')
    }
    if (!source) throw new Error('No recorded response fixture for this source')
    return { url, fetchedAt: at, payload: await fixture(source.file) }
  }
}
