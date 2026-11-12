import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import {primitivesFixture,domGlobals} from './primitives-fixture.mjs'
const require=createRequire(import.meta.url),{Simulate}=require('react-dom/test-utils')
const good={kind:'issue',type:'bug',exists:'likely',worthFixing:'值得修',recommendation:'adopt',priority:'高',localApplicability:'present',localReason:'本地 render 函数存在',businessReason:'影响核心业务',reason:'分析理由',evidence:['本地提交线索 abc']}
const repo={repo:'o/r',mode:'both',business:'原业务',localRepoPath:'C:\\repo',localRef:'main',rulesFile:'C:\\rules.md',schedule:{kind:'daily',time:'09:30'},limit:8}
const result=(number,j=good)=>({number,kind:j?.kind??'issue',title:'条目 '+number,url:'https://github.com/o/r/'+(j?.kind==='pr'?'pull/':'issues/')+number,source:j?'model':'rules',evidence:['规则证据'],judgment:j})
const report={repo:'o/r',at:1,analyzed:4,reused:0,warnings:[],businessStatus:'已使用业务',localStatus:'本地对照正常',results:[result(1),result(2,{...good,kind:'pr',verdict:'改完再合',fitsDirection:'yes',risk:'中',testing:'需补认证测试',recommendation:'manual-review'}),result(3,{...good,recommendation:'not-recommended'}),result(4,null)]}
const snapshot=()=>({repositories:[structuredClone(repo)],reports:[structuredClone(report)],jobs:[],model:{enabled:true,provider:'p',model:'m',available:true},defaults:{limit:20,fullMax:100}})
async function setup(t){
  const dom=new JSDOM('<div id="root"></div>',{url:'https://dsh.invalid',pretendToBeVisual:true}),saved=new Map()
  for(const [key,value] of Object.entries({...domGlobals(dom),IS_REACT_ACT_ENVIRONMENT:true})){
    saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value})
  }
  let factory,id
  window.__ModuleLoader__={load:row=>{id=row.id;factory=row.factory}}
  vm.runInNewContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),{window,document,navigator,URL,AbortController,AbortSignal,Error,fetch:(...args)=>globalThis.fetch(...args),setTimeout,clearTimeout})
  assert.equal(id,'dsh-github-triage')
  const primitives=primitivesFixture()
  const client=factory(name=>{
    if(name==='@deepseek-ai/dsh-client-ui-primitives')return primitives
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
    const el=document.querySelector('[aria-label="'+label+'"]')??[...document.querySelectorAll('label')].find(e=>e.textContent===label)?.control
    assert.ok(el,'missing input '+label)
    if(el.getAttribute('aria-haspopup')==='menu'){
      await act(async()=>{el.focus();el.click()})
      const choices={both:'issues 与 PR',issues:'仅 issues',prs:'仅 PR',issue:'仅 issues',pr:'仅 PR',none:'不定时',daily:'每天 HH:MM',every:'每 N 小时',priority:'优先级优先',recent:'最近分析',number:'编号倒序',adopt:'建议采纳','manual-review':'需人工看','not-recommended':'不推荐'}
      const row=[...document.querySelectorAll('[role=menuitem]')].find(e=>e.textContent===choices[value])
      assert.ok(row,'missing menu option '+value);await act(async()=>row.click())
    }else await act(async()=>{el.value=value;Simulate.change(el)})
  }
  const submit=async(label)=>{
    const form=document.querySelector('form[aria-label="'+label+'"]')??document.querySelector(label)
    assert.ok(form);await act(async()=>{Simulate.submit(form);await Promise.resolve()})
  }
  return {client,calls,call,click,input,submit,data:d=>{data=d},custom:f=>{custom=f},
    render:async(name,props={})=>{await act(async()=>root.render(React.createElement(client[name],{call,...props})))},
  }
}
test('lazy client registers only the sidebar and root page, with no session action',async t=>{
  const f=await setup(t),effects=[],registrations=[],injections=[]
  f.client.apply({get:()=>undefined,effect:fn=>{effects.push(fn())},slots:{inject:(slot,callback)=>{injections.push(slot);callback()},register:o=>registrations.push(o)}})
  t.after(()=>effects.reverse().forEach(dispose=>dispose?.()))
  assert.deepEqual(injections,['main','sidebar.panellist'])
  assert.equal(registrations.length,2)
  assert.ok(registrations.some(o=>o.name==='main'&&o.key==='dsh-github-triage'))
  assert.ok(registrations.some(o=>o.name==='sidebar.panellist'&&o.id==='dsh-github-triage'&&o.label()==='GitHub 哨兵'))
  assert.equal(f.client.TriageButton,undefined)
})
test('dashboard renders repositories, schedule, business, local path and model state',async t=>{
  const f=await setup(t);await f.render('Dashboard')
  await f.click('p / m')
  for(const text of ['o/r','原业务','C:\\repo','每天 09:30','provider：p','model：m'])assert.ok(document.body.textContent.includes(text),text)
})
test('network controls keep both actions and display complete multiline diagnostics',async t=>{
  const f=await setup(t);await f.render('Dashboard')
  const long='系统代理：Windows PAC\n'+('很长的诊断地址/'.repeat(150))+'\n超时：30 秒\n诊断结束'
  f.custom(async r=>r.action==='detect-proxy'?'已检测到系统代理':long)
  await f.click('从系统检测代理')
  const card=document.querySelector('section[aria-label="代理与网络诊断"]')
  assert.equal(card.getAttribute('role'),'status')
  assert.equal(card.querySelector('pre').textContent,'已检测到系统代理')
  await f.click('网络诊断')
  assert.equal(card.querySelector('pre').textContent,long)
  assert.equal(card.querySelector('[style]'),null)
  assert.deepEqual(f.calls.filter(r=>['detect-proxy','diagnose'].includes(r.action)),[{action:'detect-proxy'},{action:'diagnose'}])
})
test('network action failure preserves the previous diagnostic and leaves controls usable',async t=>{
  const f=await setup(t);await f.render('Dashboard')
  f.custom(async()=> '已有诊断')
  await f.click('网络诊断')
  f.custom(async()=>{throw Error('网络诊断暂不可用')})
  await f.click('从系统检测代理')
  assert.equal(document.querySelector('.gt-network-text').textContent,'已有诊断')
  assert.match(document.querySelector('[role=alert]').textContent,/网络诊断暂不可用/)
  f.custom(async()=> '恢复后的完整诊断')
  await f.click('网络诊断')
  assert.equal(document.querySelector('.gt-network-text').textContent,'恢复后的完整诊断')
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
    /\.gt-repo-modal\.gt-repo-modal\{[^}]*width:min\(760px,100%\)[^}]*height:min\(860px,100%\)/,
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
  assert.equal(error.getAttribute('role'),'alert');assert.equal(error.className,'gt-validation');assert.equal(error.textContent,'仓库地址无效，请改用 owner/repo 格式');assert.ok(!error.textContent.includes('fixture-secret'));assert.ok(!document.body.textContent.includes('不接受其他主机'))
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
  const input=[...document.querySelectorAll('label')].find(e=>e.textContent==='普通分析单次上限（1–100，空为继承）').control
  assert.equal(input.getAttribute('aria-invalid'),'true')
  assert.match(input.closest('.gt-form-field').textContent,/1–100/)
  await f.input('普通分析单次上限（1–100，空为继承）','5');await f.submit('添加仓库')
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
  await f.input('本次上限 o/r','501');await f.click('开始全面扫描');assert.ok(!f.calls.some(r=>r.action==='start'))
  await f.input('本次上限 o/r','12');await f.input('开始日期 o/r','2026-01-01');await f.input('结束日期 o/r','2026-11-11');await f.click('开始全面扫描')
  assert.deepEqual(f.calls.find(r=>r.action==='start').scan,{full:true,since:'2026-01-01',until:'2026-11-11',max:12})
})
test('result groups, issue and PR business details, local evidence, safe original links',async t=>{
  const f=await setup(t);await f.render('Results',{reports:[report],selected:'o/r',onChanged:async()=>{}})
  assert.equal(document.querySelector('.gt-detail'),null,'details must mount on demand')
  for(let i=0;i<4;i++)await f.click('查看详情与纠正')
  const text=document.body.textContent;assert.ok(text.indexOf('建议采纳（1）')<text.indexOf('需人工看（1）'));assert.ok(text.indexOf('需人工看（1）')<text.indexOf('不推荐（1）'))
  for(const s of ['真实存在：较可能','值得修','符合业务方向：是','需补认证测试','影响核心业务','本地 render 函数存在','本地提交线索 abc','仅规则预筛，未经 AI 分析'])assert.ok(text.includes(s),s)
  assert.match(text,/分析理由/);assert.match(text,/规则证据/)
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

test('official menu selection, Escape, outside dismissal and unmount preserve the repository draft',async t=>{
  const f=await setup(t);await f.render('Dashboard');await f.click('添加仓库')
  await f.input('业务说明','菜单切换后保留的草稿')
  const trigger=document.querySelector('[aria-label="分析类型"]')
  await act(async()=>{trigger.focus();trigger.click()})
  assert.ok(document.querySelector('body>[role=menu]'),'menu must escape the scrolling form via portal')
  await act(async()=>document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true})))
  assert.equal(document.activeElement.textContent,'仅 PR')
  await act(async()=>document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})))
  // Native Enter activation is supplied by the browser, not jsdom.
  act(()=>document.activeElement.click());await act(async()=>{await Promise.resolve()})
  assert.equal(document.querySelector('[role=menu]'),null)
  assert.ok(document.activeElement===trigger,'menu must restore trigger focus')
  assert.equal(trigger.textContent,'仅 PR')
  await act(async()=>trigger.click())
  await act(async()=>document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})))
  assert.ok(document.querySelector('form[aria-label="添加仓库"]'))
  assert.equal(document.querySelector('[role=menu]'),null)
  assert.equal(document.querySelector('[aria-label="业务说明"]').value,'菜单切换后保留的草稿')
  await act(async()=>trigger.click())
  await act(async()=>document.querySelector('.gt-form-head').dispatchEvent(new window.Event('pointerdown',{bubbles:true})))
  assert.equal(document.querySelector('[role=menu]'),null)
  await act(async()=>trigger.click())
  await f.render('Results',{reports:[],selected:'',onChanged:async()=>{}})
  assert.equal(document.querySelector('[role=menu]'),null)
  assert.equal(document.querySelector('[data-menu-backing]'),null)
})

