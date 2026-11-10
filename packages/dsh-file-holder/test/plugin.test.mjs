import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import Commands from '@deepseek-ai/dsh-commands'
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as plugin from '../index.js'
import { formatObservation } from '../lib/plugin.js'

const snapshot = { version: 1, ok: true, observedAt: '2026-11-10T00:00:00.0000000Z',
  processes: [{ name: 'Example', pid: 2345, applicationType: 3, serviceName: 'ExampleSvc' }] }
const scratch = fileURLToPath(new URL('../../../.tmp/', import.meta.url))
async function area() {
  await mkdir(scratch, { recursive: true })
  const directory = await mkdtemp(join(scratch, 'file-holder-plugin-'))
  assert.ok(resolve(directory).startsWith(resolve(scratch) + '\\'))
  return directory
}
async function harness(cwd, spawn) {
  const ctx = new Context(), events = []
  // Trap every model-facing capability; no model service is needed to load or run.
  const traps = ['tools', 'messages'].map(name => ctx.provide(name, new Proxy({}, { get() { assert.fail('model capability accessed') } })))
  let current = cwd
  const agent = { session: { header: { cwd: 'Z:\\obsolete' }, append(type, data) { events.push({ type, data }); return events.length } } }
  const services = [
    ctx.provide('workingDirectory', { get(session) { assert.equal(session, agent.session); return current } }),
    ctx.provide('subprocess', { spawn }),
  ]
  const commands = ctx.plugin(Commands)
  await commands
  const fiber = ctx.plugin(plugin)
  await fiber
  return { ctx, fiber, events, agent, cd(value) { current = value },
    execute(raw = 'a.txt', signal = new AbortController().signal) { return ctx.commands.execute(agent, '/file-holder ' + raw, [], signal) },
    async close() {
      await fiber.dispose()
      await commands.dispose()
      for (const dispose of [...services, ...traps]) await dispose()
    } }
}
function successHandle(spec, data = snapshot) {
  return { done: Promise.resolve({ exitCode: 0, signal: null }), terminate() {},
    collected: Object.fromEntries(['stdout', 'stderr'].map(key => [key, {
      readFrom() { const text = key === 'stdout' ? JSON.stringify(data) : ''; return { text, nextOffset: Buffer.byteLength(text), lossy: false } },
    }])) }
}

test('empty result wording, observation time and recheck hint', () => {
  const text = formatObservation({ observedAt: snapshot.observedAt, processes: [] }, 'C:\\project\\a.txt')
  assert.match(text, /未查到占用进程/)
  assert.match(text, /观察时间：2026-11-10/)
  assert.match(text, /重新检查：再次执行 \/file-holder "C:\\project\\a.txt"/)
  assert.equal(text.split('\n')[2], '未查到占用进程')
  assert.doesNotMatch(text, /文件未被占用|^文件可写/mu)
  assert.match(text, /不能据此保证文件可写/)
})
test('holder result includes program, PID, application type and service', () => {
  assert.match(formatObservation(snapshot, 'C:\\project\\a.txt'), /Example \| PID 2345 \| 应用类型 3 \| 服务 ExampleSvc/)
})
test('rc.5 Cordis registry registers exact human name and unregisters on unload', async () => {
  assert.deepEqual(plugin.inject, ['commands', 'workingDirectory', 'subprocess'])
  const h = await harness('C:\\project', () => { assert.fail('spawn') })
  try {
    const def = h.ctx.commands.find(h.agent, 'file-holder')
    assert.equal(def.name, 'file-holder')
    assert.equal(def.definitionId, 'dsh-file-holder')
    assert.equal(def.recordInput, false)
    const result = await h.execute('')
    assert.equal(result.result.kind, 'error')
    assert.deepEqual(h.events.map(event => event.type), ['command/run', 'command/done'])
    assert.equal(h.events[0].data.args, undefined)
    await h.fiber.dispose()
    assert.equal(h.ctx.commands.find(h.agent, 'file-holder'), undefined)
  } finally { await h.close() }
})
test('real command dispatch uses current working directory after cd, emits only command lifecycle', { skip: process.platform !== 'win32' }, async () => {
  const directory = await area()
  const specs = []
  let h
  try {
    const one = join(directory, 'one'), two = join(directory, 'two')
    await mkdir(one); await mkdir(two)
    await writeFile(join(one, 'a.txt'), 'one')
    await writeFile(join(two, 'a.txt'), 'two')
    h = await harness(one, spec => { specs.push(spec); return successHandle(spec) })
    const first = await h.execute()
    assert.equal(first.result.kind, 'success')
    assert.match(first.result.text, /PID 2345/)
    h.cd(two)
    const second = await h.execute()
    assert.equal(second.result.kind, 'success')
    assert.equal(specs[0].cwd, one)
    assert.equal(specs[1].cwd, two)
    assert.equal(specs[1].argv.at(-1), join(two, 'a.txt'))
    assert.deepEqual(h.events.map(event => event.type), ['command/run', 'command/done', 'command/run', 'command/done'])
    assert.match(second.result.text, /重新检查/)
  } finally {
    await h?.close()
    assert.ok(resolve(directory).startsWith(resolve(scratch) + '\\'))
    await rm(directory, { recursive: true, force: true })
  }
})
test('invalid paths never reach subprocess through real command dispatcher', { skip: process.platform !== 'win32' }, async () => {
  const directory = await area()
  const h = await harness(directory, () => { assert.fail('spawn') })
  try {
    for (const raw of ['missing.txt', '.', '../outside.txt', 'NUL', '\\\\server\\share\\file.txt']) {
      assert.equal((await h.execute(raw)).result.kind, 'error')
    }
    await assert.rejects(h.execute('a.txt', AbortSignal.abort()), { name: 'AbortError' })
  } finally { await h.close(); await rm(directory, { recursive: true, force: true }) }
})
test('plugin unload cancels its helper', { skip: process.platform !== 'win32' }, async () => {
  const directory = await area()
  let h, childSignal, markStarted
  const started = new Promise(resolve => { markStarted = resolve })
  try {
    await writeFile(join(directory, 'a.txt'), 'fixture')
    h = await harness(directory, spec => {
      childSignal = spec.signal
      markStarted()
      return { done: new Promise(() => {}), terminate() {} }
    })
    const pending = h.execute()
    await started
    await h.fiber.dispose()
    const result = await pending
    assert.equal(result.result.kind, 'error')
    assert.match(result.result.text, /已取消/)
    assert.equal(childSignal.aborted, true)
  } finally { await h?.close(); await rm(directory, { recursive: true, force: true }) }
})
test('non-Windows command exits before reading a directory or spawning', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')
  const h = await harness(undefined, () => { assert.fail('spawn') })
  try {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
    h.ctx.workingDirectory.get = () => { assert.fail('directory read') }
    assert.deepEqual((await h.execute()).result, { kind: 'error', text: '暂不支持（仅 Windows）' })
  } finally { Object.defineProperty(process, 'platform', descriptor); await h.close() }
})
