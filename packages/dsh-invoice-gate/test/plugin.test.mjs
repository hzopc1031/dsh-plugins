import test from 'node:test'
import { childHook, withoutFdPaths } from './portable.mjs'
import assert from 'node:assert/strict'
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises'
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
const success = result => { assert.equal(result.kind, 'success', result.text); return result.text }
const failure = result => { assert.equal(result.isError, true, JSON.stringify(result)); return JSON.stringify(result) }
const dummy = name => ({ name, description: 'SAMPLE inert tool', parameters: { type: 'object', properties: {} }, output: { schema: { type: 'string' }, render: (_args, text) => [{ type: 'text', text }] }, execute: async () => 'SAMPLE' })

test('all six commands atomically refresh one Chinese Markdown status file and return its exact text', async t => {
  withoutFdPaths(t)
  const f = await fixture(t)
  await copyFile(new URL('./fixtures/sample.ofd', import.meta.url), f.project + '/SAMPLE.ofd')
  await writeFile(f.project + '/SAMPLE-run.json', JSON.stringify({ ...manifest, inputs: [input, { path: 'SAMPLE.ofd', kind: 'ticket' }, { path: 'SAMPLE-missing.json', kind: 'ticket' }] }))
  let file, previousInode
  for (const command of ['start SAMPLE-run.json', 'ingest', 'check', 'export SAMPLE-pack', 'status', 'stop', 'status']) {
    const text = success(await f.call(command))
    const selected = /状态文件（项目相对路径）：(invoice-gate-[\da-f-]{36}-status\.md)/.exec(text)?.[1]
    assert.ok(selected, text)
    file ??= selected
    assert.equal(selected, file)
    assert.equal(await readFile(f.project + '/' + file, 'utf8'), text)
    const stat = await lstat(f.project + '/' + file)
    assert.notEqual(stat.ino, previousInode, 'atomic replace creates a new inode')
    previousInode = stat.ino
    assert.equal(stat.mode & 0o777, 0o600)
    for (const token of ['运行 ID：', '草稿（draft）', '文件数：', '异常清单项数：', '仅使用命令的 DSH 会话可能不显示结果卡片', '打开此状态文件及证据包', '不证明票据真实、已付款或可报销']) assert.ok(text.includes(token), token)
    if (!command.startsWith('start')) {
      assert.match(text, /文件数：3；记录数：1；异常清单项数：2/)
      assert.match(text, /SAMPLE\.ofd.*不支持 OFD.*请提供/)
      assert.match(text, /SAMPLE-missing\.json.*文件不存在或无法读取.*请检查/)
    }
    if (['export SAMPLE-pack', 'status', 'stop'].includes(command)) {
      for (const path of ['SAMPLE-pack/report.md', 'SAMPLE-pack/report.xlsx', 'SAMPLE-pack/export-report.json']) assert.ok(text.includes(path), path)
    }
    if (command === 'stop') assert.match(text, /已停止（工具限制已恢复）/)
    assert.doesNotMatch(text, /100\.00|108\.00|12345678901234567890|SAMPLE 示例买方/)
    assert.ok(!(await readdir(f.project)).some(name => name.startsWith('.invoice-gate-status-')))
  }
})

test('native tools update the local status path while keeping refusal details and evidence out of model results', async t => {
  const f = await fixture(t)
  await copyFile(new URL('./fixtures/scan.pdf', import.meta.url), f.project + '/SAMPLE-scan.pdf')
  await writeFile(f.project + '/SAMPLE-run.json', JSON.stringify({ ...manifest, inputs: [input, { path: 'SAMPLE-scan.pdf', kind: 'ticket' }] }))
  success(await f.call('start SAMPLE-run.json'))
  let statusFile
  for (const verb of ['ingest', 'check', 'export']) {
    const response = await f.tool(verb, verb === 'export' ? { directory: 'SAMPLE-pack' } : {})
    const info = value(response)
    statusFile ??= info.statusFile
    assert.equal(info.statusFile, statusFile)
    assert.equal(info.counts.files, 2)
    assert.equal(info.counts.exceptions, 2)
    assert.deepEqual(Object.keys(info).sort(), ['runId', 'status', 'statusFile', 'manifest', 'project', 'externalVerification', 'counts', ...(verb === 'export' ? ['pack'] : [])].sort())
    const status = await readFile(f.project + '/' + info.statusFile, 'utf8')
    assert.match(status, /SAMPLE-scan\.pdf.*第 1 页.*没有可用文本层.*OCR JSON/)
    assert.equal(success(await f.call('status')), status)
    for (const forbidden of ['没有可用文本层', 'message', 'inventory', '100.00', '108.00', '12345678901234567890', 'SAMPLE 示例买方', 'raw', 'lineItems']) assert.ok(!JSON.stringify(response).includes(forbidden), forbidden)
    if (verb === 'export') {
      assert.match(status, /SAMPLE-pack\/report\.md/)
      assert.match(await readFile(f.project + '/SAMPLE-pack/report.md', 'utf8'), /没有可用文本层/)
    }
  }
})

