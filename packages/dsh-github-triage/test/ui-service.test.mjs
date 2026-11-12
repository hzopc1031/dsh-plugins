import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdir,mkdtemp,readFile,rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { uiService } from '../lib/ui-service.js'
import { changedFields,mergeRepo,requestSchema } from '../lib/ui-contract.js'
import { emptyState } from '../lib/types.js'
import { settings } from '../lib/plugin.js'
import { SafeText } from '../lib/safety.js'
import { run } from '../lib/pipeline.js'
import { issue,pr,source,options } from './fixtures.mjs'
function harness(input={},extra={}){
  let state=emptyState(),chain=Promise.resolve(),saves=0,active=0,maxActive=0
  const config=settings(input),signal=new AbortController()
  const serialize=f=>{const p=chain.then(f);chain=p.catch(()=>{});return p}
  const perform=async(r,limit,scheduled,signal,scan)=>{
    active++;maxActive=Math.max(maxActive,active)
    try{if(extra.before)await extra.before(r);const next=structuredClone(state),report=await run(source([issue(),pr({number:2})]),r,next,{...options,...scan,limit,signal});await save(next);return report}
    finally{active--}
  }
  const save=async s=>{state=s;saves++}
  const service=uiService({config,state:()=>state,save,serialize,perform,signal:signal.signal,safe:new SafeText({}),
    validate:extra.validate??(async()=>{}),model:()=>({enabled:config.modelEnabled,provider:config.provider,model:config.model,available:!!config.provider&&!!config.model&&config.modelEnabled,warning:!config.model?'未配置模型':undefined}),
    models:async()=> 'provider: "p"  model: "m"',
  })
  const call=async request=>{const reply=await service(request);assert.equal(reply.ok,true,JSON.stringify(reply));return reply.data}
  return {service,call,signal,serialize,state:()=>state,saves:()=>saves,perform,maxActive:()=>maxActive,drain:()=>chain}
}
test('UI snapshot lists static repositories, defaults, model enablement and no credentials',async()=>{
  const h=harness({repositories:[{repo:'O/R',business:'核心业务',limit:5}],provider:'p',model:'m'})
  const s=await h.call({action:'snapshot'});assert.equal(s.repositories[0].repo,'o/r');assert.equal(s.defaults.limit,20);assert.equal(s.model.available,true)
  assert.deepEqual(Object.keys(s.model).sort(),['available','enabled','model','provider','warning'])
  assert.match(await h.call({action:'models'}),/provider: "p"/)
})
test('UI unconfigured and disabled model states remain explicit',async()=>{
  for(const cfg of [{},{modelEnabled:false,provider:'p',model:'m'}]){
    const s=await harness(cfg).call({action:'snapshot'});assert.equal(s.model.available,false);assert.equal(s.model.enabled,cfg.modelEnabled??true)
  }
})
test('compact snapshot omits evidence; per-item detail reads current authoritative result',async()=>{
  const h=harness({repositories:[{repo:'o/r'}]})
  await h.call({action:'start',repo:'o/r',scan:{}});await h.drain()
  const full=await h.call({action:'snapshot'}),compact=await h.call({action:'snapshot',compact:true})
  assert.equal(compact.reports[0].results.length,full.reports[0].results.length)
  for(const item of compact.reports[0].results){assert.equal(item.deferred,true);assert.equal(item.evidence,undefined);assert.equal(item.judgment?.reason,undefined)}
  const item=full.reports[0].results[0]
  assert.deepEqual(await h.call({action:'detail',repo:'o/r',number:item.number}),item)
  assert.equal((await h.service({action:'detail',repo:'o/r',number:9999})).ok,false)
})
test('UI import validates repository header and byte size; exportable document retains edits',async()=>{
  const h=harness({repositories:[{repo:'o/r'}]}),text='# GitHub triage rules: o/r\n\n## 手工规则\n认证优先'
  assert.match(await h.call({action:'import',repo:'o/r',text}),/已导入/)
  assert.match(await h.call({action:'rules',repo:'o/r'}),/认证优先/)
  const before=h.saves()
  for(const value of ['# GitHub triage rules: wrong/repo\n拒绝','# GitHub triage rules: o/r\n'+'中'.repeat(6000)])assert.equal((await h.service({action:'import',repo:'o/r',text:value})).ok,false)
  assert.equal(h.saves(),before)
})
test('UI add and strict field patch retain latest business, local, rules and schedule',async()=>{
  const h=harness()
  await h.call({action:'add',value:{repo:'O/R',mode:'prs',business:'核心业务',localRepoPath:'C:\\repo',localRef:'main',rulesFile:'C:\\rules.md',schedule:{kind:'daily',time:'09:30'},limit:9,fullMax:220}})
  await h.call({action:'patch',repo:'o/r',patch:{business:'并发更新后的业务'}})
  await h.call({action:'patch',repo:'o/r',patch:{limit:4}})
  const r=(await h.call({action:'snapshot'})).repositories[0]
  assert.equal(r.business,'并发更新后的业务');assert.equal(r.localRepoPath,'C:\\repo');assert.equal(r.mode,'prs');assert.equal(r.rulesFile,'C:\\rules.md');assert.equal(r.fullMax,220);assert.equal(r.schedule.time,'09:30')
  await h.call({action:'patch',repo:'o/r',patch:{schedule:null,localRef:null}})
  const after=(await h.call({action:'snapshot'})).repositories[0];assert.equal(after.schedule,undefined);assert.equal(after.localRef,undefined);assert.equal(after.localRepoPath,'C:\\repo')
})
test('UI edits static configuration through own domain, deletes using tombstone, re-add restores',async()=>{
  const original={repo:'o/r',business:'static',limit:8},h=harness({repositories:[original]})
  await h.call({action:'patch',repo:'o/r',patch:{mode:'issues'}})
  assert.equal(h.state().overrides['o/r'].business,'static');assert.equal(original.mode,undefined)
  await h.call({action:'remove',repo:'o/r'});assert.equal((await h.call({action:'snapshot'})).repositories.length,0)
  await h.call({action:'add',value:{repo:'o/r'}});assert.equal((await h.call({action:'snapshot'})).repositories.length,1)
})
for(const request of [
  {action:'add',value:{repo:'bad'}},{action:'add',value:{repo:'o/r',limit:101}},
  {action:'add',value:{repo:'o/r',schedule:{kind:'daily',time:'25:00'}}},
  {action:'patch',repo:'o/r',patch:{limit:0}},{action:'patch',repo:'o/r',patch:{repo:'x/y'}},
  {action:'patch',repo:'o/r',patch:{unknown:true}},
  {action:'start',repo:'o/r',scan:{full:true,limit:5}},{action:'start',repo:'o/r',scan:{since:'2026-02-30'}},
  {action:'start',repo:'o/r',scan:{full:true,since:'2026-11-11',until:'2026-01-01'}},
  {action:'start',repo:'o/r',scan:{max:501}},{action:'fix',repo:'o/r',number:1,recommendation:'adopt',reason:' '},
  {action:'github-write',repo:'o/r'},
])test('UI validation rejects '+JSON.stringify(request),async()=>{
  const h=harness({repositories:[{repo:'o/r'}]});const result=await h.service(request)
  assert.equal(result.ok,false);assert.ok(result.fields);assert.equal(h.saves(),0)
})
test('UI refuses duplicate add, missing patch, invalid local path without changing state',async()=>{
  const h=harness({repositories:[{repo:'o/r'}]},{validate:async r=>{if(r.localRepoPath)throw new Error('PRIVATE OS ERROR')}})
  for(const r of [{action:'add',value:{repo:'o/r'}},{action:'patch',repo:'missing/repo',patch:{limit:4}},{action:'patch',repo:'o/r',patch:{localRepoPath:'missing'}}]){
    const result=await h.service(r);assert.equal(result.ok,false);assert.ok(!JSON.stringify(result).includes('PRIVATE OS ERROR'))
  }
  assert.equal(h.saves(),0)
})
test('UI max 50 repository cap also applies to additions',async()=>{
  const h=harness({repositories:Array.from({length:50},(_,i)=>({repo:'o/r'+i}))})
  assert.equal((await h.service({action:'add',value:{repo:'o/extra'}})).ok,false);assert.equal(h.saves(),0)
})
test('UI triggers asynchronously, prevents duplicate enqueue, reports results and completion',async()=>{
  const gate=Promise.withResolvers(),h=harness({repositories:[{repo:'o/r'}]},{before:()=>gate.promise})
  const first=await h.call({action:'start',repo:'o/r',scan:{limit:2}})
  assert.equal(first.status,'queued')
  assert.equal((await h.call({action:'jobs'}))[0].status,'running')
  await h.call({action:'start',repo:'o/r',scan:{full:true,max:100}})
  assert.equal((await h.call({action:'jobs'})).length,1)
  assert.equal((await h.call({action:'snapshot'})).reports.length,0,'reads do not block behind analysis')
  gate.resolve();await h.drain()
  const s=await h.call({action:'snapshot'});assert.equal(s.jobs[0].status,'completed');assert.equal(s.reports[0].results.length,2);assert.equal(h.saves(),1)
})
test('UI, command and timer operations use the exact same serial queue',async()=>{
  const gate=Promise.withResolvers(),h=harness({repositories:[{repo:'o/r'},{repo:'o/s'}]},{before:()=>gate.promise})
  const timer=h.serialize(()=>h.perform({repo:'o/r',mode:'both'},2,true,h.signal.signal,{}))
  await h.call({action:'start',repo:'o/s',scan:{limit:2}})
  const edit=h.call({action:'patch',repo:'o/r',patch:{business:'编辑期间'}})
  assert.equal((await h.call({action:'snapshot'})).jobs[0].status,'queued')
  gate.resolve();await timer;await edit;await h.drain();assert.equal(h.maxActive(),1)
})
test('UI start failures are observable; retry can complete',async()=>{
  let fail=true
  const h=harness({repositories:[{repo:'o/r'}]},{before:()=>{if(fail)throw new Error('DO NOT ECHO')}})
  await h.call({action:'start',repo:'o/r',scan:{}});await h.drain()
  let job=(await h.call({action:'jobs'}))[0];assert.equal(job.status,'failed');assert.ok(!job.message.includes('DO NOT ECHO'))
  fail=false;await h.call({action:'start',repo:'o/r',scan:{}});await h.drain();assert.equal((await h.call({action:'jobs'}))[0].status,'completed')
})
test('UI correction updates report, preserves evidence, produces exportable rule without overwrite',async()=>{
  const h=harness({repositories:[{repo:'o/r',business:'核心业务'}]})
  await h.call({action:'start',repo:'o/r',scan:{limit:2}});await h.drain()
  await h.call({action:'fix',repo:'o/r',number:1,recommendation:'not-recommended',reason:'本地业务没有这个模块'})
  const s=await h.call({action:'snapshot'}),result=s.reports[0].results.find(r=>r.number===1)
  assert.equal(result.source,'correction');assert.equal(result.judgment.worthFixing,'不值得修')
  const text=await h.call({action:'rules',repo:'o/r'});assert.match(text,/核心业务/);assert.match(text,/本地业务没有这个模块/)
  const parent=fileURLToPath(new URL('../.tmp/',import.meta.url));await mkdir(parent,{recursive:true})
  const dir=await mkdtemp(path.join(parent,'ui-rules-'))
  try{
    const file=path.join(dir,'rules.md')
    await h.call({action:'export',repo:'o/r',path:file});assert.equal(await readFile(file,'utf8'),text)
    assert.equal((await h.service({action:'export',repo:'o/r',path:file})).ok,false)
    assert.equal(await readFile(file,'utf8'),text)
  }finally{assert.ok(path.resolve(dir).startsWith(path.resolve(parent)+path.sep));await rm(dir,{recursive:true,force:true})}
})
test('UI cannot correct a rule-only result or operate after disposal',async()=>{
  const h=harness({repositories:[{repo:'o/r'}]})
  assert.equal((await h.service({action:'fix',repo:'o/r',number:1,recommendation:'adopt',reason:'理由'})).ok,false)
  h.signal.abort();assert.equal((await h.service({action:'snapshot'})).ok,false)
})
test('form delta omits unchanged settings and uses explicit null for cleared fields',()=>{
  const before={repo:'o/r',mode:'both',business:'old',rulesFile:'C:\\rules',limit:8},after={...before,business:'new',limit:undefined}
  const delta=changedFields(before,after);assert.deepEqual(delta,{business:'new',limit:null})
  assert.equal(mergeRepo({...before,rulesFile:'C:\\latest'},delta).rulesFile,'C:\\latest')
  assert.throws(()=>requestSchema.parse({action:'patch',repo:'o/r',patch:{mode:null}}))
})
