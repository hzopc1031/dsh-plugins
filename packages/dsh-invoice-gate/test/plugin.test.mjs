import test from 'node:test'
import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import Tools from '@deepseek-ai/dsh-tools'
import { createScope, bindScopeParent } from '@deepseek-ai/dsh-scope'
import { name, inject, Config, apply } from '../index.js'

const toolNames = ['invoice_gate_ingest', 'invoice_gate_check', 'invoice_gate_export']
const signal = new AbortController().signal
const input = { path: 'SAMPLE.json', kind: 'ticket' }
const manifest = { schemaVersion: 1, inputs: [input] }
async function fixture(t, directoryOf) {
  await mkdir('.tmp', { recursive: true })
  const root = await mkdtemp(fileURLToPath(new URL('../.tmp/plugin-', import.meta.url)))
  const project = root + '/project'
  await mkdir(project)
  t.after(() => rm(root, { recursive: true, force: true }))
  await copyFile(new URL('./fixtures/mismatch.json', import.meta.url), project + '/SAMPLE.json')
  await writeFile(project + '/SAMPLE-run.json', JSON.stringify(manifest))
  const host = new Context(), commands = new Map(), definitions = new Map(), disposers = []
  await host.plugin(SystemPrompt, {})
  await host.plugin(Tools)
  t.after(() => host.fiber.dispose())
  const agent = { id: 'SAMPLE-agent', session: { header: { cwd: project } } }
  let scope
  await host.plugin(Object.assign(inner => { scope = createScope(inner, agent); agent.ctx = scope.ctx }, { inject: ['tools', 'systemPrompt'] }))
  apply({
    get: () => directoryOf ? { get: () => directoryOf(project) } : undefined,
    effect(fn) { const dispose = fn(); disposers.push(dispose); return dispose },
    commands: { register(def) { commands.set(def.name, def); return () => commands.delete(def.name) } },
    tools: {
      register(def) { definitions.set(def.name, def); const dispose = host.tools.register(def); return () => { definitions.delete(def.name); dispose() } },
      guard: guard => host.tools.guard(guard),
      restrict() { assert.fail('restrict must never be called on the plugin root') },
    },
  })
  const dispose = () => { for (const d of disposers.splice(0).reverse()) d() }
  t.after(dispose)
  return {
    root, project, host, agent, scope, commands, definitions, dispose,
    call: (rawInput, control = signal, owner = agent) => commands.get('invoice-gate').handler({ agent: owner, rawInput, signal: control }),
    tool: (verb, args = {}, owner = agent, control = signal) => host.tools.execute({ name: `invoice_gate_${verb}`, arguments: args, agent: owner, signal: control, callId: 'SAMPLE-call' }),
    direct: (verb, args = {}) => definitions.get(`invoice_gate_${verb}`).execute(args, { agent, signal }),
  }
}
const value = result => { assert.equal(result.isError, false, JSON.stringify(result)); return JSON.parse(result.value) }
const success = result => { assert.equal(result.kind, 'success', result.text); return JSON.parse(result.text) }
const failure = result => { assert.equal(result.isError, true, JSON.stringify(result)); return JSON.stringify(result) }
const dummy = name => ({ name, description: 'SAMPLE inert tool', parameters: { type: 'object', properties: {} }, output: { schema: { type: 'string' }, render: (_args, text) => [{ type: 'text', text }] }, execute: async () => 'SAMPLE' })

test('metadata, three prefixed tools, command input suppression and disposal', async t => {
  const f = await fixture(t)
  assert.equal(name, 'invoice-gate'); assert.deepEqual(inject, ['commands', 'tools']); assert.deepEqual(Config({}), {})
  assert.deepEqual([...f.commands.keys()], ['invoice-gate'])
  assert.deepEqual([...f.definitions.keys()], toolNames)
  const command = f.commands.get('invoice-gate')
  assert.equal(command.definitionId, 'dsh-invoice-gate'); assert.equal(command.recordInput, false)
  assert.match(command.input.hint, /start.*status.*stop/)
  for (const verb of ['ingest', 'check']) assert.deepEqual(f.definitions.get(`invoice_gate_${verb}`).parameters.properties, {})
  assert.throws(() => f.host.tools.restrict({ allow: toolNames }), /scoped context/)
  f.dispose()
  assert.equal(f.commands.size, 0); assert.equal(f.host.tools.schemas(f.agent).length, 0)
})

