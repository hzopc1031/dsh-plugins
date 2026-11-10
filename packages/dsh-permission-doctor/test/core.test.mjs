import test from 'node:test'
import assert from 'node:assert/strict'
import { collectCalls, diagnose, render, targets, display, bashFacts, permissionsAt } from '../lib/core.js'
import { fixture, liveBash } from './fixtures.mjs'
const first = (f, live = []) => collectCalls(f.events, live, 'C:\\project')[0]
const category = options => diagnose(first(fixture(options))).category

for (const [label, options, expected] of [
  ['Auto rule code', { code: 'AUTO_REVIEW_DENIED' }, 'rule-denied'],
  ['FS structured sandbox', { code: 'FS_SANDBOX_DENIED' }, 'sandbox-denied'],
  ['unavailable answerer', { outcome: 'unavailable' }, 'approval-unavailable'],
  ['ask rejection', { outcome: 'rejected' }, 'user-rejected'],
  ['never rejection is policy not a user click', { policy: 'never', outcome: 'rejected' }, 'rule-denied'],
  ['unknown rejection policy', { policy: null, outcome: 'rejected' }, 'unknown'],
  ['missing permission state', { prefix: false, outcome: 'rejected' }, 'unknown'],
  ['no error metadata', {}, 'unknown'],
  ['permission denied text cannot establish sandbox', { content: 'EACCES Permission denied sandbox denied' }, 'unknown'],
  ['cancelled is not rejection', { outcome: 'cancelled' }, 'unknown'],
  ['pending approval', { outcome: null }, 'unknown'],
  ['allowed approval does not explain subsequent failure', { outcome: 'allowed-once' }, 'unknown'],
  ['unknown outcome', { outcome: 'granted' }, 'unknown'],
  ['unknown tool', { code: 'UNKNOWN_TOOL' }, 'system-error'],
  ['tool timeout', { code: 'TOOL_TIMEOUT' }, 'system-error'],
  ['output error', { code: 'INVALID_TOOL_OUTPUT' }, 'system-error'],
  ['unknown third-party code', { code: 'PERMISSION_DENIED' }, 'unknown'],
  ['conflicting denial and unavailable', { code: 'FS_SANDBOX_DENIED', outcome: 'unavailable' }, 'unknown'],
]) test(label, () => assert.equal(category(options), expected))

