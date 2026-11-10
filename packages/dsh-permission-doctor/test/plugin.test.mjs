import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../index.js'
function fake() {
  const listeners = new Map(), disposers = []
  let command
  const ctx = {
    get() { return undefined },
    on(name, handler) { listeners.set(name, handler) },
    effect(fn) { const d = fn(); disposers.push(d); return d },
    commands: { register(def) { command = def; return () => { command = undefined } } },
  }
  apply(ctx)
  return { ctx, listeners, disposers, get command() { return command } }
}
function agent(id = 's1') {
  const events = []
  const session = { id, header: { cwd: 'C:\\project' }, snapshotEvents: () => events.slice(),
    append(type, data) { const seq = events.length; events.push({ seq, time: 1000 + seq, type, data }); return seq } }
  session.append('sandbox/mode', { mode: 'workspace-write' })
  session.append('approval/policy', { policy: 'ask' })
  return { session }
}
const signal = new AbortController().signal

test('incremental call-time permission snapshots preserve previous policy and see new overrides',async()=>{
  const f=fake(), a=agent(), pre=f.listeners.get('tools/pre-execute'), result=f.listeners.get('tools/result')
  let last
  for(let i=0;i<3;i++) {
    if(i===2) a.session.append('approval/policy',{policy:'never'})
    const callId='cached-'+i,token=Symbol(callId),exec={callId,token,name:'fixture',agent:a,arguments:{}}
    a.session.append('tool/call',{callId,name:'fixture',arguments:'{}'})
    await pre(exec,async()=>({kind:'allow'}))
    result(exec,{isError:true,error:new Error('fixture')})
    last=a.session.append('tool/result',{message:{toolCallId:callId,isError:true,content:[]}})
    const shown=await f.command.handler({agent:a,rawInput:'show '+last,signal})
    assert.equal(shown.kind,'success')
    assert.ok(shown.text.includes('调用时审批策略：'+(i===2?'never':'ask')))
  }
  const again=await f.command.handler({agent:a,rawInput:'show '+last,signal})
  assert.match(again.text,/调用时审批策略：never/)
})
test('cancelled direct command does not query or read evidence', async () => {
  const f = fake()
  const controller = new AbortController(); controller.abort()
  const a = agent(); a.session.snapshotEvents = () => { throw new Error('must not read') }
  const r = await f.command.handler({ agent: a, rawInput: 'list', signal: controller.signal })
  assert.equal(r.kind, 'error')
  assert.match(r.text, /已取消/)
})
test('pre-execute snapshot failure delegates the unchanged next decision', async () => {
  const f = fake(), a = agent()
  a.session.snapshotEvents = () => { throw new Error('diagnostic unavailable') }
  const decision = { kind: 'allow' }
  const r = await f.listeners.get('tools/pre-execute')({ token: {}, agent: a }, async () => decision)
  assert.equal(r, decision)
})
test('300-observation bound, session isolation and disposal', async () => {
  const f = fake(), a = agent()
  let firstSeq, lastSeq
  for (let i = 0; i < 301; i++) {
    const callId = 'c' + i, token = {}
    a.session.append('tool/call', { callId, name: 'bash', arguments: '{}' })
    const exec = { callId, token, name: 'bash', agent: a, arguments: {} }
    await f.listeners.get('tools/pre-execute')(exec, async () => ({ kind: 'allow' }))
    f.listeners.get('tools/result')(exec, { isError: false,
      value: { kind: 'foreground', cwd: 'C:\\project', exitCode: 1, timedOut: false, aborted: false, sandbox: { mode: 'workspace-write', denied: true } } })
    lastSeq = a.session.append('tool/result', { message: { toolCallId: callId, isError: false, content: [{ type: 'text', text: '[sandbox: file access denied under workspace-write mode]' }] } })
    firstSeq ??= lastSeq
  }
  const show = seq => f.command.handler({ agent: a, rawInput: 'show ' + seq, signal })
  assert.match((await show(firstSeq)).text, /诊断：原因未确定/)
  assert.match((await show(lastSeq)).text, /诊断：沙箱拒绝/)
  const other = agent('s2')
  other.session.snapshotEvents = a.session.snapshotEvents
  assert.match((await f.command.handler({ agent: other, rawInput: 'show ' + lastSeq, signal })).text, /诊断：原因未确定/)
  const handler = f.command.handler
  for (const dispose of f.disposers) dispose?.()
  assert.equal(f.command, undefined)
  assert.equal((await handler({ agent: a, rawInput: 'list', signal })).kind, 'error')
})
test('historical timeout and killed markers are uncertain candidates', async () => {
  const f = fake(), a = agent()
  for (const text of ['[timed out after 120000ms]', '[killed by signal: SIGTERM]']) {
    a.session.append('tool/call', { callId: text, name: 'bash', arguments: '{}' })
    const seq = a.session.append('tool/result', { message: { toolCallId: text, isError: false, content: [{ type: 'text', text }] } })
    assert.match((await f.command.handler({ agent: a, rawInput: 'show ' + seq, signal })).text, /诊断：原因未确定/)
  }
})
