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
  vm.runInNewContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),{window,document,navigator,URL,AbortController,AbortSignal,Error,fetch:(...args)=>globalThis.fetch(...args),setTimeout,clearTimeout})
  assert.equal(id,'dsh-github-triage')
  const client=factory(name=>{
    if(name==='@deepseek-ai/dsh-client-ui-primitives')return {
      Input:({className,...props})=>React.createElement('span',{className},React.createElement('input',props)),
      Modal:({open,children,title,onClose,className})=>open?React.createElement('div',{role:'dialog','aria-label':title,className},children,React.createElement('button',{onClick:onClose},'关闭面板')):null,
    }
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
    if(r.action==='add'){data={...data,repositories:[...data.repositories,r.value]};return r.value}
    if(r.action==='patch'){data={...data,repositories:data.repositories.map(repo=>repo.repo===r.repo?{...repo,...r.patch}:repo)};return data.repositories.find(repo=>repo.repo===r.repo)}
    if(r.action==='remove'){data={...data,repositories:data.repositories.filter(repo=>repo.repo!==r.repo)};return '已移除仓库'}
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
  const f=await setup(t);let Component,options;const effects=[],registrations=[]
  f.client.apply({get:()=>undefined,effect:fn=>{effects.push(fn())},slots:{inject:(slot,callback)=>callback(),register:(o,c)=>{registrations.push(o);if(o.name==='conversation.session.header.actions'){options=o;Component=c}}}})
  t.after(()=>effects.reverse().forEach(dispose=>dispose?.()))
  assert.ok(registrations.some(o=>o.name==='main'&&o.key==='dsh-github-triage'))
  assert.ok(registrations.some(o=>o.name==='sidebar.panellist'&&o.id==='dsh-github-triage'&&o.label()==='GitHub 哨兵'))
  assert.equal(options.id,'dsh-github-triage')
  await f.render('TriageButton',{sessionId:'s'})
  assert.equal(document.querySelector('[role=dialog]'),null)
  await f.click('GitHub 哨兵');assert.ok(document.querySelector('[role=dialog]'));assert.match(document.body.textContent,/仓库列表（1）/);assert.ok(Component)
  await f.click('关闭面板');assert.equal(document.querySelector('[role=dialog]'),null)
})
test('dashboard renders repositories, schedule, business, local path and model state',async t=>{
  const f=await setup(t);await f.render('Dashboard')
  await f.click('p / m')
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

test('repository modal uses bounded official shell and grouped fields with full-width paths',async t=>{
  const f=await setup(t);await f.render('Dashboard');await f.click('添加仓库')
  assert.ok(document.querySelector('[role=dialog].gt-repo-modal .gt-repo-dialog'))
  const form=document.querySelector('form[aria-label="添加仓库"]')
  assert.deepEqual([...form.querySelectorAll('fieldset>legend')].map(e=>e.textContent),['仓库','本地代码','业务说明','定时与上限'])
  assert.equal(form.lastElementChild.className,'gt-form-footer')
  assert.ok(form.querySelector('.gt-form-body'));assert.ok(form.querySelector('.gt-form-actions button[type=submit]'))
  const longPath='C:\\代码与业务资料\\'+'very-long-repository-directory\\'.repeat(20)+'repository'
  for(const label of ['本地代码路径（可空，绝对路径）','业务说明文件（仓库相对路径或本机绝对路径）','只读规则文件（可空，本机绝对路径）']){
    await f.input(label,longPath)
    const input=document.querySelector('[aria-label="'+label+'"]')
    assert.ok(input.closest('.gt-form-field.gt-field-wide'));assert.ok(input.closest('.gt-input'))
    assert.equal(input.title,longPath)
    assert.equal(input.closest('.gt-form-field').querySelector('.gt-path-preview').textContent,longPath)
  }
  const css=readFileSync(new URL('../src/client.css',import.meta.url),'utf8')
  for(const rule of [
    /\.gt-repo-modal\.gt-repo-modal\{[^}]*width:min\(760px,100%\)[^}]*max-height:min\(860px,100%\)/,
    /\.gt-dialog\.gt-repo-dialog\{[^}]*min-width:0[^}]*min-height:0[^}]*container:gt-repo-form \/ inline-size/,
    /\.gt-form-grid\{[^}]*repeat\(2,minmax\(0,1fr\)\)/,
    /\.gt-form-field\{[^}]*min-width:0/,
    /\.gt-field-wide\{grid-column:1\/-1/,
    /\.gt-form-field \.gt-input\{[^}]*width:100%[^}]*min-width:0[^}]*box-sizing:border-box/,
    /\.gt-path-preview\{[^}]*white-space:pre-wrap[^}]*overflow-wrap:anywhere/,
    /\.gt-form-body\{[^}]*min-height:0[^}]*overflow-y:auto/,
    /\.gt-form-footer\{flex:none/,
    /@container gt-repo-form \(max-width:560px\)/,
    /\.gt-textarea\{[^}]*resize:vertical/,
  ])assert.match(css,rule)
})

