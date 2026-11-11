import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { Context, Service } from '@deepseek-ai/cordis'
import Tools from '@deepseek-ai/dsh-tools'
import { createScope, scopeOf } from '@deepseek-ai/dsh-scope'
import * as plugin from '../index.js'
import { TOOL_NAMES } from '../lib/tools.js'
import { fixtureFetch } from './fixture-http.mjs'
import { osvFixtureFetch } from './osv-fixture-http.mjs'

async function host(t, config = {}, web = false) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'advisory-host-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  t.mock.method(os, 'homedir', () => root)
  const official = fixtureFetch(), osv = osvFixtureFetch(), calls = []
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push(url)
    return url.startsWith('https://api.osv.dev/') ? osv(url, init) : official(url, init)
  })
  const ctx = new Context(), disposals = [], agents = [], definitions = new Map(), guards = [], restrictions = []
  class Prompt extends Service {
    constructor(ctx) { super(ctx, 'systemPrompt') }
    tools() { return () => {} }
    section() { return () => {} }
    getSectionOrder() { return 1 }
  }
  class Agents extends Service {
    constructor(ctx) { super(ctx, 'agents') }
    list() { return agents }
  }
  class Commands extends Service {
    constructor(ctx) { super(ctx, 'commands') }
    register(definition) { definitions.set(definition.name, definition); return () => definitions.delete(definition.name) }
  }
  const routes = new Map()
  class WebServer extends Service {
    constructor(ctx) { super(ctx, 'webServer') }
    register(route) { routes.set(route.path, route); return () => routes.delete(route.path) }
  }
  class Connection extends Service {
    constructor(ctx) { super(ctx, 'connection') }
    requestRejection() { return undefined }
  }
  const originalGuard = Tools.prototype.guard, originalRestrict = Tools.prototype.restrict
  t.mock.method(Tools.prototype, 'guard', function (guard) {
    guards.push({ owner: scopeOf(this.ctx), guard })
    return originalGuard.call(this, guard)
  })
  t.mock.method(Tools.prototype, 'restrict', function (filter) {
    restrictions.push({ owner: scopeOf(this.ctx), filter })
    return originalRestrict.call(this, filter)
  })
  for (const dependency of [Prompt, Tools, Agents, Commands]) disposals.push(await ctx.plugin(dependency))
  if (web) for (const dependency of [WebServer, Connection]) disposals.push(await ctx.plugin(dependency))
  let scope
  const agent = { session: { header: { cwd: root } } }
  disposals.push(await ctx.plugin(Object.assign(inner => { scope = createScope(inner, agent); agent.ctx = scope.ctx }, { inject: ['tools'] })))
  agents.push(agent)
  const fork = await ctx.plugin(plugin, config)
  await new Promise(resolve => setImmediate(resolve))
  t.after(async () => {
    await fork.dispose()
    await scope.dispose()
    for (const item of disposals.reverse()) await item.dispose()
  })
  const command = (rawInput, signal = new AbortController().signal) => definitions.get('advisory-impact').handler({ agent, rawInput, signal })
  const execute = async (name, args = {}, caller = agent) => {
    const definition = ctx.tools.get(name, caller)
    const exec = { agent: caller, name, arguments: args, signal: new AbortController().signal }
    const reason = guards.filter(g => g.owner === caller).map(g => g.guard(exec)).find(Boolean)
    if (reason) throw new Error(reason)
    return JSON.parse(await definition.execute(args, exec))
  }
  return { ctx, root, agent, definitions, fork, command, execute, calls, guards, restrictions, routes }
}

test('web profile registers and disposes the native panel host route without fetching or requiring a chat turn', async t => {
  const h = await host(t, {}, true)
  assert.equal(h.routes.get('/advisory-impact/api').kind, 'exact')
  assert.deepEqual(h.calls, [])
  await h.fork.dispose()
  assert.equal(h.routes.size, 0)
})

test('bundle registers Chinese-first help with every required caveat, no locale assumption or network call', async t => {
  assert.equal(plugin.name, 'advisory-impact')
  assert.deepEqual(plugin.inject, ['commands', 'tools', 'agents'])
  const h = await host(t)
  const definition = h.definitions.get('advisory-impact')
  assert.equal(definition.recordInput, false)
  assert.ok(definition.input.hint.includes('lookup'))
  const result = await h.command('')
  assert.equal(result.kind, 'success')
  for (const text of ['官方页面', '第二来源', 'HTTP 404', 'suppressions', '自行填写', 'Kafka / Hadoop / Flink', '未填写运行版本，无法判断', '无需模型调用', '实验性', '2023', '滞后', 'lockfile', '原生面板']) assert.ok(result.text.includes(text), text)
  assert.deepEqual(h.calls, [])
  assert.equal((await h.command('help')).text, result.text)
  assert.equal((await h.command('unknown')).kind, 'error')
  assert.equal((await h.command('pin kafka')).kind, 'error')
  assert.equal((await h.command('pin kafka 3.7.0 extra=true')).kind, 'error')
  const zh = JSON.parse(await readFile(new URL('../locale/zh.json', import.meta.url), 'utf8'))
  const en = JSON.parse(await readFile(new URL('../locale/en.json', import.meta.url), 'utf8'))
  const keys = (object, prefix = '') => Object.entries(object).flatMap(([k, v]) => typeof v === 'object' ? keys(v, prefix + k + '.') : [prefix + k]).sort()
  assert.deepEqual(keys(zh), keys(en))
  await h.fork.dispose()
  assert.equal(h.definitions.size, 0)
  assert.equal(h.ctx.tools.get('advisory_impact_pin', h.agent), undefined)
})