test('invalid manifest column mappings are inventoried on ingest instead of guessed', async t => {
  const f = await fixture(t)
  await copyFile(new URL('./fixtures/clean.csv', import.meta.url), f.project + '/SAMPLE.csv')
  for (const mapping of [undefined, { number: '' }, { unknown: '金额' }, { number: '不存在 SAMPLE' }]) {
    await writeFile(f.project + '/SAMPLE-run.json', JSON.stringify({ ...manifest, inputs: [{ path: 'SAMPLE.csv', kind: 'ledger', mapping }] }))
    success(await f.call('start SAMPLE-run.json'))
    const text = success(await f.call('ingest'))
    assert.match(text, /SAMPLE\.csv.*(?:缺少明确列映射|列映射无效|表头不存在或重复)/)
    assert.match(text, /记录数：0；异常清单项数：1/)
    success(await f.call('stop'))
  }
})

test('manifest and correction read/decode failures name the file and give safe Chinese next steps', async t => {
  const f = await fixture(t)
  for (const [path, data, expected] of [
    ['SAMPLE-invalid.json', Buffer.from([0xff]), /不是有效 UTF-8.*请另存为 UTF-8 JSON/],
    ['SAMPLE-invalid.json', '{"label":"SAMPLE-PRIVATE 非真实票据",', /JSON 格式损坏或已截断.*请检查语法/],
    ['SAMPLE-missing.json', undefined, /文件不存在或无法读取.*请检查相对路径/],
  ]) {
    if (data !== undefined) await writeFile(f.project + '/' + path, data)
    const refused = await f.call('start ' + path)
    assert.equal(refused.kind, 'error')
    assert.ok(refused.text.includes(path))
    assert.match(refused.text, expected)
    assert.doesNotMatch(refused.text, /SAMPLE-PRIVATE/)
  }
  await writeFile(f.project + '/SAMPLE-confirmations.json', Buffer.from([0xff]))
  await writeFile(f.project + '/SAMPLE-run.json', JSON.stringify({ ...manifest, corrections: 'SAMPLE-confirmations.json' }))
  assert.match((await f.call('start SAMPLE-run.json')).text, /SAMPLE-confirmations\.json.*不是有效 UTF-8.*请另存为 UTF-8 JSON/)
  await symlink(f.root, f.project + '/SAMPLE-escape')
  await writeFile(f.root + '/SAMPLE-outside.json', JSON.stringify(manifest))
  assert.match((await f.call('start SAMPLE-escape/SAMPLE-outside.json')).text, /SAMPLE-escape\/SAMPLE-outside\.json.*符号链接不安全.*请将普通文件/)
})

test('status replacement refuses symlinks and other files; stop still restores tools after a write failure', async t => {
  withoutFdPaths(t)
  const f = await fixture(t)
  f.host.tools.register(dummy('SAMPLE_global'))
  success(await f.call('start SAMPLE-run.json'))
  const info = value(await f.tool('ingest'))
  const target = f.project + '/' + info.statusFile
  const original = await readFile(f.project + '/SAMPLE.json')
  await rm(target)
  assert.equal((await f.call('status')).kind, 'error')
  await symlink(f.project + '/SAMPLE.json', target)
  const refused = await f.call('status')
  assert.equal(refused.kind, 'error')
  assert.match(refused.text, /符号链接.*拒绝覆盖/)
  assert.deepEqual(await readFile(f.project + '/SAMPLE.json'), original)
  assert.equal((await f.call('stop')).kind, 'error')
  assert.ok(f.host.tools.schemas(f.agent).some(tool => tool.name === 'SAMPLE_global'))
  success(await f.call('start SAMPLE-run.json'))
  const next = value(await f.tool('ingest'))
  assert.notEqual(next.statusFile, info.statusFile)
  await writeFile(f.project + '/SAMPLE-replacement.md', 'SAMPLE 非真实票据 — keep this file')
  await rename(f.project + '/SAMPLE-replacement.md', f.project + '/' + next.statusFile)
  assert.equal((await f.call('status')).kind, 'error')
  assert.equal(await readFile(f.project + '/' + next.statusFile, 'utf8'), 'SAMPLE 非真实票据 — keep this file')
  assert.ok(!(await readdir(f.project)).some(name => name.startsWith('.invoice-gate-status-')))
})