test('pasted repository URL normalizes on blur and clears its nearby accessible error',async t=>{
  const f=await setup(t);await f.render('RepoForm',{onSaved:async()=>{},onCancel:()=>{}})
  const input=document.querySelector('[aria-label="GitHub 仓库（owner/repo）"]')
  await f.input(input.getAttribute('aria-label'),'https://fixture:fixture-secret@github.com/O/New')
  await act(async()=>Simulate.blur(input))
  assert.equal(input.getAttribute('aria-invalid'),'true')
  const error=document.getElementById(input.getAttribute('aria-describedby').split(' ').at(-1))
  assert.equal(error.getAttribute('role'),'alert');assert.ok(!error.textContent.includes('fixture-secret'))
  await f.input(input.getAttribute('aria-label'),' https://www.github.com/O/New.git/tree/main?tab=readme#intro ')
  await act(async()=>Simulate.blur(input))
  assert.equal(input.value,'o/new');assert.equal(input.getAttribute('aria-invalid'),null)
  assert.equal(document.querySelector('.gt-field-error'),null)
  await f.submit('添加仓库');assert.equal(f.calls[0].value.repo,'o/new')
})

test('submit normalizes URL even without blur and keeps normalized value when another field is invalid',async t=>{
  const f=await setup(t);await f.render('RepoForm',{onSaved:async()=>{},onCancel:()=>{}})
  await f.input('GitHub 仓库（owner/repo）','github.com/O/New/issues?state=open#all')
  await f.input('普通分析单次上限（1–100，空为继承）','101');await f.submit('添加仓库')
  assert.equal(f.calls.length,0)
  assert.equal(document.querySelector('[aria-label="GitHub 仓库（owner/repo）"]').value,'o/new')
  const input=document.querySelector('[aria-label="普通分析单次上限（1–100，空为继承）"]')
  assert.equal(input.getAttribute('aria-invalid'),'true')
  assert.match(input.closest('.gt-form-field').textContent,/1–100/)
  await f.input(input.getAttribute('aria-label'),'5');await f.submit('添加仓库')
  assert.equal(f.calls[0].value.repo,'o/new');assert.equal(f.calls[0].value.limit,5)
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
  await f.click('分析选项')
  const checkbox=document.querySelector('input[type=checkbox]')
  await act(async()=>{checkbox.checked=true;Simulate.change(checkbox,{target:{checked:true}})})
  await f.input('本次上限 o/r','501');await f.click('立即分析',1);assert.ok(!f.calls.some(r=>r.action==='start'))
  await f.input('本次上限 o/r','12');await f.input('开始日期 o/r','2026-01-01');await f.input('结束日期 o/r','2026-11-11');await f.click('立即分析',1)
  assert.deepEqual(f.calls.find(r=>r.action==='start').scan,{full:true,since:'2026-01-01',until:'2026-11-11',max:12})
})
test('result groups, issue and PR business details, local evidence, safe original links',async t=>{
  const f=await setup(t);await f.render('Results',{reports:[report],selected:'o/r',onChanged:async()=>{}})
  assert.equal(document.querySelector('.gt-detail'),null,'details must mount on demand')
  for(let i=0;i<4;i++)await f.click('查看详情与纠正')
  const text=document.body.textContent;assert.ok(text.indexOf('建议采纳（1）')<text.indexOf('需人工看（1）'));assert.ok(text.indexOf('需人工看（1）')<text.indexOf('不推荐（1）'))
  for(const s of ['真实存在：likely','值得修','符合业务方向：yes','需补认证测试','影响核心业务','本地 render 函数存在','本地提交线索 abc','仅规则预筛，未经 AI 研判'])assert.ok(text.includes(s),s)
  assert.match(text,/研判理由/);assert.match(text,/规则证据/)
  for(const a of document.querySelectorAll('a')){assert.equal(a.target,'_blank');assert.equal(a.rel,'noopener noreferrer')}
  await f.input('结果类型','pr');assert.equal(document.querySelectorAll('article').length,1);assert.match(document.body.textContent,/条目 2/)
  await f.input('结果类型','issue');assert.equal(document.querySelectorAll('article').length,3);assert.ok(![...document.querySelectorAll('article')].some(a=>a.textContent.includes('条目 2')))
})
test('correction requires reason and submits selected tier and reason',async t=>{
  const f=await setup(t);await f.render('Results',{reports:[report],selected:'o/r',onChanged:async()=>{}})
  await f.click('查看详情与纠正')
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

test('KPI counts, tier chips, type, search, clear and sort cooperate',async t=>{
  const f=await setup(t);await f.render('Dashboard')
  assert.deepEqual([...document.querySelectorAll('.gt-stat>b')].map(e=>e.textContent),['1','4','1','1','1','已更新'])
  await f.click('建议采纳（1）');assert.equal(document.querySelectorAll('article').length,1)
  await f.click('需人工看（1）');assert.match(document.querySelector('article').textContent,/条目 2/)
  await f.input('结果类型','issue');assert.equal(document.querySelectorAll('article').length,0)
  await f.input('结果类型','both');await f.click('全部（4）')
  await f.input('搜索结果','条目 3');assert.equal(document.querySelectorAll('article').length,1)
  await act(async()=>document.querySelector('[aria-label="清空搜索"]').click());assert.equal(document.querySelectorAll('article').length,4)
  await f.input('结果排序','number');assert.match(document.querySelector('article').textContent,/#4/)
})
test('empty state has three steps, skeleton retains layout, failed fetch can retry',async t=>{
  const f=await setup(t);let resolve;f.custom(()=>new Promise(r=>{resolve=r}))
  await f.render('Dashboard');assert.ok(document.querySelector('[aria-busy=true]'));assert.equal(document.querySelectorAll('.gt-kpis .gt-skeleton').length,6)
  const s=snapshot();s.repositories=[];s.reports=[]
  await act(async()=>resolve(s));assert.equal(document.querySelectorAll('.gt-steps> *').length,3)
  assert.match(document.body.textContent,/配置模型.*添加仓库.*立即分析/)
  f.custom(async()=>{throw Error('离线错误')});await f.click('刷新');assert.match(document.querySelector('.gt-error').textContent,/离线错误/)
  f.custom(undefined);await f.click('重试');assert.equal(document.querySelector('.gt-error'),null)
})
test('rule import and clipboard use explicit user actions',async t=>{
  const f=await setup(t),copied=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async s=>copied.push(s)}})
  await f.render('Dashboard');assert.ok(!f.calls.some(r=>r.action==='rules'))
  await f.click('查看/导出规则');await f.click('复制规则');assert.match(copied[0],/用户纠正规则/)
  await f.input('导入规则文档','# GitHub triage rules: o/r\n编辑规则');await f.click('确认导入规则')
  assert.deepEqual(f.calls.find(r=>r.action==='import'),{action:'import',repo:'o/r',text:'# GitHub triage rules: o/r\n编辑规则'})
})
test('all analysis enqueues repositories and keeps card progress visible',async t=>{
  const f=await setup(t);await f.render('Dashboard');await f.click('全部分析')
  assert.equal(f.calls.filter(r=>r.action==='start').length,1);assert.ok(document.querySelector('progress'))
  assert.ok([...document.querySelectorAll('button')].find(b=>b.textContent==='全部分析').disabled)
})
test('deferred evidence loads per item on expand and is released on collapse',async t=>{
  const f=await setup(t),s=snapshot(),r=s.reports[0].results[0]
  s.reports[0].results=[{...r,evidence:undefined,deferred:true,judgment:{kind:'issue',recommendation:'adopt',priority:'高',businessReason:'影响核心业务'}}]
  f.data(s);f.custom(async req=>req.action==='snapshot'?s:req.action==='detail'?r:undefined)
  await f.render('Dashboard');assert.ok(!f.calls.some(r=>r.action==='detail'))
  await f.click('查看详情与纠正');assert.equal(f.calls.filter(r=>r.action==='detail').length,1);assert.match(document.querySelector('.gt-detail').textContent,/本地提交线索/)
  await f.click('收起详情');assert.equal(document.querySelector('.gt-detail'),null)
})
test('header shortcut navigates directly when host layout is present',async t=>{
  const f=await setup(t);let opened=0
  await f.render('TriageButton',{sessionId:'s',openPage:()=>{opened++;return true}});await f.click('GitHub 哨兵')
  assert.equal(opened,1);assert.equal(document.querySelector('[role=dialog]'),null);assert.equal(f.calls.length,0)
})
test('repository cards add, edit a delta and remove after confirmation',async t=>{
  const f=await setup(t);await f.render('Dashboard');await f.click('添加仓库')
  await f.input('GitHub 仓库（owner/repo）','x/new');await f.input('业务说明','新项目');await f.submit('添加仓库')
  assert.equal(document.querySelectorAll('.gt-repo').length,2)
  await f.click('编辑',1);await f.input('业务说明','编辑后的项目');await f.submit('编辑仓库')
  assert.deepEqual(f.calls.find(r=>r.action==='patch'),{action:'patch',repo:'x/new',patch:{business:'编辑后的项目'}})
  assert.match(document.querySelector('[aria-label="仓库 x/new"]').textContent,/编辑后的项目/)
  await f.click('删除',1);assert.equal(document.querySelectorAll('.gt-repo').length,2);await f.click('确认删除')
  assert.equal(document.querySelectorAll('.gt-repo').length,1)
})
test('repository chips scope result cards and page mounts only the first batch',async t=>{
  const f=await setup(t),s=snapshot()
  s.reports.push({...structuredClone(report),repo:'x/other',results:[{...result(9),title:'另一个仓库'}]});f.data(s)
  await f.render('Dashboard');await f.click('x/other')
  assert.equal(document.querySelectorAll('article').length,1);assert.match(document.querySelector('article').textContent,/另一个仓库/)
  await f.click('全部仓库');assert.equal(document.querySelectorAll('article').length,5)
  await f.render('Results',{reports:[{...report,results:Array.from({length:65},(_,i)=>result(i+1))}],selected:'o/r',onChanged:async()=>{}})
  assert.equal(document.querySelectorAll('article').length,30);await f.click('加载更多结果（30 / 65）');assert.equal(document.querySelectorAll('article').length,60)
})
test('POST transport decodes envelopes and falls back only for missing routes',async t=>{
  const f=await setup(t),requests=[],fallback=[]
  const call=f.client.postCall(async(url,options)=>{requests.push({url,options});return {ok:true,status:200,json:async()=>({ok:true,value:[]})}})
  assert.equal((await call({action:'jobs'})).length,0);assert.equal(requests[0].url,'/api/dsh-github-triage/jobs');assert.equal(requests[0].options.method,'POST')
  for(const status of [404,405])await f.client.postCall(async()=>({ok:false,status}),async r=>{fallback.push(r);return []})({action:'jobs'})
  assert.equal(fallback.length,2)
  for(const response of [{ok:false,status:403},{ok:true,status:200,json:async()=>({ok:true,value:{broken:true}})},{ok:true,status:200,json:async()=>({ok:false,error:{code:'validation',message:'无效字段',fields:{limit:'错误'}}})}])await assert.rejects(f.client.postCall(async()=>response,async()=>{throw Error('must not fallback')})({action:'jobs'}))
  await assert.rejects(f.client.postCall(async()=>{throw Error('network')},async()=>{throw Error('must not fallback')})({action:'jobs'}),/操作可能已提交/)
})