test('official settings field reset clears only the repository limit on save',async t=>{
  const f=await setup(t);await f.render('RepoForm',{initial:repo,onSaved:async()=>{},onCancel:()=>{}})
  const input=[...document.querySelectorAll('label')].find(e=>e.textContent==='普通分析单次上限（1–100，空为继承）').control
  assert.equal(input.value,'8')
  assert.ok(document.getElementById(input.getAttribute('aria-describedby')))
  await f.click('继承插件设置')
  assert.equal(input.value,'');assert.equal(f.calls.length,0,'reset stages a clear, without a request')
  await f.submit('编辑仓库')
  assert.deepEqual(f.calls[0],{action:'patch',repo:'o/r',patch:{limit:null}})
})

test('official tabs walk with arrows and End, keeping panel and focus associations',async t=>{
  const f=await setup(t);await f.render('Results',{reports:[report],selected:'o/r',onChanged:async()=>{}})
  const tabs=[...document.querySelectorAll('[role=tab]')]
  await act(async()=>{tabs[0].focus();tabs[0].dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}))})
  assert.ok(document.activeElement===tabs[1],'arrow key must move focus');assert.equal(tabs[1].getAttribute('aria-selected'),'true')
  assert.equal(document.querySelectorAll('article').length,1)
  assert.equal(document.querySelector('[role=tabpanel]').getAttribute('aria-labelledby'),tabs[1].id)
  await act(async()=>tabs[1].dispatchEvent(new window.KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true})))
  assert.ok(document.activeElement===tabs.at(-1),'End must focus last tab');assert.equal(document.querySelectorAll('article').length,1)
  assert.match(document.querySelector('article').textContent,/仅规则预筛/)
  assert.equal(tabs.filter(t=>t.tabIndex===0).length,1)
})

