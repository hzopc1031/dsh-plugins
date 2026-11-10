import test from 'node:test'
import assert from 'node:assert/strict'
import { parseOutput, queryHolders, STDOUT_LIMIT, STDERR_LIMIT } from '../lib/query.js'

const sample = { version: 1, ok: true, observedAt: '2026-11-10T02:03:04.1234567Z',
  processes: [{ name: '测试程序', pid: 1234, applicationType: 1, serviceName: '' }] }
const target = { root: 'C:\\project', file: 'C:\\project\\a & $(text).txt' }
const options = () => ({ signal: new AbortController().signal, platform: 'win32' })
function reader(text, extra = {}) {
  return { readFrom(offset) { assert.equal(offset, 0); return { text, nextOffset: Buffer.byteLength(text), lossy: false, ...extra } } }
}
function runtime({ text = JSON.stringify(sample), err = '', outcome = { exitCode: 0, signal: null }, stdoutExtra, stderrExtra, done } = {}) {
  let spec, terminated = 0
  const handle = { collected: { stdout: reader(text, stdoutExtra), stderr: reader(err, stderrExtra) },
    done: done ?? Promise.resolve(outcome), terminate() { terminated++ } }
  return { spawn(value) { spec = value; return handle }, get spec() { return spec }, get terminated() { return terminated } }
}

test('parse normal UTF-8/BOM JSON with PID, application type and service', () => {
  const value = { ...sample, processes: [{ ...sample.processes[0], serviceName: 'ExampleService' }] }
  assert.deepEqual(parseOutput('\uFEFF' + JSON.stringify(value)), { observedAt: sample.observedAt, processes: value.processes })
})
test('parse empty process array', () => {
  assert.deepEqual(parseOutput(JSON.stringify({ ...sample, processes: [] })).processes, [])
})
test('parse structured helper error', () => {
  assert.throws(() => parseOutput('{"version":1,"ok":false,"error":"RmStartSession failed (29)."}'), /RmStartSession failed \(29\)/)
})
for (const [label, value] of [
  ['malformed JSON', '{'], ['empty output', ''], ['noise before JSON', 'noise\n' + JSON.stringify(sample)],
  ['null', 'null'], ['array', '[]'], ['missing version', '{"ok":true}'],
  ['string ok', '{"version":1,"ok":"true"}'], ['bad timestamp', JSON.stringify({ ...sample, observedAt: 'yesterday' })],
  ['missing processes', JSON.stringify({ ...sample, processes: null })],
  ['too many rows', JSON.stringify({ ...sample, processes: Array(1025).fill(sample.processes[0]) })],
  ['missing error', '{"version":1,"ok":false}'],
  ['invalid PID', JSON.stringify({ ...sample, processes: [{ ...sample.processes[0], pid: -1 }] })],
  ['fractional PID', JSON.stringify({ ...sample, processes: [{ ...sample.processes[0], pid: 1.5 }] })],
  ['oversized PID', JSON.stringify({ ...sample, processes: [{ ...sample.processes[0], pid: 4294967296 }] })],
  ['missing program name', JSON.stringify({ ...sample, processes: [{ ...sample.processes[0], name: '' }] })],
  ['control in name', JSON.stringify({ ...sample, processes: [{ ...sample.processes[0], name: 'a\nb' }] })],
  ['invalid app type', JSON.stringify({ ...sample, processes: [{ ...sample.processes[0], applicationType: '1' }] })],
  ['oversized service', JSON.stringify({ ...sample, processes: [{ ...sample.processes[0], serviceName: 'x'.repeat(64) }] })],
]) test('reject output: ' + label, () => { assert.throws(() => parseOutput(value)) })