test('help and errors state boundaries without reflecting untrusted financial input', async t => {
  const f = await fixture(t)
  for (const input of ['', 'help', ' help\n']) {
    const result = await f.call(input)
    assert.equal(result.kind, 'success')
    for (const text of ['local verification gate', 'No OCR', '不做 OCR／税局验真', 'never invent or change amounts, tax, totals or identifiers', 'No model calls or automatic uploads', 'no outbound network', 'authenticity, payment or reimbursability', 'accounting-archive compliance']) assert.ok(result.text.includes(text), text)
  }
  for (const input of ['rewrite amount TAXID-SAMPLE-PRIVATE', 'check extra', 'help extra', 'stop extra']) {
    const result = await f.call(input)
    assert.equal(result.kind, 'error'); assert.ok(!result.text.includes(input))
  }
  assert.match((await f.call('help', AbortSignal.abort())).text, /cancelled/)
  assert.equal(success(await f.call('status')).status, 'stopped')
  assert.match(failure(await f.tool('check')), /Start a confined run/)
})

test('command and native tool pipeline ingest/check/export return only summaries with no network', async t => {
  const f = await fixture(t)
  for (const [object, key] of [[http, 'request'], [https, 'request'], [net, 'connect'], [net, 'createConnection'], [globalThis, 'fetch']]) t.mock.method(object, key, () => { throw new Error('network forbidden') })
  const before = await readFile(f.project + '/SAMPLE.json')
  const started = success(await f.call('start SAMPLE-run.json'))
  assert.equal(started.status, 'started')
  assert.match(started.runId, /^[\da-f-]{36}$/)
  assert.match(failure(await f.tool('check')), /ingest before check/)
  assert.match(failure(await f.tool('export', { directory: 'SAMPLE-pack' })), /check before export/)
  const ingested = await f.tool('ingest'), checked = await f.tool('check')
  assert.equal(value(ingested).counts.records, 1)
  assert.equal(value(checked).counts.mismatches, 1)
  assert.equal(value(checked).status, 'draft')
  assert.ok(value(checked).counts.pendingKeyFields > 0)
  const exported = await f.tool('export', { directory: 'SAMPLE-pack' })
  assert.deepEqual(value(exported).pack.files, { markdown: 'SAMPLE-pack/report.md', xlsx: 'SAMPLE-pack/report.xlsx', json: 'SAMPLE-pack/export-report.json' })
  for (const response of [ingested, checked, exported]) {
    assert.equal(response.content[0].text, response.value)
    for (const secret of ['12345678901234567890', '100.00', '108.00', 'SAMPLE 示例买方', 'extracted', 'expectedFen', 'raw', 'lineItems']) assert.ok(!JSON.stringify(response).includes(secret), secret)
  }
  const report = JSON.parse(await readFile(f.project + '/SAMPLE-pack/export-report.json', 'utf8'))
  assert.ok(JSON.stringify(report).includes('108.00'))
  assert.match(await readFile(f.project + '/SAMPLE-pack/report.md', 'utf8'), /2\.00/)
  assert.deepEqual(await readFile(f.project + '/SAMPLE.json'), before)
  assert.equal(success(await f.call('status')).runId, started.runId)
  success(await f.call('ingest'))
  success(await f.call('check'))
  const commandExport = success(await f.call('export SAMPLE-command-pack'))
  assert.equal(commandExport.pack.status, 'draft')
  assert.equal((await f.call('stop')).kind, 'success')
  assert.equal(success(await f.call('status')).status, 'stopped')
  assert.ok(await readFile(f.project + '/SAMPLE-pack/report.md'))
})

test('real scoped restriction and monotonic guard block other/scoped/descendant tools and restore on stop', async t => {
  const f = await fixture(t)
  f.host.tools.register(dummy('SAMPLE_global'))
  f.agent.ctx.tools.register(dummy('SAMPLE_scoped'))
  const other = { id: 'SAMPLE-other', session: { header: { cwd: f.project } } }
  success(await f.call('start SAMPLE-run.json'))
  const visible = f.host.tools.schemas(f.agent).map(tool => tool.name)
  assert.ok(!visible.includes('SAMPLE_global')); assert.ok(visible.includes('SAMPLE_scoped'))
  assert.ok(f.host.tools.schemas(other).some(tool => tool.name === 'SAMPLE_global'))
  const denied = await f.host.tools.execute({ name: 'SAMPLE_scoped', arguments: {}, agent: f.agent, signal, callId: 'SAMPLE' })
  assert.match(failure(denied), /other tools are blocked/)
  assert.match(failure(await f.tool('ingest', {}, other)), /Start a confined run/)
  assert.equal((await f.call('stop', signal, other)).kind, 'error')
  assert.equal((await f.call('start SAMPLE-run.json', signal, other)).kind, 'error')
  const child = { id: 'SAMPLE-child' }; bindScopeParent(child, f.agent)
  const childCall = await f.host.tools.execute({ name: 'invoice_gate_ingest', arguments: {}, agent: child, signal, callId: 'SAMPLE' })
  assert.equal(childCall.isError, true)
  assert.match(failure(await f.host.tools.execute({ name: 'run_code', agent: f.agent, arguments: {}, signal, callId: 'SAMPLE' })), /other tools are blocked/)
  await f.call('stop')
  assert.ok(f.host.tools.schemas(f.agent).some(tool => tool.name === 'SAMPLE_global'))
  assert.equal((await f.host.tools.execute({ name: 'SAMPLE_scoped', arguments: {}, agent: f.agent, signal, callId: 'SAMPLE' })).isError, false)
})