test('failed repository save retains official field drafts and releases disabled state',async t=>{
  const f=await setup(t);f.custom(async()=>{throw new f.client.UiError('保存失败',{limit:'仓库上限暂不可用'})})
  await f.render('RepoForm',{initial:repo,onSaved:async()=>{},onCancel:()=>{}})
  await f.input('普通分析单次上限（1–100，空为继承）','9');await f.submit('编辑仓库')
  const input=document.querySelector('input[inputmode=numeric]')
  assert.equal(input.value,'9');assert.equal(input.disabled,false);assert.equal(input.getAttribute('aria-invalid'),'true')
  assert.match(document.getElementById(input.getAttribute('aria-describedby')).textContent,/仓库上限暂不可用/)
})

test('analysis type labels match between form, card and result menu',async t=>{
  const f=await setup(t);await f.render('Dashboard')
  assert.ok(document.querySelector('.gt-repo').textContent.includes('issues 与 PR'))
  await f.click('添加仓库');await f.input('分析类型','both')
  await act(async()=>document.querySelector('[aria-label="分析类型"]').click())
  assert.deepEqual([...document.querySelectorAll('[role=menuitem]')].map(e=>e.textContent),['issues 与 PR','仅 issues','仅 PR'])
})

test('invalid repository cannot save and gets a short neutral accessible message',async t=>{
  const f=await setup(t);await f.render('RepoForm',{onSaved:async()=>{},onCancel:()=>{}})
  await f.input('GitHub 仓库（owner/repo）','https://example.com/o/r');await f.submit('添加仓库')
  assert.equal(f.calls.length,0)
  assert.equal(document.querySelector('.gt-validation').textContent,'仓库地址无效，请改用 owner/repo 格式')
  assert.equal(document.querySelector('.gt-field-error'),null)
  await f.input('GitHub 仓库（owner/repo）','o/new');await f.submit('添加仓库')
  assert.equal(f.calls[0].value.repo,'o/new')
})