test('fixed argv passes canonical path as one argument and uses bounded collection without spill', async () => {
  const host = runtime()
  assert.equal((await queryHolders(host, target, options())).processes[0].pid, 1234)
  assert.deepEqual(host.spec.argv.slice(0, 7), ['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', host.spec.argv[6]])
  assert.match(host.spec.argv[6], /file-holder\.ps1$/)
  assert.deepEqual(host.spec.argv.slice(7), ['-Path', target.file])
  assert.equal(host.spec.cwd, target.root)
  assert.deepEqual(host.spec.stdio, { stdin: 'ignore', stdout: { maxBytes: STDOUT_LIMIT }, stderr: { maxBytes: STDERR_LIMIT } })
  assert.equal(host.spec.graceMs, 500)
  assert.ok(host.spec.signal instanceof AbortSignal)
})
test('non-Windows refuses without spawn', async () => {
  await assert.rejects(queryHolders({ spawn() { assert.fail('spawn') } }, target, { ...options(), platform: 'linux' }), /暂不支持（仅 Windows）/)
})
test('pre-cancel refuses without spawn', async () => {
  await assert.rejects(queryHolders({ spawn() { assert.fail('spawn') } }, target, { ...options(), signal: AbortSignal.abort() }), /已取消/)
})
test('in-flight cancellation aborts helper and settles even if provider done never settles', async () => {
  const controller = new AbortController()
  const host = runtime({ done: new Promise(() => {}) })
  const result = queryHolders(host, target, { ...options(), signal: controller.signal })
  controller.abort()
  await assert.rejects(result, /已取消/)
  assert.equal(host.spec.signal.aborted, true)
  assert.equal(host.terminated, 1)
})
test('deadline aborts helper and reports timeout', async () => {
  const host = runtime({ done: new Promise(() => {}) })
  await assert.rejects(queryHolders(host, target, { ...options(), timeoutMs: 10 }), /超时/)
  assert.equal(host.spec.signal.aborted, true)
  assert.equal(host.terminated, 1)
})
for (const [label, config] of [
  ['stdout truncation', { stdoutExtra: { lossy: true } }],
  ['stderr truncation', { stderrExtra: { lossy: true } }],
  ['stdout byte count', { stdoutExtra: { nextOffset: STDOUT_LIMIT + 1 } }],
  ['stderr byte count', { stderrExtra: { nextOffset: STDERR_LIMIT + 1 } }],
  ['oversized UTF-8 stdout', { text: '中'.repeat(STDOUT_LIMIT / 2) }],
]) test('bounded output: ' + label, async () => {
  await assert.rejects(queryHolders(runtime(config), target, options()), /超过上限，已截断/)
})
test('structured nonzero helper exit reports JSON error', async () => {
  await assert.rejects(queryHolders(runtime({ text: '{"version":1,"ok":false,"error":"RmGetList read failed (234)."}',
    outcome: { exitCode: 1, signal: null } }), target, options()), /RmGetList read failed/)
})
test('nonzero exit with success JSON still fails', async () => {
  await assert.rejects(queryHolders(runtime({ outcome: { exitCode: 1, signal: null } }), target, options()), /执行失败/)
})
test('signal exit fails', async () => {
  await assert.rejects(queryHolders(runtime({ text: '', outcome: { exitCode: null, signal: 'SIGTERM' } }), target, options()), /执行失败/)
})
test('stderr causes error without exposing raw diagnostics', async () => {
  await assert.rejects(queryHolders(runtime({ err: 'private diagnostic sentinel' }), target, options()), error => /诊断错误/.test(error.message) && !error.message.includes('sentinel'))
})
test('provider spawn failure is sanitized', async () => {
  await assert.rejects(queryHolders({ spawn() { throw new Error('private diagnostic sentinel') } }, target, options()),
    error => /启动或运行失败/.test(error.message) && !error.message.includes('sentinel'))
})
test('provider done rejection is sanitized', async () => {
  await assert.rejects(queryHolders(runtime({ done: Promise.reject(new Error('private diagnostic sentinel')) }), target, options()),
    error => /启动或运行失败/.test(error.message) && !error.message.includes('sentinel'))
})
test('success clears abort listener and deadline', async () => {
  const controller = new AbortController()
  const host = runtime()
  await queryHolders(host, target, { ...options(), signal: controller.signal, timeoutMs: 10 })
  controller.abort()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(host.spec.signal.aborted, false)
  assert.equal(host.terminated, 0)
})
test('abort during synchronous spawn failure is contained and classified as cancellation', async () => {
  const controller = new AbortController()
  await assert.rejects(queryHolders({ spawn() { controller.abort(); throw new Error('spawn failed') } }, target,
    { ...options(), signal: controller.signal }), /已取消/)
})
test('provider cleanup exception does not mask cancellation', async () => {
  const controller = new AbortController()
  const result = queryHolders({ spawn() { return { done: new Promise(() => {}), terminate() { throw new Error('cleanup failed') } } } },
    target, { ...options(), signal: controller.signal })
  controller.abort()
  await assert.rejects(result, /已取消/)
})
