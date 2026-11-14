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
  if (name === '@deepseek-ai/dsh-client-ui-primitives') return {
    Button: ({ variant, size, ...props }) => React.createElement('button', { type: 'button', ...props }),
    Input: props => React.createElement('input', props),
    Tag: ({ tone, ...props }) => React.createElement('span', { ...props, 'data-tone': tone }),
    Tooltip: ({ children, label }) => React.cloneElement(children, { 'data-tooltip-label': label }),
    SegmentedControl: ({ id, value, options, onChange, label }) => React.createElement('div', { role: 'tablist', 'aria-label': label }, options.map(option => React.createElement('button', { key: option.value, role: 'tab', id: `${id}-${option.value}`, 'aria-selected': value === option.value, onClick: () => onChange(option.value) }, option.label))),
    SegmentedTabs: ({ items, value, onChange, label }) => React.createElement('div', { role: 'tablist', 'aria-label': label }, items.map(item => React.createElement('button', { key: item.value, role: 'tab', 'aria-selected': value === item.value, onClick: () => onChange(item.value) }, item.label))),
    MarkdownText: ({ text }) => React.createElement('pre', null, text),
  }
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
    inject: (slot, setup) => { assert.ok(['main', 'sidebar.panellist', 'plugins.row.config'].includes(slot)); const dispose = setup(); disposers.push(dispose); return dispose },
    register: (options, component) => { const entry = { options, component }; entries.push(entry); return () => entries.splice(entries.indexOf(entry), 1) },
  } }
  client.apply(ctx)
  assert.equal(entries[0].options.key, 'apache-radar')
  assert.equal(entries[0].component, client.Dashboard)
  assert.equal(entries[1].options.id, 'apache-radar')
  assert.equal(entries[1].options.label(), 'Apache 雷达')
  assert.equal(entries[2].options.key, 'dsh-apache-radar#apache-radar')
  const settings = staticView(entries[2].component, { view: 'page', form: { state: { value: {}, writable: true } } })
  assert.match(settings, /不安全：仅跳过 OSV \/ GitHub API 证书校验/)
  assert.match(settings, /type="checkbox"/)
  assert.doesNotMatch(settings, /checked=/)
  assert.doesNotMatch(staticView(client.Dashboard, {}), /无需模型|官方公开来源|口径与来源/)
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


test('feed cards distinguish missing, unavailable and stale sources from an empty successful feed', () => {
  const source = (kind, status, warnings = []) => ({ kind, status, warnings })
  assert.equal(client.feedDisplay([], 'release', 0).count, '—')
  assert.equal(client.feedDisplay([source('release', 'failed')], 'release', 0).label, '来源不可用')
  assert.equal(client.feedDisplay([source('proposal', 'unavailable', ['无适配来源'])], 'proposal', 0).empty, '无适配来源')
  assert.equal(client.feedDisplay([source('jira', 'stale')], 'jira', 4).label, '上次成功缓存')
  assert.equal(client.feedDisplay([source('jira', 'ok')], 'jira', 0).count, '0')
})

test('failed count cards show a short status, leaving the shared diagnostics banner to explain the cause', () => {
  const html = staticView(client.CountCard, { row: { id: 'chooser', label: 'Chooser', status: 'error', sources: [],
    error: 'https://projects.apache.org/json/foundation/chooser.json: Fetch failed: ECONNREFUSED; HTTPS_PROXY' } })
  assert.match(html, /网络 \/ 设置/)
  assert.doesNotMatch(html, /HTTPS_PROXY|https:\/\/|Fetch failed/)
})

test('system detect/redetect/apply/clear actions reach only the explicit proxy handler', async () => {
  const calls=[]
  const handler=dashboardHandler(()=>assert.fail('not a feed request'),()=>[],async action=>{calls.push(action);return {source:'Windows PAC',proxy:'http://proxy:8080/',timeoutSeconds:30}})
  for(const action of ['detect-proxy','redetect-proxy','apply-proxy','clear-proxy']){
    const result=await handler(request({action}))
    assert.equal(result.status,200);assert.equal((await result.json()).timeoutSeconds,30)
  }
  assert.deepEqual(calls,['detect-proxy','redetect-proxy','apply-proxy','clear-proxy'])
})

test('main actions stay small; advanced controls and host form are inside a closed network disclosure', async () => {
  const { parse } = await import('node-html-parser')
  const root = parse(staticView(client.Dashboard, {}))
  const settings = root.querySelector('details.ar-network')
  assert.ok(settings)
  assert.equal(settings.hasAttribute('open'), false)
  const toolbar = root.querySelector('[aria-label="日常操作"]')
  assert.deepEqual(toolbar.querySelectorAll('button').map(b => b.textContent.trim()), ['打开', '↻ 正在读取…'])
  for (const label of ['从系统检测代理', '网络诊断', '导出快照', '导入快照']) assert.ok(settings.textContent.includes(label), label)
  assert.ok(!toolbar.textContent.includes('网络诊断'))
})

test('weak CA UI is a single actionable sentence while the transport keeps its complete hint', async () => {
  const { networkHint } = await import('../lib/network-settings.js')
  const { WEAK_CA_HINT } = await import('../lib/intranet-http.js')
  const hint = networkHint('TLS_KEY_TOO_SMALL')
  assert.match(hint, /公司证书密钥过短.*网络 \/ 设置.*OSV \/ GitHub API/)
  assert.ok(hint.length < 80)
  assert.doesNotMatch(hint, /\n/)
  assert.match(WEAK_CA_HINT, /导入 CA 证书解决不了/)
})


