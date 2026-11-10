import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import os from 'node:os'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { apply, name, inject, Config } from '../index.js'

function fixture(directoryOf) {
  const commands = new Map(), tools = new Map(), disposers = []
  const ctx = {
    get: () => directoryOf ? { get: directoryOf } : undefined,
    effect(fn) { const d = fn(); disposers.push(d); return d },
    commands: { register(def) { commands.set(def.name, def); return () => commands.delete(def.name) } },
    tools: { register(def) { tools.set(def.name, def); return () => tools.delete(def.name) } },
  }
  apply(ctx)
  return { commands, tools, dispose() { for (const d of disposers) d() } }
}
const registration = {
  id: 'cost', source: 'quotes.csv',
  selector: { kind: 'csv-key', keyColumn: 'sku', keyValue: 'A', columns: ['price'] },
  conclusion: { id: 'buy', text: '选择 A' },
  outputs: [{ path: 'report.md', kind: 'section', locator: '建议', label: '采购建议章节' }],
  recheck: '数量为 5；按当前 price 计算总价并检查选择依据。',
}
function jsonFrom(text) {
  const start = text.indexOf('{'), end = text.lastIndexOf('}')
  return JSON.parse(text.slice(start, end + 1))
}
async function project(t) {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'dsh-impact-plugin-'))
  t.after(() => rm(cwd, { recursive: true, force: true }))
  await writeFile(path.join(cwd, 'quotes.csv'), 'sku,price\nA,10\n')
  await writeFile(path.join(cwd, 'report.md'), '结论原文')
  const f = fixture()
  t.after(() => f.dispose())
  const agent = { session: { header: { cwd } } }
  const call = rawInput => f.commands.get('impact').handler({ agent, rawInput, signal: new AbortController().signal })
  return { ...f, cwd, agent, call }
}
test('Cordis metadata, Config, command descriptor and effect disposers', () => {
  assert.equal(name, 'source-impact')
  assert.deepEqual(inject, ['commands', 'tools'])
  assert.deepEqual(Config({}), {})
  const f = fixture(), command = f.commands.get('impact')
  assert.ok(command.input.hint.includes('plan'))
  assert.equal(command.recordInput, false)
  assert.deepEqual([...f.tools.keys()], ['source_impact_check'])
  f.dispose()
  assert.equal(f.tools.size, 0); assert.equal(f.commands.size, 0)
})

