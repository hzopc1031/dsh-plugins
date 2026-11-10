import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { study, ID } from './fixtures.mjs'
import { observationTemplate } from '../lib/core.js'
const require=createRequire(import.meta.url)
async function setup(t) {
  const dom=new JSDOM('<div id="root"></div>'), saved=new Map(), calls=[]
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true})) {
    saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value})
  }
  let client
  window.__ModuleLoader__={load:row=>{assert.equal(row.id,'dsh-plugin-combo-lab');client=row.factory(id=>{
    if(id==='@deepseek-ai/dsh-client-ui-primitives') return {Modal:({open,children,onClose})=>open?React.createElement('div',{role:'dialog'},children,React.createElement('button',{onClick:onClose},'关闭')):null}
    assert.ok(['react','react/jsx-runtime'].includes(id));return require(id)
  })}}
  vm.runInNewContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),{window,document,FormData:dom.window.FormData})
  const root=createRoot(document.getElementById('root')), s=study(), step=s.plan.steps[0]
  let reply, remaining=50
  const props={sessionId:'s1',execute:async (...args)=>{
    calls.push(args)
    if(reply) return reply(...args)
    const raw=args[1]
    let text
    if(raw.startsWith('/combo-lab plan ')) text='计划：'+ID
    else if(raw.startsWith('/combo-lab record ')) {remaining--;text='recorded'}
    else text=JSON.stringify({planId:ID,remaining,step:{...step,run:s.plan.runs[0],check:s.plan.checks[0],template:observationTemplate(s,step.id,s.plan.createdAt)}})
    return {ok:true,value:{result:{kind:'success',text}}}
  }}
  const render=async()=>act(async()=>{root.render(React.createElement(client.ComboLab,props))})
  const click=async text=>act(async()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(button,text);button.click();await Promise.resolve()})
  const submit=async form=>act(async()=>{form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await Promise.resolve()})
  t.after(async()=>{await act(async()=>root.unmount());dom.window.close();for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}})
  await render()
  return {client,props,calls,render,click,submit,reply:fn=>{reply=fn}}
}
test('rc.5 header action opens a form, generates JSON from fields and guides manual evidence',async t=>{
  const f=await setup(t)
  let seat
  f.client.apply({slots:{inject:(name,cb)=>{seat=name;cb()},register:(options)=>{assert.equal(options.id,'dsh-plugin-combo-lab')}},remote:{commands:{execute(){}}}})
  assert.equal(seat,'conversation.session.header.actions')
  await f.click('插件组合检查')
  const form=document.querySelector('form')
  const values={a:'dsh-a',av:'1.0.0',b:'dsh-b',bv:'2.0.0',version:'0.2.1-rc.5',machine:'fixture',workspace:'project',baseline:'clean'}
  for(const [name,value] of Object.entries(values)) form.elements.namedItem(name).value=value
  await f.submit(form)
  const input=JSON.parse(f.calls[0][1].slice('/combo-lab plan '.length))
  assert.equal(input.plugins[0].name,'dsh-a');assert.equal(input.configBaseline,'clean')
  assert.match(document.body.textContent,/尚未记录 50 步/)
  assert.match(document.body.textContent,/两个目标均关闭/)
  const evidence=document.querySelector('select[name="outcome"]')
  assert.equal(evidence.value,'blocked','never preselect pass')
  assert.equal(document.querySelector('textarea').value,'','never invent evidence')
  const record=evidence.closest('form')
  record.elements.namedItem('observer').value='fixture'
  record.elements.namedItem('evidence').value='No matching tool entry, checked manually'
  evidence.value='unsupported'
  await f.submit(record)
  const observation=JSON.parse(f.calls.find(c=>c[1].startsWith('/combo-lab record '))[1].split(ID+' ')[1])
  assert.equal(observation.outcome,'unsupported');assert.equal(observation.source,'desktop-manual')
  assert.match(document.body.textContent,/尚未记录 49 步/)
})
test('late command response after session change cannot populate the new session panel',async t=>{
  const f=await setup(t), pending=Promise.withResolvers()
  await f.click('插件组合检查')
  f.reply(()=>pending.promise)
  const form=document.querySelector('form')
  await f.submit(form)
  f.props.sessionId='s2';await f.render()
  await act(async()=>{pending.resolve({ok:true,value:{result:{kind:'success',text:'计划：'+ID}}});await Promise.resolve()})
  assert.equal(document.querySelector('[role="dialog"]'),null)
  assert.equal(f.calls.length,1,'no follow-up against the new session')
})

test('template field is sent when selected; failures can jump back to a recorded step', async t => {
  const f = await setup(t)
  let remaining = 10
  const failed = { id: 'baseline:input.commands', outcome: 'fail', evidence: '命令互相覆盖' }
  f.reply((session, raw) => {
    if (raw.startsWith('/combo-lab plan ')) {
      const input = JSON.parse(raw.slice('/combo-lab plan '.length))
      assert.equal(input.templateId, 'input')
      return { ok: true, value: { result: { kind: 'success', text: '计划：' + ID } } }
    }
    if (raw.startsWith('/combo-lab next ')) {
      const parts = raw.slice('/combo-lab next '.length).trim().split(/\s+/)
      return { ok: true, value: { result: { kind: 'success', text: JSON.stringify({
        planId: ID, remaining, template: { id: 'input', version: '1.0.0' }, failures: remaining < 10 ? [failed] : [],
        step: { id: parts[1] || 'baseline:input.tools', run: { id: 'baseline', enabled: [], instructions: '关闭两个目标插件' },
          check: { id: 'input.tools', instructions: '检查工具入口' },
          template: { stepId: parts[1] || 'baseline:input.tools', source: 'desktop-manual', outcome: 'blocked', evidence: '', observer: '', observedAt: '2026-11-10T00:00:00.000Z', enabled: [] } }
      }) } } }
    }
    return { ok: true, value: { result: { kind: 'success', text: 'recorded' } } }
  })
  await f.click('插件组合检查')
  const form = document.querySelector('form')
  form.elements.namedItem('template').value = 'input'
  await f.submit(form)
  assert.match(document.body.textContent, /检查模板：input@1.0.0/)
  assert.match(document.body.textContent, /尚未记录 10 步/)
  remaining = 9
  const record = document.querySelector('select[name="outcome"]').closest('form')
  record.elements.namedItem('observer').value = 'fixture'
  record.elements.namedItem('evidence').value = '命令互相覆盖'
  record.elements.namedItem('outcome').value = 'fail'
  await f.submit(record)
  assert.match(document.body.textContent, /失败与受阻项/)
  await f.click('baseline:input.commands · 失败')
  assert.ok(f.calls.some(c => c[1] === '/combo-lab next ' + ID + ' baseline:input.commands'))
})