test('JIRA merges statuses into friendly type groups, preserves unknown types and keeps security first', () => {
  const items = [
    { kind: 'jira', issueType: 'Bug', statusText: 'Open' },
    { kind: 'jira', issueType: 'Bug', statusText: 'Resolved' },
    { kind: 'jira', issueType: 'Improvement' },
    { kind: 'jira', issueType: 'New Feature' },
    { kind: 'jira', issueType: 'Task' },
    { kind: 'jira', issueType: 'Future Type' },
    { kind: 'jira' },
    { kind: 'jira', security: true, issueType: 'Bug' },
    { kind: 'release' },
  ]
  const groups = client.groupIssues(items)
  assert.equal(groups[0].label, '安全')
  assert.equal(groups.find(g => g.label === '缺陷').items.length, 2)
  for (const label of ['改进', '新功能', '任务', 'Future Type', '其他']) assert.ok(groups.some(g => g.label === label))
  assert.ok(groups.every(g => !g.label.includes(' · ')))
  assert.equal(groups.flatMap(g => g.items).length, 8)
})

test('overview chart exposes counts with bounded member previews and no list disclosures or visible provenance', async () => {
  const { parse } = await import('node-html-parser')
  const directory = await mkdtemp(join(tmpdir(), 'radar-chart-'))
  try {
    const data = JSON.parse(await runRadar(directory, 'dashboard', { refresh: true }, { now, http: recordedHttp }))
    const root = parse(staticView(client.Overview, { data }))
    const chart = root.querySelector('[aria-label="领域分布横条图"]')
    assert.ok(chart)
    assert.equal(chart.querySelectorAll('details').length, 0)
    assert.equal(chart.querySelectorAll('.ar-category-bar').length, data.counts.categories.rows.length)
    for (const row of chart.querySelectorAll('.ar-category-bar')) {
      assert.ok(row.querySelector('strong').textContent.trim())
      assert.match(row.getAttribute('data-tooltip-label'), /多标签不合计/)
      assert.match(row.getAttribute('data-tooltip-label'), /projects.apache.org/)
      assert.ok(!row.textContent.includes('Apache '))
    }
    assert.doesNotMatch(root.textContent, /无需模型|官方公开来源|口径与来源|官方多标签/)
    assert.equal(root.querySelector('.ar-methodology').hasAttribute('open'), false)
    assert.equal(root.querySelector('.ar-metric details'), null)
    assert.ok(root.querySelector('.ar-metric[tabindex="0"][data-tooltip-label]'))
    const watch = parse(staticView(client.Watch, { data, mutate: () => {}, busy: false }))
    assert.ok(watch.querySelector('[aria-label="JIRA 类型分布"] .ar-stacked'))
    assert.ok(watch.querySelector('.ar-issue-group[open] summary').textContent.includes('安全'))
    assert.doesNotMatch(watch.querySelector('.ar-issue-board').textContent, /Bug ·|Improvement ·|New Feature ·|Patch Available/)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('Radar keeps shared TLS help hidden and supplies an accessible host tooltip instead', async () => {
  const { parse } = await import('node-html-parser')
  const root = parse(staticView(client.Dashboard, {}))
  assert.match(root.querySelector('style').textContent, /\.ar-network-body \.ns-settings>small\{display:none\}/)
  const help = root.querySelector('[aria-label="证书校验说明"]')
  assert.ok(help)
  assert.match(help.getAttribute('data-tooltip-label'), /api.osv.dev \/ api.github.com/)
  assert.ok(!root.querySelector('.ar-network').textContent.includes('示例代理'))
})


test('brief project counts exclude undated references and preserve empty window context', async () => {
  const { parse } = await import('node-html-parser')
  const line = '- **提案** Example；[原文](https://cwiki.apache.org/example)；日期：未知\n'
  const markdown = '## 关注项目动态\n\n### kafka\n\n' + line + '\n#### 日期未知参考项（不计作本周新增）\n\n' + line + line + '\n\n### flink\n\n已采集数据未列出窗口内条目。\n\n#### 日期未知参考项（不计作本周新增）\n\n' + line
  const root = parse(staticView(client.Brief, { data: { markdown }, busy: false, request: () => {} }))
  const cards = root.querySelectorAll('.ar-brief-project')
  assert.match(cards[0].querySelector('.ar-card-heading').textContent, /1 条窗口内/)
  assert.match(cards[0].textContent, /另有 2 条日期未知的参考项/)
  assert.match(cards[1].querySelector('.ar-card-heading').textContent, /0 条窗口内/)
  assert.match(cards[1].textContent, /请结合来源状态查看/)
})

test('saved brief cards present friendly chips and short dates while keeping complete Markdown behind details', async () => {
  const { parse } = await import('node-html-parser')
  const markdown = '## 关注项目动态\n\n### kafka\n\n- **JIRA 工单** Fix example；[原文](https://issues.apache.org/jira/browse/KAFKA-1)；日期：2026-11-11T03:43:11.000+0000（updated）；状态：Open；类型：Bug；[采集来源](https://issues.apache.org/jira/)\n'
  const root = parse(staticView(client.Brief, { data: { markdown }, busy: false, request: () => {} }))
  const item = root.querySelector('.ar-item')
  assert.match(item.textContent, /缺陷/)
  assert.match(item.textContent, /待处理/)
  assert.match(item.textContent, /2026-11-11/)
  assert.doesNotMatch(item.textContent, /updated|03:43|采集来源/)
  assert.doesNotMatch(root.querySelector('.ar-brief-more').textContent, /03:43/)
  assert.match(root.querySelector('.ar-brief-more').textContent, /查看完整项目简报/)
  assert.equal(root.querySelector('.ar-brief-more').hasAttribute('open'), false)
})