test('normal sandbox rejection need not enter approval; no promise of a popup', () => {
  const c = first(fixture({ code: 'FS_SANDBOX_DENIED' }))
  assert.match(diagnose(c).approvalFlow, /未见匹配/)
  assert.match(diagnose(c).approvalFlow, /不会自动/)
  assert.match(render(c), /不保证自动弹审批/)
})
test('never asked/decided is audited but never dispatched', () => {
  assert.match(diagnose(first(fixture({ policy: 'never', outcome: 'rejected' }))).approvalFlow, /应答器派发前拒绝/)
})
test('ask rejected never proves human UI or human identity', () => {
  const d = diagnose(first(fixture({ outcome: 'rejected' })))
  assert.match(d.explanation, /也可能是机器/)
  assert.match(d.approvalFlow, /不是弹窗展示凭证/)
})
test('state is frozen at call, not at command or later changes', () => {
  const f = fixture()
  f.add('approval/policy', { policy: 'never' }); f.add('sandbox/mode', { mode: 'danger-full-access' })
  const c = first(f)
  assert.equal(c.permissions.approval.value, 'ask')
  assert.equal(c.permissions.sandbox.value, 'workspace-write')
  assert.equal(permissionsAt(f.events).approval.value, 'never')
})
test('policy at asked is independent of call start', () => {
  const f = fixture({ outcome: 'rejected' })
  const index = f.events.findIndex(e => e.type === 'approval/asked')
  f.events.splice(index, 0, { type: 'approval/policy', data: { policy: 'never' } })
  f.events.forEach((e, i) => { e.seq = i })
  assert.equal(first(f).permissions.approval.value, 'ask')
  assert.equal(diagnose(first(f)).category, 'rule-denied')
})
test('missing fields remain missing, preset name does not supply a guessed bundle', () => {
  const f = fixture({ prefix: false })
  f.events.unshift({ type: 'permission/preset', data: { preset: 'danger-full-access' } })
  f.events.forEach((e, i) => { e.seq = i })
  assert.equal(first(f).permissions.sandbox.value, null)
  assert.equal(first(f).permissions.approval.value, null)
})
test('approval joins exact call ID and request ID, never by same tool', () => {
  const f = fixture({ outcome: 'rejected' })
  f.events.find(e => e.type === 'approval/asked').data.callId = 'other'
  assert.deepEqual(first(f).approvals, [])
  assert.equal(diagnose(first(f)).category, 'unknown')
})
test('missing callId, wrong tool, and unrelated decisions cannot be borrowed', () => {
  for (const mode of ['missing', 'tool']) {
    const f = fixture({ outcome: 'rejected' })
    const ask = f.events.find(e => e.type === 'approval/asked')
    if (mode === 'missing') delete ask.data.callId
    else ask.data.toolName = 'bash'
    assert.equal(first(f).approvals.length, 0)
  }
})
test('orphan decision or duplicate decision makes attribution uncertain', () => {
  for (const broken of ['orphan', 'duplicate']) {
    const f = fixture({ outcome: 'rejected' }), d = f.events.find(e => e.type === 'approval/decided')
    if (broken === 'orphan') d.data.id = 'not-asked'
    else f.events.splice(d.seq, 0, structuredClone(d))
    f.events.forEach((e, i) => { e.seq = i })
    assert.equal(diagnose(first(f)).category, 'unknown')
  }
})
test('non-contiguous or reordered logs cannot produce a definite cause', () => {
  const f = fixture({ code: 'AUTO_REVIEW_DENIED' })
  f.events[1].seq = 17
  assert.equal(diagnose(first(f)).category, 'unknown')
})
test('missing start event is unknown even with structured denial', () => {
  const f = fixture({ code: 'AUTO_REVIEW_DENIED' })
  f.events = f.events.filter(e => e.type !== 'tool/call').map((e, seq) => ({ ...e, seq }))
  assert.equal(diagnose(first(f)).category, 'unknown')
})
test('PTC nested ID is opaque; start and settled records match exact bytes', () => {
  const f = fixture({ code: 'FS_SANDBOX_DENIED' })
  const start = f.events.find(e => e.type === 'tool/call'), end = f.events.at(-1)
  start.type = 'tool/ptc-dispatch-start'; start.data.subCallId = 'root:ptc:odd'
  delete start.data.callId
  end.type = 'tool/ptc-dispatch'
  end.data = { subCallId: 'root:ptc:odd', name: 'write', arguments: start.data.arguments, isError: true, error: { code: 'FS_SANDBOX_DENIED' }, content: [{ type: 'text', text: 'blocked' }] }
  assert.equal(first(f).id, 'root:ptc:odd')
  assert.equal(diagnose(first(f)).category, 'sandbox-denied')
})
test('structured bash sandbox denial is found even with isError false', () => {
  const f = fixture({ name: 'bash', isError: false, content: 'blocked' })
  const c = first(f, [liveBash(f.resultSeq, { denied: true })])
  assert.equal(c.candidate, true)
  assert.equal(diagnose(c).category, 'sandbox-denied')
})
test('bash runner failure cannot be mislabeled as sandbox refusal', () => {
  const f = fixture({ name: 'bash', isError: false })
  assert.equal(diagnose(first(f, [liveBash(f.resultSeq, { denied: true, runnerFailed: true })])).category, 'system-error')
})
test('structured bash exit/timeout and OS access errors are ordinary execution failures', () => {
  const f = fixture({ name: 'bash', isError: false, content: 'EACCES' })
  assert.equal(diagnose(first(f, [liveBash(f.resultSeq)])).category, 'system-error')
})
test('shell output can spoof markers, therefore historical markers remain unknown', () => {
  const f = fixture({ name: 'bash', isError: false, content: '[sandbox: file access denied under workspace-write mode]\n[exit code: 1]' })
  assert.equal(first(f).candidate, true)
  assert.equal(diagnose(first(f)).category, 'unknown')
})
test('ordinary successful calls are not failure candidates', () => {
  assert.equal(first(fixture({ isError: false, content: 'ok' })).candidate, false)
})
test('live observation needs exact identity and temporal interval', () => {
  const f = fixture({ name: 'bash', isError: false })
  for (const change of [{ callId: 'other' }, { name: 'write' }, { anchor: 0 }, { anchor: f.resultSeq + 1 }]) {
    assert.equal(first(f, [{ ...liveBash(f.resultSeq, { denied: true }), ...change }]).live, undefined)
  }
})
test('duplicate runtime observations are not used', () => {
  const f = fixture({ name: 'bash' }), o = liveBash(f.resultSeq)
  assert.equal(first(f, [o, o]).live, undefined)
  assert.equal(diagnose(first(f, [o, o])).category, 'unknown')
})
test('repeated call IDs are scoped by interval and selected by result seq', () => {
  const f = fixture({ outcome: 'rejected' })
  f.add('tool/call', { callId: 'call-a', name: 'write', arguments: '{}' })
  f.add('tool/result', { message: { toolCallId: 'call-a', isError: true, content: [] }, error: { code: 'UNKNOWN_TOOL' } })
  const calls = collectCalls(f.events)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].approvals.length, 0)
  assert.equal(diagnose(calls[1]).category, 'system-error')
})
test('target extraction never invents paths from shell text', () => {
  assert.deepEqual(targets({ command: 'echo C:\\secret', workdir: 'C:\\project' }), [])
  assert.deepEqual(targets({ path: '../a', paths: ['b', 42] }), ['path=../a', 'paths=b'])
})
test('redaction, bounded output and control characters', () => {
  const s = display('Bearer abcDEF\napi_key=secret\nghp_test\n-----BEGIN PRIVATE KEY-----\nbody\n-----END PRIVATE KEY-----\x1b')
  for (const secret of ['abcDEF', '=secret', 'ghp_test', 'body', '\x1b']) assert.equal(s.includes(secret), false)
  assert.match(display('a'.repeat(100), 10), /截断/)
})
test('only official bash foreground structural facts are extracted', () => {
  const v = { kind: 'foreground', cwd: 'C:\\p', exitCode: 1, timedOut: false, aborted: false, sandbox: { mode: 'workspace-write', denied: true } }
  assert.equal(bashFacts('bash', v).denied, true)
  assert.equal(bashFacts('custom', v), undefined)
  assert.equal(bashFacts('bash', '[sandbox denied]'), undefined)
})
test('same-mode sandbox request does not imply an escalation prompt', () => {
  const f = fixture({ code: 'FS_SANDBOX_DENIED', args: { path: '/a', sandbox_permissions: 'workspace-write' } })
  assert.match(diagnose(first(f)).approvalFlow, /同档执行无需/)
})
test('report contains all required evidence and omits arbitrary arguments', () => {
  const f = fixture({ outcome: 'unavailable', args: { path: '/target', body: 'never-display-this-body' } })
  const output = render(first(f))
  for (const s of ['权限档位', '审批策略', '目标路径', '审批记录', '工具结果', '处理建议', 'approval/asked']) assert.match(output, new RegExp(s))
  assert.equal(output.includes('never-display-this-body'), false)
})