test('full scan dialog explains limits, cache reuse and allows cancelling without a request',async t=>{
  const f=await setup(t);await f.render('Dashboard');await f.click('全面扫描')
  const dialog=document.querySelector('[role=dialog]')
  assert.equal(dialog.getAttribute('aria-label'),'全面扫描')
  assert.ok(dialog.querySelector('.gt-options-content'))
  for(const text of ['开放条目','关闭条目','最后更新时间','最多 8 条','最多 100 条','复用缓存'])assert.ok(dialog.textContent.includes(text),text)
  await f.input('开始日期 o/r','2026-11-12');await f.input('结束日期 o/r','2026-11-01');await f.click('开始全面扫描')
  assert.match(dialog.querySelector('[role=alert]').textContent,/结束日期不能早于开始日期/)
  const until=dialog.querySelector('[aria-label="结束日期 o/r"]')
  assert.equal(until.getAttribute('aria-invalid'),'true')
  assert.ok(until.getAttribute('aria-describedby').includes(dialog.querySelector('[role=alert]').id))
  assert.ok(!f.calls.some(r=>r.action==='start'))
  await act(async()=>dialog.querySelector('[aria-label="关闭分析选项"]').click())
  assert.equal(document.querySelector('[role=dialog]'),null)
})

test('saving repository keeps its modal and draft through Escape until completion',async t=>{
  const f=await setup(t);await f.render('Dashboard');await f.click('编辑')
  let rejectSave;f.custom(()=>new Promise((_,reject)=>{rejectSave=reject}))
  const form=document.querySelector('form')
  await act(async()=>{Simulate.submit(form);await Promise.resolve()})
  await act(async()=>document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})))
  assert.ok(document.querySelector('form'))
  await act(async()=>{rejectSave(new Error('保存失败'));await Promise.resolve()})
  assert.equal(document.querySelector('[aria-label="业务说明"]').value,'原业务')
  assert.ok(!document.querySelector('button[type=submit]').disabled)
})

test('failed delete retains the repository and shows the error inside the confirmation',async t=>{
  const f=await setup(t);await f.render('Dashboard');await f.click('删除')
  f.custom(async()=>{throw Error('删除失败，请重试')});await f.click('确认删除')
  assert.equal(document.querySelectorAll('.gt-repo').length,1)
  assert.match(document.querySelector('[role=dialog] [role=alert]').textContent,/删除失败/)
  assert.ok(![...document.querySelectorAll('button')].find(b=>b.textContent==='确认删除').disabled)
})