test('late status write failure preserves the previous recap and cleans staging files', async t => {
  withoutFdPaths(t)
  const f = await fixture(t)
  success(await f.call('start SAMPLE-run.json'))
  const info = value(await f.tool('ingest'))
  const before = await readFile(f.project + '/' + info.statusFile)
  const hook = childHook(t, `require('node:fs').renameSync = () => { throw new Error('SAMPLE injected write failure') }`, true)
  assert.equal((await f.call('check')).kind, 'error')
  assert.deepEqual(await readFile(f.project + '/' + info.statusFile), before)
  assert.ok(!(await readdir(f.project)).some(name => name.startsWith('.invoice-gate-status-')))
  hook.mock.restore()
  assert.match(success(await f.call('status')), /差异数：1/)
})

test('status escapes filenames as Markdown and never includes rejected file contents', async t => {
  const f = await fixture(t)
  const path = 'SAMPLE_<script>_[x]*.bin'
  await writeFile(f.project + '/' + path, 'SAMPLE-PRIVATE 非真实票据 — original text')
  await writeFile(f.project + '/SAMPLE-run.json', JSON.stringify({ ...manifest, inputs: [{ path, kind: 'ticket' }] }))
  success(await f.call('start SAMPLE-run.json'))
  const text = success(await f.call('ingest'))
  assert.match(text, /&lt;script&gt;/)
  assert.ok(text.includes('\\[x\\]\\*'))
  assert.doesNotMatch(text, /<script>|SAMPLE-PRIVATE|original text/)
})

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
  assert.match(success(await f.call('status')), /已停止/)
  assert.match(failure(await f.tool('check')), /Start a confined run/)
})

test('command and native tool pipeline ingest/check/export return only summaries with no network', async t => {
  const f = await fixture(t)
  for (const [object, key] of [[http, 'request'], [https, 'request'], [net, 'connect'], [net, 'createConnection'], [globalThis, 'fetch']]) t.mock.method(object, key, () => { throw new Error('network forbidden') })
  const before = await readFile(f.project + '/SAMPLE.json')
  const started = success(await f.call('start SAMPLE-run.json'))
  assert.match(started, /已开始，等待导入/)
  const runId = /运行 ID：([\da-f-]{36})/.exec(started)[1]
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
  assert.ok(success(await f.call('status')).includes(runId))
  success(await f.call('ingest'))
  success(await f.call('check'))
  const commandExport = success(await f.call('export SAMPLE-command-pack'))
  assert.match(commandExport, /草稿（draft）/)
  assert.match(commandExport, /SAMPLE-command-pack\/report\.md/)
  assert.equal((await f.call('stop')).kind, 'success')
  assert.match(success(await f.call('status')), /已停止/)
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
  assert.match(checked, /差异数：0/)
  assert.match(checked, /异常清单项数：0/)
  assert.match(checked, /待核关键字段数：[1-9]/)
  assert.match(checked, /草稿（draft）/)
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
  assert.match(success(await f.call('status')), /已停止/)
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

test('fd paths disabled: status refuses ancestor substitution and relocation, preserving the previous recap', async t => {
  withoutFdPaths(t)
  for (const when of ['before', 'after']) {
    const f = await fixture(t)
    success(await f.call('start SAMPLE-run.json'))
    const info = value(await f.tool('ingest'))
    const before = await readFile(f.project + '/' + info.statusFile)
    const outside = f.root + '/SAMPLE-outside'
    await mkdir(outside)
    await writeFile(outside + '/' + info.statusFile, 'SAMPLE 非真实票据 — outside status')
    const hook = childHook(t, `(() => {
      const fs = require('node:fs')
      const replace = () => { fs.renameSync(${JSON.stringify(f.project)}, ${JSON.stringify(outside + '/pinned')}); fs.symlinkSync(${JSON.stringify(outside)}, ${JSON.stringify(f.project)}) }
      if (${JSON.stringify(when)} === 'before') {
        const chdir = process.chdir.bind(process)
        process.chdir = part => { if (part === 'project') replace(); chdir(part) }
      } else {
        const write = fs.writeFileSync
        fs.writeFileSync = (name, ...args) => { const result = write(name, ...args); if (String(name).endsWith('/status.md')) replace(); return result }
      }
    })()`, true)
    assert.equal((await f.call('status')).kind, 'error')
    hook.mock.restore()
    assert.deepEqual(await readFile(outside + '/pinned/' + info.statusFile), before)
    assert.equal(await readFile(outside + '/' + info.statusFile, 'utf8'), 'SAMPLE 非真实票据 — outside status')
    assert.ok(!(await readdir(outside + '/pinned')).some(name => name.startsWith('.invoice-gate-')))
  }
})
