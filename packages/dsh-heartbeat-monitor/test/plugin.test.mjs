import test from 'node:test'
import assert from 'node:assert/strict'
import { apply, Config, inject, name } from '../index.js'

function fakeCtx() {
  const listeners = new Map(), disposers = [], executed = [], warnings = []
  let command
  const ctx = {
    logger: { warn: m => warnings.push(m) },
    on: (event, fn) => { listeners.set(event, fn); return () => {} },
    effect: fn => { const d = fn(); disposers.push(d); return d },
    commands: {
      register: def => { command = def; return () => { command = undefined } },
      execute: async (agent, line) => {
        const [, rawInput = ''] = line.match(/^\/heartbeat(.*)$/)
        const result = await command.handler({ agent, rawInput, attachments: [], signal: new AbortController().signal })
        executed.push(result)
        return { commandId: 'x', result }
      },
    },
  }
  return { ctx, listeners, disposers, executed, warnings, get command() { return command } }
}
const agent = (id, origin) => ({ id, session: { id, header: { origin } } })
const flush = () => new Promise(r => setTimeout(r, 5))

test('plugin metadata and schema defaults', () => {
  assert.equal(name, 'heartbeat')
  assert.deepEqual(inject, ['commands'])
  const cfg = Config({})
  assert.equal(cfg.intervalMinutes, 5); assert.equal(cfg.silenceMinutes, 10); assert.equal(cfg.repeatThreshold, 3)
})

test('wiring: repeat warning becomes a /heartbeat command card; manual /heartbeat works; dispose cleans up', async () => {
  const f = fakeCtx()
  apply(f.ctx, {})
  assert.equal(f.command.name, 'heartbeat')
  assert.equal(f.command.recordInput, false)
  const a = agent('s1')
  f.listeners.get('agent/status')({ agent: a, status: 'running' })
  for (const id of ['1', '2', '3']) f.listeners.get('session/event')(a.session, { type: 'tool/call', data: { callId: id, name: 'bash', arguments: '{}' } })
  assert.equal(f.executed.length, 0, 'append is deferred out of the session/event publication')
  await flush()
  assert.equal(f.executed.length, 1)
  assert.equal(f.executed[0].kind, 'error')
  assert.match(f.executed[0].text, /同一工具连续调用 3 次/)
  const manual = await f.command.handler({ agent: a, rawInput: '' })
  assert.match(manual.text, /工具调用：3 次/)
  assert.equal((await f.command.handler({ agent: a, rawInput: ' bogus' })).kind, 'error')
  f.listeners.get('agent/status')({ agent: a, status: 'idle' })
  assert.match((await f.command.handler({ agent: a, rawInput: '' })).text, /没有运行中的任务/)
  for (const d of f.disposers) await d?.()
})

test('subagent sessions are skipped by default', async () => {
  const f = fakeCtx()
  apply(f.ctx, {})
  const child = agent('c1', 'subagent')
  f.listeners.get('agent/status')({ agent: child, status: 'running' })
  for (const id of ['1', '2', '3']) f.listeners.get('session/event')(child.session, { type: 'tool/call', data: { callId: id, name: 'bash', arguments: '{}' } })
  await flush()
  assert.equal(f.executed.length, 0)
  for (const d of f.disposers) await d?.()
})

test('invalid config throws at apply time', () => {
  assert.throws(() => apply(fakeCtx().ctx, { repeatThreshold: 0 }), /repeatThreshold/)
})
