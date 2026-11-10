import test from 'node:test'
import assert from 'node:assert/strict'
import { argumentsKey, clip, defaults, endRun, formatDuration, recordActivity, resolveSettings, startRun, tick } from '../lib/core.js'

const MIN = 60_000
const S = resolveSettings({})

test('defaults are N=5, M=10, K=3, notifications off', () => {
  assert.equal(S.intervalMinutes, 5)
  assert.equal(S.silenceMinutes, 10)
  assert.equal(S.repeatThreshold, 3)
  assert.equal(S.systemNotification, false)
  assert.equal(S.enabled, true)
})

test('config validation rejects bad values', () => {
  assert.throws(() => resolveSettings({ intervalMinutes: 0 }), /intervalMinutes/)
  assert.throws(() => resolveSettings({ intervalMinutes: Number.NaN }), /intervalMinutes/)
  assert.throws(() => resolveSettings({ silenceMinutes: -1 }), /silenceMinutes/)
  assert.throws(() => resolveSettings({ silenceMinutes: 2000 }), /silenceMinutes/)
  assert.throws(() => resolveSettings({ repeatThreshold: 1 }), /repeatThreshold/)
  assert.throws(() => resolveSettings({ repeatThreshold: 2.5 }), /repeatThreshold/)
  assert.throws(() => resolveSettings({ enabled: 'yes' }), /enabled/)
  assert.deepEqual(resolveSettings({ intervalMinutes: 1, repeatThreshold: 5 }), { ...defaults, intervalMinutes: 1, repeatThreshold: 5 })
})

test('progress card every N minutes with elapsed, tool count and last activity', () => {
  const st = startRun(0, S)
  assert.deepEqual(tick(st, 4 * MIN, S), [])
  recordActivity(st, { kind: 'tool-call', callId: 'a', name: 'bash', argsKey: '1' }, 4 * MIN, S)
  recordActivity(st, { kind: 'tool-result', callId: 'a', name: 'bash', isError: false }, 4.5 * MIN, S)
  const [card] = tick(st, 5 * MIN, S)
  assert.equal(card.kind, 'progress')
  assert.match(card.text, /已运行 5 分 0 秒/)
  assert.match(card.text, /工具调用：1 次/)
  assert.match(card.text, /工具 bash 完成，耗时 30 秒/)
  assert.deepEqual(tick(st, 6 * MIN, S), [])
  assert.equal(tick(st, 10 * MIN, S)[0].kind, 'progress')
})

test('missed intervals are skipped, not replayed', () => {
  const st = startRun(0, { ...S, silenceMinutes: 1000 })
  const alerts = tick(st, 23 * MIN, { ...S, silenceMinutes: 1000 })
  assert.equal(alerts.filter(a => a.kind === 'progress').length, 1)
  assert.equal(st.nextProgressAt, 25 * MIN)
})

test('progressCards=false suppresses progress but not warnings', () => {
  const s = { ...S, progressCards: false }
  const st = startRun(0, s)
  const alerts = tick(st, 10 * MIN, s)
  assert.deepEqual(alerts.map(a => a.kind), ['silence'])
})

test('silence warning after M minutes, once per silence period, reset by activity', () => {
  const s = { ...S, intervalMinutes: 1000 }
  const st = startRun(0, s)
  assert.deepEqual(tick(st, 9.9 * MIN, s), [])
  const [warn] = tick(st, 10 * MIN, s)
  assert.equal(warn.kind, 'silence')
  assert.match(warn.text, /10 分 0 秒 没有任何新活动/)
  assert.deepEqual(tick(st, 15 * MIN, s), [])
  assert.equal(tick(st, 20 * MIN, s)[0].kind, 'silence')
  recordActivity(st, { kind: 'step' }, 21 * MIN, s)
  assert.deepEqual(tick(st, 30 * MIN, s), [])
  assert.equal(tick(st, 31 * MIN, s)[0].kind, 'silence')
})

test('silence warning names a long-running tool', () => {
  const s = { ...S, intervalMinutes: 1000 }
  const st = startRun(0, s)
  recordActivity(st, { kind: 'tool-call', callId: 'x', name: 'pwsh', argsKey: '{}' }, 1 * MIN, s)
  const [warn] = tick(st, 11 * MIN, s)
  assert.match(warn.text, /正在执行：pwsh（已 10 分 0 秒）/)
})