test('effective cwd is re-read for each command and tool; stale header is not used', async t => {
  const a=await mkdtemp(path.join(os.tmpdir(),'impact-cwd-a-')), b=await mkdtemp(path.join(os.tmpdir(),'impact-cwd-b-'))
  t.after(()=>Promise.all([rm(a,{recursive:true,force:true}),rm(b,{recursive:true,force:true})]))
  let cwd=a
  const f=fixture(()=>cwd), agent={session:{header:{cwd:a}}}, signal=new AbortController().signal
  t.after(()=>f.dispose())
  await writeFile(path.join(b,'quotes.csv'),'sku,price\nA,10\n')
  cwd=b
  const out=await f.commands.get('impact').handler({agent,rawInput:'register '+JSON.stringify(registration),signal})
  assert.equal(out.kind,'success',out.text)
  assert.equal(JSON.parse(await f.tools.get('source_impact_check').execute({details:true},{agent,signal})).impacts.length,1)
  cwd=a
  assert.equal(JSON.parse(await f.tools.get('source_impact_check').execute({details:true},{agent,signal})).impacts.length,0)
})
test('command lifecycle: register, list, check, explicit selection, DSH handoff, remove', async t => {
  const { call, cwd } = await project(t)
  assert.equal((await call(' register ' + JSON.stringify(registration))).kind, 'success')
  assert.match((await call('list')).text, /采购建议章节/)
  await writeFile(path.join(cwd, 'quotes.csv'), 'sku,price\nA,12\n')
  const check = await call('check')
  assert.equal(check.kind, 'success')
  assert.match(check.text, /引用内容已变化/)
  const scanId = /scanId: ([a-f0-9]{64})/.exec(check.text)[1]
  const selected = await call('plan ' + scanId + ' cost')
  assert.equal(selected.kind, 'success')
  const plan = jsonFrom(selected.text)
  assert.deepEqual(plan.selectedIds, ['cost'])
  assert.equal(plan.tasks[0].steps[2], registration.recheck)
  assert.equal(await readFile(path.join(cwd, 'report.md'), 'utf8'), '结论原文')
  assert.equal((await call('remove cost')).kind, 'success')
  const listed = await call('list')
  assert.match(listed.text, /^\[\]\n使用的根目录（服务缺失，回退原始项目目录 header.cwd）：/)
})
test('source changes between check and plan are rejected with a rescan instruction', async t => {
  const { call, cwd } = await project(t)
  await call('register ' + JSON.stringify(registration))
  await writeFile(path.join(cwd, 'quotes.csv'), 'sku,price\nA,11\n')
  const scanId = /scanId: ([a-f0-9]{64})/.exec((await call('check')).text)[1]
  await writeFile(path.join(cwd, 'quotes.csv'), 'sku,price\nA,12\n')
  const result = await call('plan ' + scanId + ' cost')
  assert.equal(result.kind, 'error')
  assert.match(result.text, /重新 check/)
})
test('model tool returns read-only JSON through defineTool output contract', async t => {
  const { call, tools, agent, cwd } = await project(t)
  await call('register ' + JSON.stringify(registration))
  await writeFile(path.join(cwd, 'quotes.csv'), 'sku,price\nA,13\n')
  const tool = tools.get('source_impact_check')
  assert.equal(tool.output.schema.type, 'string')
  const result = await tool.execute({}, { agent, signal: new AbortController().signal })
  const scan = JSON.parse(result)
  assert.equal(scan.impacts[0].citationContentChanged, true)
  assert.deepEqual(tool.output.render({}, result), [{ type: 'text', text: result }])
  assert.equal(await readFile(path.join(cwd, 'report.md'), 'utf8'), '结论原文')
})
test('invalid input is a command error; help works without a selected project', async t => {
  const { call } = await project(t)
  for (const input of ['register {bad', 'register {}', 'wat', 'check extra', 'plan', 'plan bad a', 'remove unknown']) assert.equal((await call(input)).kind, 'error', input)
  const f = fixture()
  try {
    const cmd = f.commands.get('impact')
    const invoke = rawInput => cmd.handler({ agent: { session: { header: {} } }, rawInput, signal: new AbortController().signal })
    assert.equal((await invoke('')).kind, 'success')
    assert.equal((await invoke('check')).kind, 'error')
    const cancelled = await cmd.handler({ rawInput: 'check', signal: AbortSignal.abort() })
    assert.equal(cancelled.kind, 'error')
    assert.match(cancelled.text, /取消/)
  } finally { f.dispose() }
})

test('accept command writes a new baseline only after a matching rescan; directory line distinguishes current vs fallback', async t => {
  const { call, cwd } = await project(t)
  await call('register ' + JSON.stringify(registration))
  await writeFile(path.join(cwd, 'quotes.csv'), 'sku,price\nA,12\n')
  const check = await call('check')
  assert.match(check.text, /使用的根目录（服务缺失，回退原始项目目录 header.cwd）：/)
  const scanId = /scanId: ([a-f0-9]{64})/.exec(check.text)[1]
  await writeFile(path.join(cwd, 'quotes.csv'), 'sku,price\nA,13\n')
  const stale = await call('accept ' + scanId)
  assert.equal(stale.kind, 'error')
  assert.match(stale.text, /重新 check/)
  const fresh = /scanId: ([a-f0-9]{64})/.exec((await call('check')).text)[1]
  const accepted = await call('accept ' + fresh)
  assert.equal(accepted.kind, 'success', accepted.text)
  assert.match(accepted.text, /已原子接受新基线/)
  const listed = JSON.parse((await call('list')).text.slice(0, (await call('list')).text.indexOf('\n使用的根目录')))
  assert.equal(listed[0].id, 'cost')
  const current = fixture(() => cwd)
  try {
    const out = await current.commands.get('impact').handler({ agent: { session: { header: { cwd } } }, rawInput: 'list', signal: new AbortController().signal })
    assert.match(out.text, /使用的根目录（当前执行目录，workingDirectory.get）：/)
  } finally { current.dispose() }
})
