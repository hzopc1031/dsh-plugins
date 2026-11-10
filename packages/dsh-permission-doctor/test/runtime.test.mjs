import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import Commands from '@deepseek-ai/dsh-commands'
import Tools, { defineTool } from '@deepseek-ai/dsh-tools'
import Approval from '@deepseek-ai/dsh-user-approval'
import * as plugin from '../index.js'

async function harness({ policy = 'ask', approval = true } = {}) {
  const ctx = new Context(), events = [], disposers = []; let pluginScope
  const session = {
    id: 'doctor-session', header: { id: 'doctor-session', cwd: 'C:\\project' },
    get seq() { return events.length },
    eventAt(seq) { return events[seq] },
    snapshotEvents() { return events.slice() },
    append(type, data) { const seq = events.length; events.push({ seq, time: 1000 + seq, type, data }); return seq },
  }
  session.append('turn/start', { turn: 1 })
  session.append('permission/preset', { preset: 'workspace-write' })
  session.append('sandbox/mode', { mode: 'workspace-write' })
  session.append('approval/policy', { policy })
  const agent = { id: 'doctor-agent', session }
  disposers.push(ctx.provide('systemPrompt', { tools() {}, context() {}, getContextOrder() { return 1 } }))
  for (const mod of [Commands, Tools, ...(approval ? [Approval] : []), plugin]) {
    const scope = ctx.plugin(mod); if (mod === plugin) pluginScope = scope
    await scope
    disposers.push(() => scope.dispose())
  }
  let bodyRuns = 0
  disposers.push(ctx.tools.register(defineTool({
    name: 'probe', parameters: {},
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    execute() { bodyRuns++; return 'ok' },
  })))
  const signal = new AbortController().signal
  const command = async line => (await ctx.commands.execute(agent, '/permission-doctor ' + line, [], signal)).result
  async function invoke(name = 'probe') {
    const callId = 'runtime-' + events.length
    session.append('tool/call', { callId, name, arguments: '{}', turn: 1, step: 1 })
    const result = await ctx.tools.execute({ callId, name, arguments: {}, agent, signal })
    const seq = session.append('tool/result', {
      turn: 1, step: 1, message: { toolCallId: callId, content: result.content, isError: result.isError },
      ...(result.error?.info ? { error: result.error.info } : {}),
    })
    return { result, seq }
  }
  return { ctx, events, session, agent, command, invoke, signal, get bodyRuns() { return bodyRuns },
    unload: () => pluginScope.dispose(), close: async () => { for (const d of disposers.reverse()) await d() } }
}
test('real rc.5 Tools rule denial reaches observer; command never reruns the tool', async () => {
  const h = await harness()
  try {
    h.ctx.on('tools/pre-execute', async () => ({ kind: 'deny', reason: 'fixed rule', info: { name: 'AutoReviewDeniedError', code: 'AUTO_REVIEW_DENIED' } }))
    const { result, seq } = await h.invoke()
    assert.equal(result.isError, true)
    assert.equal(h.bodyRuns, 0)
    assert.equal(h.events.some(e => e.type === 'approval/asked'), false)
    const report = await h.command('show ' + seq)
    assert.equal(report.kind, 'success'); assert.match(report.text, /诊断：规则拒绝/)
    assert.match(report.text, /直接规则拒绝/)
    assert.equal(h.bodyRuns, 0)
    assert.equal(plugin.name, 'permission-doctor')
    assert.deepEqual(plugin.Config({}), {})
  } finally { await h.close() }
})
for (const [title, options, answer, expected] of [
  ['missing service has no audit and remains unknown', { approval: false }, null, '原因未确定'],
  ['missing answerer fails closed', {}, null, '审批不可用'],
  ['never rejects without dispatching an answerer', { policy: 'never' }, 'allowed-once', '规则拒绝'],
  ['answerer rejected is not proof of a human click', {}, 'rejected', '用户拒绝'],
  ['answerer failure becomes unavailable', {}, 'throw', '审批不可用'],
]) test('real rc.5 approval: ' + title, async () => {
  const h = await harness(options)
  let answerRuns = 0
  try {
    h.ctx.on('tools/pre-execute', async () => ({ kind: 'ask', reason: 'needs approval' }))
    if (answer) h.ctx.on('approval/request', async () => {
      answerRuns++
      if (answer === 'throw') throw new Error('answerer test failure')
      return answer
    })
    const { result, seq } = await h.invoke()
    assert.equal(result.isError, true)
    const report = await h.command('show ' + seq)
    assert.match(report.text, new RegExp('诊断：' + expected))
    assert.equal(h.bodyRuns, 0)
    const audits = h.events.filter(e => e.type.startsWith('approval/') && e.type !== 'approval/policy')
    assert.equal(audits.length, options.approval === false ? 0 : 2)
    if (options.policy === 'never') assert.equal(answerRuns, 0)
    if (answer === 'rejected') assert.match(report.text, /也可能是机器/)
  } finally { await h.close() }
})
test('real rc.5 bash canonical sandbox result is a failed candidate even with isError=false', async () => {
  const h = await harness()
  let calls = 0
  try {
    h.ctx.tools.register(defineTool({
      name: 'bash', parameters: {}, output: { schema: { type: 'json' }, render: () => [{ type: 'text', text: '[sandbox: file access denied under workspace-write mode]' }] },
      execute() { calls++; return { kind: 'foreground', cwd: 'C:\\project', exitCode: 1, timedOut: false, aborted: false, sandbox: { mode: 'workspace-write', denied: true } } },
    }))
    const { result, seq } = await h.invoke('bash')
    assert.equal(result.isError, false)
    assert.match((await h.command('list')).text, /沙箱拒绝/)
    assert.match((await h.command('show ' + seq)).text, /结构化 bash 观察/)
    assert.equal(calls, 1)
  } finally { await h.close() }
})
test('command validation, cancellation and current-session query read remain read-only', async () => {
  const h = await harness()
  try {
    assert.match((await h.command('')).text, /只读/)
    for (const input of ['bogus', 'show', 'show -1', 'list 1e6', 'show 9007199254740992', 'show 1 extra']) {
      assert.equal((await h.command(input)).kind, 'error')
    }
    assert.match((await h.command('list')).text, /没有记录/)
    assert.equal((await h.command('show 0')).kind, 'error')
    let reads = 0
    const stop = h.ctx.provide('sessionQuery', { async readSession(id) { reads++; assert.equal(id, h.session.id); return { events: h.session.snapshotEvents() } } })
    try { await h.command('list'); assert.equal(reads, 1) } finally { stop() }
    const fail = h.ctx.provide('sessionQuery', { async readSession() { throw new Error('secret must not echo') } })
    try { const report = await h.command('list'); assert.equal(report.kind, 'error'); assert.equal(report.text.includes('secret'), false) } finally { fail() }
    assert.equal(h.bodyRuns, 0)
    await h.unload()
    assert.equal(h.ctx.commands.find(h.agent, 'permission-doctor'), undefined)
  } finally { await h.close() }
  assert.equal(h.ctx.commands?.find(h.agent, 'permission-doctor'), undefined)
})
test('list pagination selects result seq without exposing tool contents', async () => {
  const h = await harness()
  try {
    h.ctx.on('tools/pre-execute', async () => ({ kind: 'deny', reason: 'PRIVATE_RESULT_BODY' }))
    for (let i = 0; i < 23; i++) await h.invoke()
    const page = (await h.command('list')).text
    assert.equal(page.includes('PRIVATE_RESULT_BODY'), false)
    assert.equal((page.match(/^#/gm) ?? []).length, 20)
    const cursor = /较早记录：\/permission-doctor list (\d+)/.exec(page)[1]
    assert.equal(((await h.command('list ' + cursor)).text.match(/^#/gm) ?? []).length, 3)
    assert.equal(h.bodyRuns, 0)
  } finally { await h.close() }
})