test('clean command run passes arithmetic and exports a draft until human field review', async t => {
  const f = await fixture(t)
  await copyFile(new URL('./fixtures/invoice.xml', import.meta.url), f.project + '/SAMPLE.xml')
  await writeFile(f.project + '/SAMPLE-run.json', JSON.stringify({ schemaVersion: 1, inputs: [{ path: 'SAMPLE.xml', kind: 'ticket' }] }))
  success(await f.call('start SAMPLE-run.json'))
  success(await f.call('ingest'))
  const checked = success(await f.call('check'))
  assert.equal(checked.counts.mismatches, 0)
  assert.equal(checked.counts.exceptions, 0)
  assert.ok(checked.counts.pendingKeyFields > 0)
  assert.equal(checked.status, 'draft')
  value(await f.tool('export', { directory: 'SAMPLE-clean' }))
  const report = JSON.parse(await readFile(f.project + '/SAMPLE-clean/export-report.json', 'utf8'))
  assert.ok(report.results.some(rule => rule.ruleId === 'amount-tax-total' && rule.outcome === 'pass'))
  assert.equal(report.externalVerification, 'not-checked')
  assert.equal(report.status, 'draft')
  assert.match(report.extracted.records[0].label, /SAMPLE.*非真实票据/)
  assert.equal((await f.call('stop')).kind, 'success')
})

test('manifest/input/sidecar/corrections and output traversal or symlink escapes are rejected', async t => {
  const f = await fixture(t)
  await copyFile(f.project + '/SAMPLE.json', f.root + '/outside.json')
  await writeFile(f.root + '/outside-run.json', JSON.stringify(manifest))
  await symlink(f.root, f.project + '/escape')
  for (const p of ['../outside-run.json', f.root + '/outside-run.json', 'escape/outside-run.json']) assert.equal((await f.call('start ' + p)).kind, 'error')
  for (const extra of [
    { inputs: [{ ...input, path: '../outside.json' }] },
    { inputs: [{ ...input, ocrJson: '../outside.json' }] },
    { corrections: '../outside.json' }, { corrections: 'escape/outside.json' },
  ]) {
    await writeFile(f.project + '/bad.json', JSON.stringify({ ...manifest, ...extra }))
    assert.equal((await f.call('start bad.json')).kind, 'error')
  }
  await writeFile(f.project + '/bad.json', JSON.stringify({ ...manifest, inputs: [{ ...input, path: 'escape/outside.json' }] }))
  success(await f.call('start bad.json'))
  assert.ok(value(await f.tool('ingest')).counts.exceptions > 0)
  await f.call('stop')
  success(await f.call('start SAMPLE-run.json')); value(await f.tool('ingest')); value(await f.tool('check'))
  for (const directory of ['../outside-pack', f.root + '/outside-pack', 'escape/outside-pack']) {
    assert.equal((await f.tool('export', { directory })).isError, true)
    await assert.rejects(f.direct('export', { directory }))
    assert.equal((await f.call('export ' + directory)).kind, 'error')
  }
  value(await f.tool('export', { directory: 'SAMPLE-good' }))
  const good = await readFile(f.project + '/SAMPLE-good/report.md')
  assert.equal((await f.tool('export', { directory: 'SAMPLE-good' })).isError, true)
  assert.deepEqual(await readFile(f.project + '/SAMPLE-good/report.md'), good)
  assert.deepEqual(await readFile(f.root + '/outside.json'), await readFile(f.project + '/SAMPLE.json'))
})