test('actual scoped tool registry uses restrict plus guard, confines callers, and preserves unrelated tools', async t => {
  const h = await host(t, { watch: ['kafka'] })
  assert.ok(h.restrictions.some(r => r.owner === h.agent && JSON.stringify(r.filter.deny) === JSON.stringify(TOOL_NAMES)))
  assert.ok(h.guards.some(g => g.owner === h.agent))
  assert.throws(() => h.ctx.tools.restrict({ deny: [] }), /scoped context/)
  for (const name of TOOL_NAMES) {
    assert.ok(h.ctx.tools.get(name, h.agent))
    await assert.rejects(h.ctx.tools.get(name).execute({}, { name, signal: new AbortController().signal }), /agent.ctx|invalid arguments/)
  }
  h.ctx.tools.register({ name: 'unrelated_tool', description: 'test only', parameters: { type: 'object', properties: {} },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] }, execute: async () => 'ok' })
  assert.ok(h.ctx.tools.get('unrelated_tool', h.agent))
  await assert.rejects(h.execute('advisory_impact_pin', { project: 'kafka', version: '3.7.0', directory: '../outside' }), /声明参数/)
  await assert.rejects(h.execute('advisory_impact_report', { path: '../outside.md' }), /声明参数/)
  await assert.rejects(h.execute('advisory_impact_pin', { version: '3.7.0' }), /project/)
  const scoped = h.ctx.tools.get('advisory_impact_pin', h.agent)
  await assert.rejects(scoped.execute({}, { agent: { session: h.agent.session }, name: scoped.name, signal: new AbortController().signal }), /作用域不匹配/)
  h.agent.session.header.cwd = `${h.root}/../outside`
  await assert.rejects(h.execute('advisory_impact_pin'), /绝对路径/)
})

test('command and tools pin/watch/refresh/report/open/lookup operate against recorded fixtures with compact defaults', async t => {
  const h = await host(t, { watch: ['kafka'] })
  assert.match((await h.command('pin')).text, /"pins": \[\]/)
  assert.equal((await h.command('pin kafka 3.7.0 component=kafka-clients maven=org.apache.kafka:kafka-clients')).kind, 'success')
  assert.equal((await h.execute('advisory_impact_pin')).pins[0].version, '3.7.0')
  assert.equal((await h.command('watch kafka,hadoop')).kind, 'success')
  assert.deepEqual((await h.execute('advisory_impact_watch')).watch, ['kafka', 'hadoop'])
  await h.execute('advisory_impact_watch', { watch: ['kafka'] })
  const single = await h.command('lookup CVE-2024-31141')
  assert.equal(single.kind, 'success')
  assert.match(single.text, /"label": "受影响"/)
  assert.ok(single.text.includes('https://kafka.apache.org/community/cve-list/#CVE-2024-31141'))
  assert.match(single.text, /UTC\+8/)
  const absent = await h.execute('advisory_impact_lookup', { id: 'CVE-2026-112375' })
  assert.equal(absent.osv.statusLabel, 'OSV 未收录 / HTTP 404')
  assert.equal((await h.command('report')).kind, 'success')
  assert.equal((await h.command('report save')).kind, 'success')
  const opened = await h.command('open')
  assert.match(opened.text, /# 官方公告影响核对/)
  assert.equal((await h.execute('advisory_impact_open')).path, path.join(h.root, plugin.REPORT_FILE))
  const report = await h.execute('advisory_impact_report')
  assert.equal(report.path, path.join(h.root, plugin.REPORT_FILE))
  assert.equal(report.projects[0].advisories.length, 20)
  assert.equal(report.projects[0].truncated, true)
  assert.ok(report.projects[0].total > report.projects[0].advisories.length)
  const payload = JSON.stringify(report)
  for (const forbidden of ['<html', '<!DOCTYPE', '"payload"', '"record"', '"affected":[' ]) assert.ok(!payload.includes(forbidden), forbidden)
  const calls = h.calls.length
  const refreshed = await h.execute('advisory_impact_refresh')
  assert.equal(refreshed.projects[0].source.state, 'fresh')
  assert.ok(h.calls.length > calls)
  await h.execute('advisory_impact_pin', { project: 'kafka', version: '3.7.1', component: 'kafka-clients' })
  assert.equal((await h.execute('advisory_impact_lookup', { id: 'CVE-2024-31141' })).official[0].verdict, 'not_affected')
  assert.equal((await h.command('pin remove kafka')).kind, 'success')
  assert.deepEqual((await h.execute('advisory_impact_pin')).pins, [])
  assert.equal((await h.command('watch none')).kind, 'success')
  assert.deepEqual((await h.execute('advisory_impact_watch')).watch, [])
})
