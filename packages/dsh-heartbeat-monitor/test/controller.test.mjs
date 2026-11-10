import test from 'node:test'
import assert from 'node:assert/strict'
import { HeartbeatController } from '../lib/controller.js'
import { activityOf } from '../lib/events.js'
import { resolveSettings } from '../lib/core.js'
import { notifyCommand } from '../lib/notify.js'

const MIN = 60_000
function setup(overrides = {}) {
  let t = 0
  const out = []
  const c = new HeartbeatController({ settings: resolveSettings(overrides), now: () => t, deliver: (id, a) => out.push([id, a.kind]) })
  return { c, out, at: v => { t = v } }
}
const call = (id, name, args = '{}') => ({ type: 'tool/call', data: { turn: 1, step: 1, callId: id, name, arguments: args } })
const result = (id, isError = false, extra = {}) => ({ type: 'tool/result', data: { turn: 1, step: 1, message: { role: 'tool', toolCallId: id, isError, content: [{ type: 'text', text: 'ERR: disk full' }] }, ...extra } })

test('a 42-minute run gets progress cards, a silence warning and a closing card', () => {
  const { c, out, at } = setup()
  c.status('s1', 'running')
  for (let m = 1; m <= 42; m++) {
    at(m * MIN)
    if (m <= 20) c.event('s1', call(`c${m}`, 'bash', `{"i":${m}}`))
    c.tick()
  }
  c.status('s1', 'idle')
  const kinds = out.map(([, k]) => k)
  assert.equal(kinds.filter(k => k === 'progress').length, 8)
  assert.equal(kinds.filter(k => k === 'silence').length, 2) // at 30 and 40 minutes
  assert.equal(kinds.at(-1), 'finished')
  assert.equal(c.active, false)
  at(60 * MIN); c.tick()
  assert.equal(out.length, kinds.length) // timer stopped after the run ended
})

test('short run gets no closing card; idle without running is ignored', () => {
  const { c, out, at } = setup()
  c.status('x', 'idle')
  c.status('s', 'running')
  at(2 * MIN); c.tick(); c.status('s', 'idle')
  assert.deepEqual(out, [])
})

test('events only count for tracked sessions and repeat alerts are delivered at once', () => {
  const { c, out } = setup()
  c.event('nope', call('a', 'bash'))
  c.status('s', 'running')
  c.event('s', call('a', 'bash')); c.event('s', call('b', 'bash')); c.event('s', call('c', 'bash'))
  assert.deepEqual(out, [['s', 'repeat-tool']])
  assert.equal(c.snapshot('s').kind, 'progress')
  assert.match(c.snapshot('s').text, /工具调用：3 次/)
  assert.equal(c.snapshot('other'), undefined)
})

test('enabled=false tracks nothing', () => {
  const { c, out, at } = setup({ enabled: false })
  c.status('s', 'running'); at(60 * MIN); c.tick()
  assert.equal(c.active, false)
  assert.deepEqual(out, [])
})

test('session-log mapping: tool names, errors, retries, turn errors', () => {
  const names = new Map()
  assert.deepEqual(activityOf(call('k', 'read', '{"path":"a"}'), names), { kind: 'tool-call', callId: 'k', name: 'read', argsKey: '{"path":"a"}' })
  const r = activityOf(result('k', true, { error: { name: 'ToolError', code: 'ENOSPC', reason: 'no space' } }), names)
  assert.equal(r.name, 'read'); assert.equal(r.isError, true); assert.equal(r.errorKey, 'ENOSPC:no space')
  assert.equal(names.size, 0)
  assert.equal(activityOf(result('unknown', true), names).errorText, '未知工具：ERR: disk full')
  const retry = activityOf({ type: 'llm/retry', data: { retry: 2, failure: { code: 'NETWORK', message: 'fetch failed' } } }, names)
  assert.deepEqual(retry, { kind: 'retry', attempt: 2, errorKey: 'NETWORK:fetch failed', errorText: '模型请求 NETWORK：fetch failed' })
  assert.equal(activityOf({ type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } }, names), undefined)
  assert.equal(activityOf({ type: 'turn/end', data: { turn: 1, reason: { kind: 'error', error: { code: 'X', message: 'y' } } } }, names).kind, 'error')
  assert.equal(activityOf({ type: 'step/start', data: {} }, names).kind, 'step')
  assert.equal(activityOf({ type: 'command/run', data: {} }, names), undefined)
})

test('notification commands never put text on the command line', () => {
  for (const p of ['win32', 'darwin', 'linux']) {
    const cmd = notifyCommand(p)
    assert.ok(cmd)
    assert.ok(cmd.args.join(' ').includes('DSH_HEARTBEAT_BODY'))
  }
  assert.equal(notifyCommand('aix'), undefined)
})