test('no model rewrite API: extra fields are rejected by guard and body, no verbose leak', async t => {
  const f = await fixture(t)
  success(await f.call('start SAMPLE-run.json'))
  for (const verb of ['ingest', 'check', 'export']) {
    for (const hook of ['amount', 'tax', 'total', 'number', 'corrections', 'inputs', 'manifest', 'verbose', 'details']) {
      const args = { ...(verb === 'export' ? { directory: 'SAMPLE-pack' } : {}), [hook]: 'SAMPLE-PRIVATE 999.00' }
      const result = await f.tool(verb, args)
      assert.equal(result.isError, true); assert.ok(!JSON.stringify(result).includes('SAMPLE-PRIVATE'))
      await assert.rejects(f.direct(verb, args), /rewrite hooks/)
    }
  }
  assert.match(failure(await f.tool('rewrite_amount', { amount: '999.00' })), /rewrite|unknown tool/)
  assert.match(failure(await f.tool('rewrite')), /rewrite/)
  assert.equal((await f.call('rewrite total 999.00')).kind, 'error')
})

test('human corrections file is captured only by start; tools cannot supply or reload it', async t => {
  const f = await fixture(t)
  const corrections = { schemaVersion: 1, entries: [{ recordId: 'file-1:json:1', field: 'total', before: '108.00', after: '106.00', confirmedBy: 'SAMPLE human', confirmedAt: '2026-11-11T01:00:00Z' }] }
  await writeFile(f.project + '/SAMPLE-corrections.json', JSON.stringify(corrections))
  await writeFile(f.project + '/SAMPLE-run.json', JSON.stringify({ ...manifest, corrections: 'SAMPLE-corrections.json' }))
  success(await f.call('start SAMPLE-run.json'))
  await writeFile(f.project + '/SAMPLE-corrections.json', '{invalid SAMPLE external edit')
  value(await f.tool('ingest'))
  assert.equal(value(await f.tool('check')).counts.mismatches, 0)
  value(await f.tool('export', { directory: 'SAMPLE-reviewed', includeOriginals: true }))
  const report = JSON.parse(await readFile(f.project + '/SAMPLE-reviewed/export-report.json', 'utf8'))
  assert.equal(report.extracted.records[0].fields.total.raw, '108.00')
  assert.equal(report.records[0].fields.total.confirmed.raw, '106.00')
})

test('effective cwd changes fail closed and agent/plugin disposal clears run and masks', async t => {
  let changed = false
  const f = await fixture(t, project => changed ? project + '/other-project' : project)
  await mkdir(f.project + '/other-project')
  success(await f.call('start SAMPLE-run.json'))
  changed = true
  assert.match(failure(await f.tool('ingest')), /Project directory changed/)
  changed = false
  await f.scope.dispose()
  assert.equal(success(await f.call('status')).status, 'stopped')
  assert.match(failure(await f.host.tools.execute({ name: 'SAMPLE_other', agent: f.agent, arguments: {}, signal, callId: 'SAMPLE' })), /unknown tool/)
  f.dispose()
  assert.equal(f.host.tools.schemas(f.agent).length, 0)
})

test('invalid manifests and malformed private errors stay redacted; abort and overlapping calls settle safely', async t => {
  const f = await fixture(t)
  for (const data of ['{SAMPLE-PRIVATE 999.00', JSON.stringify({ ...manifest, amount: '999.00' }), JSON.stringify({ ...manifest, inputs: [] }), JSON.stringify({ ...manifest, rules: { amount: '999.00' } }), JSON.stringify({ ...manifest, rules: null }), Buffer.from(JSON.stringify({ ...manifest, inputs: [{ ...input, path: 'SAMPLE\xff.json' }] }), 'latin1')]) {
    await writeFile(f.project + '/bad.json', data)
    const result = await f.call('start bad.json')
    assert.equal(result.kind, 'error'); assert.ok(!result.text.includes('999.00'))
  }
  success(await f.call('start SAMPLE-run.json'))
  const first = f.direct('ingest')
  await assert.rejects(f.direct('ingest'), /still running/)
  assert.equal((await f.call('stop')).kind, 'error')
  await first
  assert.equal((await f.tool('check', {}, f.agent, AbortSignal.abort())).isError, true)
  value(await f.tool('check'))
  await f.call('stop')
  success(await f.call('start SAMPLE-run.json'))
  f.dispose()
  assert.match(failure(await f.host.tools.execute({ name: 'SAMPLE_other', agent: f.agent, arguments: {}, signal, callId: 'SAMPLE' })), /unknown tool/)
})
