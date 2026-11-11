import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
const require=createRequire(import.meta.url),{Simulate}=require('react-dom/test-utils')
const good={kind:'issue',type:'bug',exists:'likely',worthFixing:'值得修',recommendation:'adopt',priority:'高',localApplicability:'present',localReason:'本地 render 函数存在',businessReason:'影响核心业务',reason:'研判理由',evidence:['本地提交线索 abc']}
const repo={repo:'o/r',mode:'both',business:'原业务',localRepoPath:'C:\\repo',localRef:'main',rulesFile:'C:\\rules.md',schedule:{kind:'daily',time:'09:30'},limit:8}
const result=(number,j=good)=>({number,kind:j?.kind??'issue',title:'条目 '+number,url:'https://github.com/o/r/'+(j?.kind==='pr'?'pull/':'issues/')+number,source:j?'model':'rules',evidence:['规则证据'],judgment:j})
const report={repo:'o/r',at:1,analyzed:4,reused:0,warnings:[],businessStatus:'已使用业务',localStatus:'本地对照正常',results:[result(1),result(2,{...good,kind:'pr',verdict:'改完再合',fitsDirection:'yes',risk:'中',testing:'需补认证测试',recommendation:'manual-review'}),result(3,{...good,recommendation:'not-recommended'}),result(4,null)]}
const snapshot=()=>({repositories:[structuredClone(repo)],reports:[structuredClone(report)],jobs:[],model:{enabled:true,provider:'p',model:'m',available:true},defaults:{limit:20,fullMax:100}})
async function setup(t){
  const dom=new JSDOM('<div id="root"></div>',{url:'https://dsh.invalid'}),saved=new Map()
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true})){
    saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value})
  }
  let factory,id
  window.__ModuleLoader__={load:row=>{id=row.id;factory=row.factory}}
  vm.runInNewContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),{window,document,navigator,URL,AbortController,setTimeout,clearTimeout})
  assert.equal(id,'dsh-github-triage')
  const client=factory(name=>{
    if(name==='@deepseek-ai/dsh-client-ui-primitives')return {Modal:({open,children,title,onClose})=>open?React.createElement('div',{role:'dialog','aria-label':title},children,React.createElement('button',{onClick:onClose},'关闭面板')):null}
    assert.ok(['react','react/jsx-runtime'].includes(name),'host share only: '+name);return require(name)
  })
  const root=createRoot(document.getElementById('root')),calls=[]
  let data=snapshot(),custom
  const call=async r=>{
    calls.push(structuredClone(r))
    if(custom)return custom(r)
    if(r.action==='snapshot')return data
    if(r.action==='jobs')return data.jobs
    if(r.action==='models')return 'provider: "actual-route"  model: "actual-model"'
    if(r.action==='start'){const job={repo:r.repo,status:'running'};data={...data,jobs:[job]};return job}
    if(r.action==='rules')return '# GitHub triage rules: o/r\n用户纠正规则'
    return '已保存'
  }
  t.after(async()=>{
    await act(async()=>root.unmount());dom.window.close()
    for(const [key,d] of saved){if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key]}
  })
  const click=async(label,index=0)=>{
    const button=[...document.querySelectorAll('button')].filter(b=>b.textContent===label)[index]
    assert.ok(button,'missing button '+label);await act(async()=>{button.click();await Promise.resolve()})
  }
  const input=async(label,value)=>{
    const el=document.querySelector('[aria-label="'+label+'"]');assert.ok(el,'missing input '+label)
    await act(async()=>{el.value=value;Simulate.change(el)})
  }
  const submit=async(label)=>{
    const form=document.querySelector('form[aria-label="'+label+'"]')??document.querySelector(label)
    assert.ok(form);await act(async()=>{Simulate.submit(form);await Promise.resolve()})
  }
  return {client,calls,call,click,input,submit,data:d=>{data=d},custom:f=>{custom=f},
    render:async(name,props={})=>{await act(async()=>root.render(React.createElement(client[name],{call,...props})))},
  }
}
test('lazy client registers exact session-header action and opens Chinese dialog',async t=>{
  const f=await setup(t);let Component,options
  f.client.apply({slots:{inject:(slot,callback)=>{assert.equal(slot,'conversation.session.header.actions');callback()},register:(o,c)=>{options=o;Component=c}},remote:{commands:{execute:async()=>({ok:true,value:{result:{kind:'success',text:JSON.stringify({ok:true,data:snapshot()})}}})}}})
  assert.equal(options.id,'dsh-github-triage')
  await f.render('TriageButton',{sessionId:'s'})
  assert.equal(document.querySelector('[role=dialog]'),null)
  await f.click('GitHub 仓库研判');assert.ok(document.querySelector('[role=dialog]'));assert.match(document.body.textContent,/仓库列表（1）/);assert.ok(Component)
  await f.click('关闭面板');assert.equal(document.querySelector('[role=dialog]'),null)
})
test('dashboard renders repositories, schedule, business, local path and model state',async t=>{
  const f=await setup(t);await f.render('Dashboard')
  for(const text of ['o/r','原业务','C:\\repo','每天 09:30','provider：p','model：m'])assert.ok(document.body.textContent.includes(text),text)
})
test('unconfigured model shows actionable settings warning and real copyable directory',async t=>{
  const f=await setup(t),s=snapshot();s.model={enabled:false,provider:'',model:'',available:false,warning:'模型未配置'};f.data(s)
  await f.render('Dashboard');assert.match(document.body.textContent,/modelEnabled/);assert.match(document.body.textContent,/插件设置/)
  await f.click('查看可复制的模型 ID');assert.match(document.querySelector('pre').textContent,/actual-route/)
})
test('repository form validates schema fields locally and sends no invalid request',async t=>{
  const f=await setup(t);await f.render('RepoForm',{onSaved:async()=>{},onCancel:()=>{}})
  await f.input('GitHub 仓库（owner/repo）','invalid');await f.input('普通分析单次上限（1–100，空为继承）','101')
  await f.submit('添加仓库');assert.equal(f.calls.length,0);assert.ok([...document.querySelectorAll('[role=alert]')].some(e=>e.textContent))
})
test('repository add submits business/local/ref/schedule through shared validated shape',async t=>{
  const f=await setup(t);await f.render('RepoForm',{onSaved:async()=>{},onCancel:()=>{}})
  await f.input('GitHub 仓库（owner/repo）','O/New');await f.input('业务说明','认证业务')
  await f.input('本地代码路径（可空，绝对路径）','C:\\code');await f.input('本地 ref（可空，默认 HEAD）','release')
  await f.input('定时','every');await f.input('间隔小时','6');await f.submit('添加仓库')
  const r=f.calls[0];assert.equal(r.action,'add');assert.equal(r.value.repo,'o/new');assert.equal(r.value.business,'认证业务');assert.equal(r.value.schedule.hours,6)
})
test('editing submits only changed fields and preserves other settings',async t=>{
  const f=await setup(t);await f.render('RepoForm',{initial:repo,onSaved:async()=>{},onCancel:()=>{}})
  assert.equal(document.querySelector('[aria-label="GitHub 仓库（owner/repo）"]').disabled,true)
  await f.input('业务说明','新业务');await f.submit('编辑仓库')
  assert.deepEqual(f.calls,[{action:'patch',repo:'o/r',patch:{business:'新业务'}}])
})
test('editing clears schedule and local ref using explicit null without overwriting other fields',async t=>{
  const f=await setup(t);await f.render('RepoForm',{initial:repo,onSaved:async()=>{},onCancel:()=>{}})
  await f.input('定时','none');await f.input('本地 ref（可空，默认 HEAD）','');await f.submit('编辑仓库')
  assert.deepEqual(f.calls[0].patch,{schedule:null,localRef:null})
})
test('server field errors display in the editing form',async t=>{
  const f=await setup(t);f.custom(async()=>{throw new f.client.UiError('本地路径无效',{localRepoPath:'本地仓库不存在'})})
  await f.render('RepoForm',{initial:repo,onSaved:async()=>{},onCancel:()=>{}});await f.submit('编辑仓库')
  assert.match(document.body.textContent,/本地仓库不存在/)
})
test('trigger button becomes disabled while analysis remains nonblocking',async t=>{
  const f=await setup(t);await f.render('Dashboard');await f.click('立即分析')
  const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='分析进行中…');assert.ok(button?.disabled)
  assert.ok(f.calls.some(r=>r.action==='start'&&r.repo==='o/r'));await f.click('添加仓库');assert.ok(document.querySelector('form'))
})
test('analysis form rejects invalid full dates/limit and sends full scan options',async t=>{
  const f=await setup(t);await f.render('Dashboard')
  const checkbox=document.querySelector('input[type=checkbox]')
  await act(async()=>{checkbox.checked=true;Simulate.change(checkbox,{target:{checked:true}})})
  await f.input('本次上限 o/r','501');await f.click('立即分析');assert.ok(!f.calls.some(r=>r.action==='start'))
  await f.input('本次上限 o/r','12');await f.input('开始日期 o/r','2026-01-01');await f.input('结束日期 o/r','2026-11-11');await f.click('立即分析')
  assert.deepEqual(f.calls.find(r=>r.action==='start').scan,{full:true,since:'2026-01-01',until:'2026-11-11',max:12})
})
test('result groups, issue and PR business details, local evidence, safe original links',async t=>{
  const f=await setup(t);await f.render('Results',{reports:[report],selected:'o/r',onChanged:async()=>{}})
  const text=document.body.textContent;assert.ok(text.indexOf('建议采纳（1）')<text.indexOf('需人工看（1）'));assert.ok(text.indexOf('需人工看（1）')<text.indexOf('不推荐（1）'))
  for(const s of ['真实存在：likely','值得修','符合业务方向：yes','需补认证测试','影响核心业务','本地 render 函数存在','本地提交线索 abc','仅规则预筛，未经 AI 研判'])assert.ok(text.includes(s),s)
  assert.match(text,/研判理由/);assert.match(text,/规则证据/)
  for(const a of document.querySelectorAll('a')){assert.equal(a.target,'_blank');assert.equal(a.rel,'noopener noreferrer')}
  await f.input('结果类型','pr');assert.equal(document.querySelectorAll('article').length,1);assert.match(document.body.textContent,/条目 2/)
  await f.input('结果类型','issue');assert.equal(document.querySelectorAll('article').length,3);assert.ok(![...document.querySelectorAll('article')].some(a=>a.textContent.includes('条目 2')))
})
test('correction requires reason and submits selected tier and reason',async t=>{
  const f=await setup(t);await f.render('Results',{reports:[report],selected:'o/r',onChanged:async()=>{}})
  const form=document.querySelector('article form');await act(async()=>Simulate.submit(form));assert.equal(f.calls.length,0);assert.match(document.body.textContent,/请填写纠正理由/)
  await f.input('纠正结论 #1','not-recommended');await f.input('纠正理由 #1','业务没有这个模块')
  await act(async()=>{Simulate.submit(form);await Promise.resolve()})
  assert.deepEqual(f.calls[0],{action:'fix',repo:'o/r',number:1,recommendation:'not-recommended',reason:'业务没有这个模块'})
})
test('rule display/export and delete are explicit actions',async t=>{
  const f=await setup(t);await f.render('Dashboard');await f.click('查看/导出规则');assert.match(document.querySelector('pre').textContent,/用户纠正规则/)
  await f.input('导出路径','C:\\new-rules.md');await f.click('导出规则')
  assert.deepEqual(f.calls.find(r=>r.action==='export'),{action:'export',repo:'o/r',path:'C:\\new-rules.md'})
  await f.click('删除');assert.ok(!f.calls.some(r=>r.action==='remove'));await f.click('确认删除');assert.ok(f.calls.some(r=>r.action==='remove'))
})
test('unsafe links and hostile text cannot create executable markup',async t=>{
  const f=await setup(t),bad={...report,results:[{...result(1),title:'<img src=x onerror=alert(1)>',url:'javascript:alert(1)'}]}
  await f.render('Results',{reports:[bad],selected:'o/r',onChanged:async()=>{}})
  assert.equal(document.querySelector('img'),null);assert.equal(document.querySelector('a'),null)
  for(const u of ['https://evil.test/o/r/issues/1','https://github.com@evil.test/o/r/issues/1','file:///x','https://github.com/o/r/issues/1?q=x'])assert.equal(f.client.safeLink(u),undefined)
})
test('command transport uses actual execute signature and strict JSON envelope',async t=>{
  const f=await setup(t),calls=[]
  const call=f.client.commandCall(async(...args)=>{calls.push(args);return {ok:true,value:{result:{kind:'success',text:'{"ok":true,"data":42}'}}}},'session')
  assert.equal(await call({action:'jobs'}),42);assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),['session','/triage-ui {"action":"jobs"}',[]])
  const fieldError=f.client.commandCall(async()=>({ok:true,value:{result:{kind:'success',text:JSON.stringify({ok:false,error:'invalid',fields:{limit:'1–100'}})}}}),'session')
  await assert.rejects(fieldError({action:'jobs'}),e=>e instanceof f.client.UiError&&e.fields.limit==='1–100')
  const denied=f.client.commandCall(async()=>({ok:false,error:{code:'gateway/internal'}}),'session');await assert.rejects(denied({action:'jobs'}),/接口调用失败：gateway\/internal/);const missing=f.client.commandCall(async()=>({ok:true,value:undefined}),'session');await assert.rejects(missing({action:'jobs'}),/接口未注册/);const failed=f.client.commandCall(async()=>({ok:true,value:{result:{kind:'error',text:'boom'}}}),'session');await assert.rejects(failed({action:'jobs'}),/接口出错：boom/)
})

test('unchanged empty optional settings never enter an edit patch',async t=>{
  const f=await setup(t)
  await f.render('RepoForm',{initial:{...repo,businessFile:'',localRef:'',rulesFile:''},onSaved:async()=>{},onCancel:()=>{}})
  await f.input('业务说明','只改业务');await f.submit('编辑仓库')
  assert.deepEqual(f.calls[0].patch,{business:'只改业务'})
})
test('daily schedule validation is shown beside the form and ref requires local path',async t=>{
  const f=await setup(t)
  await f.render('RepoForm',{onSaved:async()=>{},onCancel:()=>{}})
  await f.input('GitHub 仓库（owner/repo）','o/r');await f.input('定时','daily');await f.input('每天时间','25:00')
  await f.submit('添加仓库');assert.match(document.body.textContent,/每日时间请填 HH:MM/);assert.equal(f.calls.length,0)
  await f.input('定时','none');await f.input('本地 ref（可空，默认 HEAD）','main');await f.submit('添加仓库')
  assert.match(document.body.textContent,/填写 ref 前请先配置本地代码路径/);assert.equal(f.calls.length,0)
})
