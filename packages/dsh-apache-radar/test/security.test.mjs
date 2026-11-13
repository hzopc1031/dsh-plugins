import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { runRadar } from '../lib/radar.js'
import { collectSecurity, newAdvisories, announcedTime } from '../lib/security.js'
import { dashboardHandler } from '../lib/dashboard.js'
import { loadFeedCache } from '../lib/feed-cache.js'
import { createHttpClient, publicSourceUrl, USER_AGENT } from '../lib/http.js'
import { parseOsvLookup, rangeDifference } from '../lib/advisory/osv.js'
import { SOURCES, osvUrl } from '../lib/advisory/http.js'
import { securityBrief } from '../lib/brief.js'
import { rollingWindow } from '../lib/feeds.js'
import { apply } from '../index.js'
import { pluginContext, fixture } from './helpers.mjs'
import { securityAt, securityNow as now, securityHttp, osvResponse, browserExports } from './security-fixtures.mjs'

const client = await browserExports()
const staticView = (c, props) => renderToStaticMarkup(React.createElement(c, props))
async function directory(t) {
  const dir = await mkdtemp(join(tmpdir(), 'radar-security-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}
const opts = { now, http: securityHttp() }
const invoke = async (d, a = 'dashboard', args = {}, options = opts) => JSON.parse(await runRadar(d, a, args, options))

// All data claims below come from recorded inventories; parser/error variants are explicitly injected.
test('pin persistence shares watch state, immediately evaluates offline, clears to unknown, and keeps pins through watch edits', async t => {
  const d = await directory(t)
  const requests = []
  const options = { now, http: securityHttp({ requests }) }
  const first = await invoke(d, 'dashboard', { refresh: true }, options)
  assert.ok(first.security.projects.every(p => !p.pin && p.advisories.every(a => a.verdict === 'unknown' && /未填写运行版本/.test(a.reason))))
  assert.ok(requests.includes(SOURCES.kafka) && requests.includes(SOURCES.hadoop) && requests.includes(SOURCES.flink))
  assert.ok(!requests.some(u => u.startsWith('https://api.osv.dev/')), 'no eager historical OSV sweep')
  await invoke(d, 'pin', { project: 'kafka', version: '3.9.0' }, options)
  const size = requests.length
  const read = await invoke(d, 'dashboard', {}, options)
  assert.equal(requests.length, size)
  const kafka = read.security.projects.find(p => p.project === 'kafka')
  assert.equal(kafka.pin, '3.9.0')
  assert.equal(kafka.advisories.find(a => a.id === 'CVE-2025-27818').verdict, 'affected')
  assert.ok(kafka.advisories.some(a => a.verdict === 'not_affected'))
  await invoke(d, 'watch', { operation: 'add', project: 'spark' })
  await invoke(d, 'watch', { operation: 'remove', project: 'hadoop' })
  const state = JSON.parse(await readFile(join(d, '.apache-radar-state.json'), 'utf8'))
  assert.equal(state.pins.kafka, '3.9.0')
  assert.ok(state.advisoryFirstSeen['kafka:CVE-2025-27818'])
  await invoke(d, 'pin', { project: 'kafka', version: '3.9.1' })
  assert.equal((await invoke(d)).security.projects[0].advisories.find(a => a.id === 'CVE-2025-27818').verdict, 'not_affected')
  await invoke(d, 'pin', { project: 'kafka', version: '' })
  assert.ok((await invoke(d)).security.projects[0].advisories.every(a => a.verdict === 'unknown'))
})

test('pin/API trust boundaries reject malformed state, unwatched ids, traversal, symlinks and unsafe OSV lookup ids', async t => {
  const d = await directory(t)
  const handle = dashboardHandler((d, a, args) => runRadar(d, a, args, opts), () => [d])
  const request = body => new Request('http://local/api/apache-radar/dashboard', { method: 'POST', body: JSON.stringify(body) })
  for (const body of [{ action: 'pin', project: '../escape', version: '3.9.0' }, { action: 'pin', project: 'spark', version: '3.9.0' },
    { action: 'pin', project: 'kafka', version: {} }, { action: 'pin', project: 'kafka', version: '3.9.0\n' },
    { action: 'pin', project: 'kafka', version: 'x'.repeat(201) }, { action: 'pin', project: 'kafka', version: '3.9.0', directory: d + '/../bad' },
    { action: 'osv', cve: '../escape' }, { action: 'osv', cve: 'CVE-2099-12345' }]) assert.equal((await handle(request(body))).status, 400)
  const stateFile = join(d, '.apache-radar-state.json')
  for (const value of [{ pins: [] }, { pins: { kafka: null } }, { pins: { '../escape': '1.0' } }, { advisoryFirstSeen: { 'kafka:CVE-2026-12345': 'bad' } }]) {
    await writeFile(stateFile, JSON.stringify(value))
    await assert.rejects(invoke(d, 'pin', { project: 'kafka', version: '3.9.0' }))
  }
  await rm(stateFile)
  const outside = join(d, 'outside')
  await writeFile(outside, '{}')
  await symlink(outside, stateFile)
  assert.equal((await handle(request({ action: 'pin', project: 'kafka', version: '3.9.0' }))).status, 400)
  assert.equal(await readFile(outside, 'utf8'), '{}')
})

test('security JIRA CVE chips only match title ids against the fetched official project inventory, with unavailable/stale context', async () => {
  const report = await collectSecurity(securityHttp(), ['kafka'], {}, {}, { now: now(), cache: new Map() })
  const project = report.projects[0]
  const jira = JSON.parse(await fixture('jira-kafka-rolling.json')).issues.find(i => /CVE-2026-114349/.test(i.fields.summary))
  assert.ok(jira, 'recorded JIRA summary references recorded official advisory')
  const [known] = client.jiraCves(jira.fields.summary, true, project)
  assert.equal(known.label, '官方已公布')
  assert.equal(known.url, project.advisories.find(a => a.id === known.id).url)
  assert.equal(known.fetchedAt, securityAt)
  // Unknown id is a matcher mutation, not an asserted real unpublished CVE.
  assert.equal(client.jiraCves('CVE-2099-12345', true, project)[0].label, '官方尚未公布')
  assert.equal(client.jiraCves('CVE-2099-12345', true)[0].status, 'unknown')
  assert.equal(client.jiraCves(jira.fields.summary, false, project).length, 0)
  assert.equal(client.jiraCves('security issue without an id', true, project).length, 0)
  assert.equal(client.jiraCves('cve-2026-114349 CVE-2026-114349', true, project).length, 1)
  project.source.status = 'stale'
  assert.equal(client.jiraCves(jira.fields.summary, true, project)[0].stale, true)
})

test('overview counts projects, no-pin separately, unsupported sources as incomplete, and never claims a foundation CVE total', async () => {
  const report = await collectSecurity(securityHttp(), ['kafka', 'hadoop', 'flink', 'spark'], { kafka: '3.9.0' }, {}, { now: now(), cache: new Map() })
  const summary = client.securityOverview(report)
  assert.equal(summary.watched, 4)
  assert.equal(summary.affected.length, 1)
  assert.equal(summary.affected[0], 'kafka')
  assert.equal(summary.unpinned, 3)
  assert.equal(summary.incomplete, 1)
  const html = staticView(client.SecurityCard, { report })
  assert.match(html, /3 个未填运行版本/)
  assert.match(html, /运行版本覆盖 1 \/ 4/)
  assert.match(html, /≥1 受影响 · 来源待核对/)
  assert.doesNotMatch(html, /基金会.*CVE|safe to upgrade/)
})

test('weekly new advisories use official date first, persisted first-seen fallback, exact window bounds and no suppressions/OSV inventory', async t => {
  const d = await directory(t)
  await invoke(d, 'pin', { project: 'kafka', version: '3.9.0' })
  const data = await invoke(d, 'dashboard', { refresh: true, saveBrief: true })
  const security = data.security
  const rows = newAdvisories(security, rollingWindow(now()))
  assert.ok(!rows.some(a => a.project === 'kafka' && a.dateBasis === '官方公告日期'), 'recorded Kafka publication dates precede current brief week')
  assert.ok(newAdvisories(security, rollingWindow(new Date('2026-10-28T08:00:00Z'))).some(a => a.project === 'kafka' && a.dateBasis === '官方公告日期'))
  assert.ok(rows.some(a => a.dateBasis === '本地首次发现（非发布日期）'))
  assert.ok(!rows.some(a => a.id === 'CVE-2024-31141'), 'old announced date wins over first local discovery')
  assert.ok(!rows.some(a => security.suppressions.data.suppressions.some(s => s.id === a.id)))
  assert.match(data.markdown, /## 本周新公告/)
  assert.match(securityBrief(security, rollingWindow(new Date('2026-10-28T08:00:00Z'))), /运行版本 3.9.0/)
  assert.match(data.markdown, /运行版本 未填写/)
  assert.match(data.markdown, /官方公告日期/)
  assert.match(data.markdown, /本地首次发现（非发布日期）/)
  assert.match(data.markdown, /https:\/\/security.apache.org\/projects\/flink\/#CVE-/)
  const again = await invoke(d, 'dashboard', { saveBrief: true })
  assert.deepEqual(newAdvisories(again.security, rollingWindow(now())), rows)
  const later = new Date(now().getTime() + 8 * 86400000)
  assert.equal(newAdvisories(security, rollingWindow(later)).length, 0, 'firstSeen is not reset each week')
  assert.equal(announcedTime('18 Nov 2024'), '2024-11-17T16:00:00.000Z')
  assert.equal(announcedTime('2026/01/23'), '2026-01-22T16:00:00.000Z')
  assert.equal(announcedTime('not a date'), undefined)
  assert.equal(announcedTime('2026/02/31'), undefined)
  assert.equal(announcedTime('2023/11/16 (general@hadoop)'), '2023-11-15T16:00:00.000Z')
  const a = security.projects[0].advisories[0]
  const window = rollingWindow(now())
  for (const edge of [window.start, window.end]) assert.equal(newAdvisories({ projects: [{ ...security.projects[0], advisories: [{ ...a, announcedAt: undefined, firstSeen: edge }] }] }, window).length, 1)
  const outside = { ...a, announcedAt: undefined, firstSeen: new Date(Date.parse(window.start) - 1).toISOString() }
  assert.equal(newAdvisories({ projects: [{ ...security.projects[0], advisories: [outside] }] }, window).length, 0)
})

test('suppression section stays collapsed and separate, Flink carries experimental pointer, each visible verdict has link/time', async () => {
  const report = await collectSecurity(securityHttp(), ['kafka', 'flink'], { kafka: '3.9.0' }, {}, { now: now(), cache: new Map() })
  const kafka = report.projects[0]
  const html = staticView(client.SecurityStrip, { project: 'kafka', security: kafka, report, mutate() {}, busy: false, expanded: true })
  assert.match(html, /受影响/)
  assert.match(html, /不受影响/)
  assert.match(html, /官方受影响范围/)
  assert.match(html, /CVE-2023-35116/)
  assert.match(html, /<details class="ar-suppressions"><summary>/)
  assert.match(html, /https:\/\/security.apache.org\/report-dependency\//)
  assert.equal(kafka.advisories.some(a => a.id === 'CVE-2023-35116'), false)
  assert.ok((html.match(/官方原文/g) ?? []).length >= kafka.advisories.length)
  const noPin = staticView(client.SecurityStrip, { project: 'flink', security: report.projects[1], report, mutate() {}, busy: false })
  assert.match(noPin, /运行版本/)
  assert.match(noPin, /value=""/)
  assert.match(noPin, /实验性.*2023.*滞后/)
  assert.match(noPin, /flink.apache.org/)
})

test('shared refresh/TTL caches official sources and on-demand OSV 404, failures preserve last-good and never become zero or not affected', async t => {
  const d = await directory(t)
  const requests = []
  let at = securityAt
  let fail = false
  const options = { now: () => new Date(at), http: async u => securityHttp({ requests, at, fail: () => fail })(u) }
  await invoke(d, 'pin', { project: 'kafka', version: '3.9.0' }, options)
  const first = await invoke(d, 'dashboard', { refresh: true }, options)
  const base = first.security.projects[0].advisories
  await invoke(d, 'osv', { cve: 'CVE-2026-114349' }, options)
  const read = await invoke(d, 'dashboard', {}, options)
  const osv = read.security.projects[0].advisories.find(a => a.id === 'CVE-2026-114349').osv
  assert.equal(osv.data.status, 'not_indexed')
  assert.equal(osv.data.record, null)
  const cache = await loadFeedCache(d)
  assert.equal(cache.get(osvUrl('CVE-2026-114349')).status, 404)
  const length = requests.length
  await invoke(d, 'dashboard', { saveBrief: true }, options)
  assert.equal(requests.length, length)
  at = '2026-11-11T09:00:01.000Z'
  await invoke(d, 'dashboard', { saveBrief: true }, options)
  assert.ok(requests.length > length)
  assert.equal((await loadFeedCache(d)).get(SOURCES.kafka).fetchedAt, at)
  fail = true
  at = '2026-11-11T10:00:02.000Z'
  const failed = await invoke(d, 'dashboard', { refresh: true }, options)
  const stale = failed.security.projects[0]
  assert.equal(stale.source.status, 'stale')
  assert.equal(stale.source.fetchedAt, '2026-11-11T09:00:01.000Z')
  assert.match(stale.source.error, /timeout/)
  assert.deepEqual(stale.advisories.map(a => a.verdict), base.map(a => a.verdict))
  const reloaded = await invoke(d, 'dashboard', {}, options)
  assert.equal(reloaded.security.projects[0].source.status, 'stale')
  assert.match(reloaded.security.projects[0].source.error, /timeout/)
  const emptyDir = await directory(t)
  const empty = await invoke(emptyDir, 'dashboard', { refresh: true }, options)
  assert.equal(empty.security.projects[0].source.status, 'failed')
  const summary = await invoke(emptyDir, 'security', {}, options)
  assert.equal(summary.projects[0].counts, null)
  assert.match(staticView(client.SecurityCard, { report: empty.security }), /—/)
  assert.match(securityBrief(empty.security, rollingWindow(new Date(at))), /失败|timeout/)
})

test('OSV parser, boundary, transport and disagreement remain secondary; 404 absence is durable evidence, not invented data', async () => {
  const requests = []
  const http = createHttpClient({ now, fetch: async (u, init) => {
    requests.push(u)
    assert.equal(init.headers['User-Agent'], USER_AGENT)
    assert.equal(init.redirect, 'manual')
    assert.equal(init.credentials, 'omit')
    assert.ok(init.signal)
    const response = osvResponse(u)
    return new Response(response.payload || null, { status: response.status })
  } })
  const missing = parseOsvLookup('CVE-2026-114349', await http(osvUrl('CVE-2026-114349')))
  assert.equal(missing.label, 'OSV 未收录 / HTTP 404')
  const found = parseOsvLookup('CVE-2024-31141', await http(osvUrl('CVE-2024-31141')))
  assert.equal(found.record.id, 'CVE-2024-31141')
  for (const bad of ['https://api.osv.dev/v1/query', 'https://api.osv.dev/v1/vulns/CVE-2024-31141?x=1', 'https://raw.githubusercontent.com/other/repo/main/x', 'https://security.apache.org/other/', 'https://hadoop.apache.org/login']) assert.throws(() => publicSourceUrl(bad))
  const report = await collectSecurity(securityHttp(), ['kafka'], { kafka: '3.9.0' }, {}, { now: now(), cache: new Map() })
  const official = report.projects[0].advisories.find(a => a.id === 'CVE-2024-31141')
  const before = structuredClone(official)
  assert.equal(rangeDifference(official, { id: official.id, aliases: [], affected: [{ ranges: [{ type: 'ECOSYSTEM', events: [{ introduced: '0' }, { fixed: '1.0' }] }] }] }), true)
  assert.deepEqual(official, before)
  for (const payload of ['{', '{}', '{"id":"wrong"}', '{"id":"CVE-2024-31141","affected":[null]}']) assert.throws(() => parseOsvLookup(official.id, { url: osvUrl(official.id), status: 200, payload, fetchedAt: securityAt }))
  assert.equal(requests.length, 2)
})

test('security tool and command are cache-only summary projections; queue keeps simultaneous watch/pin operations intact', async t => {
  const d = await directory(t)
  await invoke(d, 'dashboard', { refresh: true })
  const agent = { session: { header: { cwd: d } } }
  const host = pluginContext()
  let route
  host.ctx.inject = (_names, setup) => setup({ get: () => ({ fetch: { register: value => { route = value; return async () => {} } } }), effect: setup => setup() })
  apply(host.ctx)
  t.after(() => host.dispose())
  const tool = host.tools.get('apache_radar_security')
  const result = JSON.parse(await tool.execute({ project: 'kafka', query: 'CVE-2025-27818' }, { agent }))
  assert.equal(result.projects[0].advisories.length, 1)
  assert.equal(result.projects[0].advisories[0].verdict, 'unknown')
  assert.doesNotMatch(JSON.stringify(result), /"payload"|"body"|"notes".*allowlist/)
  const command = await host.command.handler({ rawInput: 'security kafka', agent })
  assert.equal(command.kind, 'success')
  assert.match(command.text, /版本与安全/)
  assert.match(command.text, /UTC\+8/)
  assert.equal((await host.command.handler({ rawInput: 'security kafka extra', agent })).kind, 'error')
  assert.equal((await host.command.handler({ rawInput: 'security ../bad', agent })).kind, 'error')
  const request = (project, version) => new Request('http://local/api/apache-radar/dashboard', { method: 'POST', body: JSON.stringify({ action: 'pin', project, version, directory: d }) })
  const results = await Promise.all([route.fetch(request('kafka', '3.9.0')), route.fetch(request('flink', '1.11.2')), host.tools.get('apache_radar_watch').execute({ operation: 'add', project: 'spark' }, { agent })])
  assert.equal(results[0].status, 200)
  assert.equal(results[1].status, 200)
  const state = JSON.parse(await readFile(join(d, '.apache-radar-state.json'), 'utf8'))
  assert.equal(state.pins.kafka, '3.9.0')
  assert.equal(state.pins.flink, '1.11.2')
  assert.ok(state.watchList.includes('spark'))
})