test('repeated identical tool call warns at K and 2K only', () => {
  const st = startRun(0, S)
  const call = (i, args = '{"cmd":"npm test"}') => recordActivity(st, { kind: 'tool-call', callId: `c${i}`, name: 'bash', argsKey: args }, i * 1000, S)
  assert.deepEqual(call(1), [])
  assert.deepEqual(call(2), [])
  const [w] = call(3)
  assert.equal(w.kind, 'repeat-tool')
  assert.match(w.text, /连续调用 3 次（参数完全相同）/)
  assert.deepEqual(call(4), [])
  assert.deepEqual(call(5), [])
  assert.equal(call(6)[0].kind, 'repeat-tool')
  assert.deepEqual(call(7, '{"cmd":"ls"}'), [])
  assert.equal(st.toolStreak, 1)
})

test('different arguments do not count unless repeatByNameOnly', () => {
  const st = startRun(0, S)
  for (let i = 0; i < 5; i++) assert.deepEqual(recordActivity(st, { kind: 'tool-call', callId: `c${i}`, name: 'read', argsKey: String(i) }, i, S), [])
  const s = { ...S, repeatByNameOnly: true }
  const st2 = startRun(0, s)
  const out = [0, 1, 2].flatMap(i => recordActivity(st2, { kind: 'tool-call', callId: `c${i}`, name: 'read', argsKey: String(i) }, i, s))
  assert.equal(out.length, 1)
  assert.doesNotMatch(out[0].text, /参数完全相同/)
})

test('repeated identical error warns at K; a success resets the streak', () => {
  const st = startRun(0, S)
  const fail = i => recordActivity(st, { kind: 'tool-result', callId: `c${i}`, name: 'bash', isError: true, errorKey: 'E1:boom', errorText: 'bash：boom' }, i, S)
  assert.deepEqual(fail(1), [])
  recordActivity(st, { kind: 'tool-result', callId: 'ok', name: 'bash', isError: false }, 2, S)
  assert.deepEqual(fail(3), [])
  assert.deepEqual(fail(4), [])
  const [w] = fail(5)
  assert.equal(w.kind, 'repeat-error')
  assert.match(w.text, /同一错误连续出现 3 次/)
  assert.equal(st.toolErrors, 4)
})

test('LLM retries with the same failure count as repeated errors', () => {
  const st = startRun(0, S)
  const retry = i => recordActivity(st, { kind: 'retry', attempt: i, errorKey: 'NETWORK:ETIMEDOUT', errorText: '模型请求 NETWORK：ETIMEDOUT' }, i, S)
  assert.deepEqual([...retry(1), ...retry(2)], [])
  const [w] = retry(3)
  assert.equal(w.kind, 'repeat-error')
  assert.match(w.text, /模型重试 3 次/)
  assert.match(st.lastActivity, /第 3 次重试/)
})

test('after endRun no timers or rules fire', () => {
  const st = startRun(0, S)
  const fin = endRun(st, 42 * MIN)
  assert.equal(fin.kind, 'finished')
  assert.match(fin.text, /总用时 42 分 0 秒/)
  assert.deepEqual(tick(st, 100 * MIN, S), [])
  assert.deepEqual(recordActivity(st, { kind: 'tool-call', callId: 'z', name: 'bash', argsKey: '' }, 101 * MIN, S), [])
  assert.equal(st.toolCalls, 0)
})

test('helpers: duration, clipping/redaction, stable argument keys', () => {
  assert.equal(formatDuration(45_000), '45 秒')
  assert.equal(formatDuration(3_725_000), '1 小时 2 分')
  assert.equal(clip('api_key=abc123 Bearer xyz sk-SECRET'), 'api_key=[REDACTED] Bearer [REDACTED] [REDACTED]')
  assert.equal(clip('x'.repeat(300)).length, 120)
  assert.equal(argumentsKey('{"b":1,"a":2}'), argumentsKey('{ "a": 2, "b": 1 }'))
  assert.equal(argumentsKey('not json'), '"not json"')
})
