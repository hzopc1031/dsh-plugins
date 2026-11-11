import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { dashboardHandler, registerDashboard } from '../lib/dashboard.js'
import { runRadar } from '../lib/radar.js'
import { fixture, radarFixtureHttp } from './helpers.mjs'

let client
const loader = { load: entry => { client = entry.factory(name => {
  if (name === 'react') return React
  if (name === '@deepseek-ai/dsh-client-ui-primitives') return { MarkdownText: ({ text }) => React.createElement('pre', null, text) }
  throw new Error('Unshipped client import: ' + name)
}) } }
runInNewContext(await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'), { window: { __ModuleLoader__: loader }, URL, Intl })
const staticView = (component, props) => renderToStaticMarkup(React.createElement(component, props))
const request = body => new Request('http://localhost/api/apache-radar/dashboard', { method: 'POST', body: JSON.stringify(body) })

const jiraManifest = JSON.parse(await fixture('jira-provenance.json'))
const now = () => new Date(jiraManifest.window.end)
async function recordedHttp(url) {
  const jira = jiraManifest.sources.find(source => source.url === url)
  return jira ? { url, payload: await fixture(jira.file), fetchedAt: jira.fetchedAt } : radarFixtureHttp({ at: now().toISOString() })(url)
}

test('dashboard opens offline, shares configured watch state, forces explicit refresh, and returns linked summaries without bodies', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'radar-dashboard-'))
  const requests = []
  const options = { now, http: async url => { requests.push(url); return { ...await recordedHttp(url), fetchedAt: new Date(now().getTime() + 50).toISOString() } } }
  try {
    const empty = JSON.parse(await runRadar(directory, 'dashboard', {}, options))
    assert.equal(empty.empty, true)
    assert.deepEqual(empty.watchList, ['kafka', 'hadoop', 'flink'])
    assert.equal(requests.length, 0)
    const first = JSON.parse(await runRadar(directory, 'dashboard', { refresh: true }, options))
    assert.equal(first.counts.counts[0].status, 'ok')
    assert.ok(first.items.some(i => i.security && i.kind === 'jira'))
    assert.ok(first.items.every(i => i.url.startsWith('https://') && !('body' in i) && !('description' in i)))
    const length = requests.length
    const cached = JSON.parse(await runRadar(directory, 'dashboard', {}, { ...options, now: () => new Date(now().getTime() + 100) }))
    assert.ok(cached.sources.every(s => s.status !== 'stale'), 'responses fetched after collection start are fresh at read time')
    assert.equal(requests.length, length)
    assert.deepEqual(cached.items, first.items)
    assert.equal(cached.window.end, first.window.end)
    await runRadar(directory, 'dashboard', { refresh: true }, options)
    assert.ok(requests.length > length, 'refresh bypasses a still-fresh cache')
    const saved = JSON.parse(await runRadar(directory, 'dashboard', { saveBrief: true }, options))
    assert.match(saved.markdown, /Apache.*周报/)
    assert.equal(saved.markdown, JSON.parse(await runRadar(directory, 'open', { includeMarkdown: true }, options)).markdown)
    await runRadar(directory, 'watch', { operation: 'add', project: 'spark' }, options)
    assert.ok(JSON.parse(await runRadar(directory, 'dashboard', {}, options)).watchList.includes('spark'))
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('dashboard failure retains last-good source times, errors, mismatch evidence and the saved brief; empty failures never become zero', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'radar-dashboard-stale-'))
  try {
    const data = JSON.parse(await runRadar(directory, 'dashboard', { refresh: true, saveBrief: true }, { now, http: recordedHttp }))
    const failedOptions = { now: () => new Date(now().getTime() + 7_200_000), http: async () => { throw new Error('Injected outage') } }
    const stale = JSON.parse(await runRadar(directory, 'dashboard', { refresh: true }, failedOptions))
    assert.equal(stale.counts.counts[0].value, data.counts.counts[0].value)
    assert.equal(stale.counts.counts[0].sources[0].fetchedAt, data.counts.counts[0].sources[0].fetchedAt)
    assert.equal(stale.counts.counts[0].sources[0].cacheStatus, 'stale')
    assert.match(stale.counts.counts[0].sources[0].cacheError, /Injected outage/)
    assert.ok(stale.sources.some(s => s.status === 'stale' && /Injected outage/.test(s.error)))
    assert.equal(stale.markdown, data.markdown)
    assert.deepEqual(stale.counts.comparisons[4].onlyLeft, data.counts.comparisons[4].onlyLeft)
    const offline = JSON.parse(await runRadar(directory, 'dashboard', {}, failedOptions))
    assert.ok(offline.sources.some(s => s.status === 'stale'))
    const fresh = await mkdtemp(join(tmpdir(), 'radar-dashboard-failure-'))
    try {
      const missing = JSON.parse(await runRadar(fresh, 'dashboard', { refresh: true }, failedOptions))
      assert.equal(missing.counts.counts[0].status, 'error')
      assert.equal(missing.counts.counts[0].value, undefined)
    } finally { await rm(fresh, { recursive: true, force: true }) }
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('native slot registrations use a model-independent main panel, sidebar label and unload-owned callbacks', () => {
  const entries = [], disposers = []
  const ctx = { slots: {
    inject: (slot, setup) => { assert.ok(['main', 'sidebar.panellist'].includes(slot)); const dispose = setup(); disposers.push(dispose); return dispose },
    register: (options, component) => { const entry = { options, component }; entries.push(entry); return () => entries.splice(entries.indexOf(entry), 1) },
  } }
  client.apply(ctx)
  assert.equal(entries[0].options.key, 'apache-radar')
  assert.equal(entries[0].component, client.Dashboard)
  assert.equal(entries[1].options.id, 'apache-radar')
  assert.equal(entries[1].options.label(), 'Apache 雷达')
  assert.match(staticView(client.Dashboard, {}), /无需模型/)
  for (const dispose of disposers) dispose()
  assert.equal(entries.length, 0)
})

test('authenticated host route is optional, exact, effect-owned; directory and action boundaries reject malformed input and symlinks', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'radar-dashboard-route-'))
  const registrations = []
  let disposed = false
  const run = (d, a, args) => runRadar(d, a, args, { now, http: recordedHttp })
  try {
    const scope = { get: name => { assert.equal(name, 'connection'); return { fetch: { register: route => { registrations.push(route); return async () => { disposed = true } } } } }, effect: setup => setup() }
    let dispose
    registerDashboard({ inject: (services, setup) => { assert.deepEqual(services, ['connection']); const original = scope.effect; scope.effect = fn => { dispose = original(fn) }; setup(scope) } }, run, () => [directory])
    assert.equal(registrations[0].path, '/api/apache-radar/dashboard')
    assert.deepEqual(registrations[0].methods, ['POST'])
    const handle = registrations[0].fetch
    const opened = await handle(request({}))
    assert.equal(opened.headers.get('cache-control'), 'no-store')
    assert.equal((await opened.json()).directory, directory)
    for (const body of [null, [], { action: 'invent' }, { action: ['read'] }, { action: null }, { directory: '../bad' }, { directory: '/tmp/../bad' }, { key: 'unknown' }, { action: 'add', project: '../bad' }, { action: 'remove' }]) {
      assert.equal((await handle(request(body))).status, 400)
    }
    await symlink(directory, join(directory, 'alias'))
    assert.equal((await handle(request({ directory: join(directory, 'alias') }))).status, 400)
    assert.equal((await handle(new Request('http://localhost/api/apache-radar/dashboard', { method: 'POST', body: '{' }))).status, 400)
    await handle(request({ action: 'brief' }))
    const file = await handle(request({ action: 'file' }))
    assert.match(file.headers.get('content-type'), /text\/markdown/)
    assert.match(await file.text(), /Apache.*周报/)
    const absent = dashboardHandler(run, () => [])
    assert.deepEqual(await (await absent(request({}))).json(), { directories: [] })
    assert.equal((await absent(request({ action: 'refresh' }))).status, 400)
    await dispose()
    assert.equal(disposed, true)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('view shaping retains security, type/status groups, original links, retired mismatches, absent HIP and saved Markdown sections', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'radar-dashboard-view-'))
  try {
    const data = JSON.parse(await runRadar(directory, 'dashboard', { refresh: true, saveBrief: true }, { now, http: recordedHttp }))
    data.directories = [directory]; data.directory = directory
    const groups = client.groupIssues(data.items.filter(i => i.project === 'kafka'))
    assert.equal(groups[0].label, '安全')
    assert.ok(groups[0].items.every(i => i.security))
    assert.equal(groups.flatMap(g => g.items).length, data.items.filter(i => i.project === 'kafka' && i.kind === 'jira').length)
    const overview = staticView(client.Overview, { data })
    assert.match(overview, /存在差异/)
    assert.match(overview, /Attic 子项目/)
    assert.match(overview, /flume/i)
    assert.match(overview, /https:\/\/whimsy.apache.org\/public\/committee-info.json/)
    assert.match(overview, /2026-11-11/)
    assert.doesNotMatch(overview, /undefined|NaN/)
    const watch = staticView(client.Watch, { data, busy: false, mutate: () => {} })
    assert.match(watch, /安全 · JIRA/)
    assert.match(watch, /https:\/\/issues.apache.org\/jira\/browse\/KAFKA-/)
    assert.match(watch, /展开其余条目/)
    const hadoop = staticView(client.Watch, { data: { ...data, watchList: ['hadoop'] }, busy: false, mutate: () => {} })
    assert.match(hadoop, /Hadoop 没有已验证的通用 HIP 索引/)
    assert.ok(client.briefSections(data.markdown).length >= 3)
    assert.equal(client.briefSections('').length, 0)
    assert.match(staticView(client.Brief, { data, busy: false, request: () => {} }), /复制 Markdown/)
    const errorCard = staticView(client.CountCard, { row: { id: 'failed', label: 'failed', status: 'error', error: '上游失败', sources: [{ url: 'https://projects.apache.org/json/foundation/chooser.json', fetchedAt: null }], note: '' } })
    assert.match(errorCard, /—/)
    assert.match(errorCard, /尚未成功抓取/)
    assert.doesNotMatch(errorCard, />0</)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
