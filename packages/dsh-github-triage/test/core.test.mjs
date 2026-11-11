import test from 'node:test'
import assert from 'node:assert/strict'
import { rules, similarity, duplicateOf } from '../lib/rules.js'
import { emptyState, judgmentSchema, stateSchema, repoSchema } from '../lib/types.js'
import { run, fingerprint, correct, briefing, render, sorted } from '../lib/pipeline.js'
import { parseJudgment, dshModel } from '../lib/model.js'
import { dueSlot } from '../lib/schedule.js'
import { repoCommand, repositories, runArguments } from '../lib/config.js'
import { settings, Config } from '../lib/plugin.js'
import { SafeText } from '../lib/safety.js'
const issue=(extra={})=>({number:1,kind:'issue',title:'startup render fails',body:'## Steps to reproduce\n1. Open application\n2. Click render\nVersion: 0.2.1\nError: render failed',updated_at:'2026-11-11T00:00:00Z',url:'https://github.com/o/r/issues/1',...extra})
const pr=(extra={})=>issue({kind:'pr',head:'a',files:[{path:'src/render.ts',additions:10,deletions:2},{path:'test/render.test.ts',additions:5,deletions:0}],ci:[{name:'build',state:'pass'}],additions:15,deletions:2,changedFiles:2,...extra})
const repo={repo:'o/r',mode:'both'}
const options={limit:20,now:100}
const source=(items)=>({list:async()=>items,enrich:async(_,i)=>i,safe:new SafeText({})})
test('bug has reproduction/version/error evidence and worth fixing',()=>{const j=rules(issue());assert.equal(j.type,'bug');assert.equal(j.real,'是');assert.equal(j.worth,'值得修');assert.ok(j.evidence.some(e=>e.includes('未定位')))})
for(const [title,body,type] of [
  ['Feature request','We need a new rendering option and support for grouped reports. '.repeat(3),'需求'],
  ['How to configure rendering?','Please explain the rendering setup','提问'],
  ['nothing','','无效'],
  ['startup fails','it does not work','bug'],
]) test('issue classification '+type,()=>assert.equal(rules(issue({title,body})).type,type))
test('missing evidence is explicit and real is uncertain',()=>{const j=rules(issue({body:'No details yet'}));assert.equal(j.real,'待证实');assert.equal(j.worth,'待补充');for(const s of ['缺复现步骤','缺版本信息','缺日志/报错'])assert.ok(j.evidence.includes(s))})
test('critical problem ranks high and still notes uncertainty',()=>assert.equal(rules(issue({title:'data loss on startup'})).priority,'高'))
test('rough location is evidence, never proof of reproduction',()=>{const j=rules(issue({body:'Cannot start it',locations:['src/start.ts']}));assert.equal(j.real,'待证实');assert.match(j.evidence.join(),/粗略定位/)})
test('duplicate compares only older issues, not self/PR',()=>{const a=issue(),b=issue({number:2});assert.equal(duplicateOf(b,[a,b]),1);assert.equal(rules(b,[a]).type,'重复');assert.equal(duplicateOf(a,[a,pr({number:0})]),undefined)})
test('Chinese similarity and unrelated reports',()=>{assert.equal(similarity('无法启动桌面应用','无法启动桌面应用'),1);assert.ok(similarity('登录失败','文件路径错误')<0.5);assert.equal(similarity('',''),0)})
test('body similarity plus title threshold finds duplicate',()=>{const a=issue({title:'renderer startup failure',body:'The startup renderer produces an invalid node and crashes. '.repeat(5)});const b={...a,number:2,title:'renderer startup failures'};assert.equal(duplicateOf(b,[a]),1)})
test('passing tested PR is merge candidate',()=>assert.equal(rules(pr()).verdict,'值得合并'))
for(const [label,extra,evidence] of [
  ['missing tests',{files:[{path:'src/a.ts',additions:2,deletions:0}]},'没加测试'],
  ['CI fail',{ci:[{name:'build',state:'fail'}]},'CI 失败: build'],
  ['CI pending',{ci:[{name:'build',state:'pending'}]},'CI 未完成'],
  ['CI unknown',{ci:[]},'状态未知'],
  ['large scope',{changedFiles:31},'规模大'],
  ['draft',{draft:true},'草稿'],
  ['partial',{notes:['文件列表达到分页上限；审查不完整']},'不完整'],
]) test('PR '+label,()=>{const j=rules(pr(extra));assert.equal(j.verdict,'改完再合');assert.ok(j.evidence.some(e=>e.includes(evidence)))})
for(const path of ['package.json','pnpm-lock.yaml','.github/workflows/ci.yml','scripts/install.js','setup.sh','permissions/admin.ts','lib/a.dll','Cargo.toml','requirements.txt','yarn.lock'])test('sensitive path '+path,()=>{const j=rules(pr({files:[{path,additions:1,deletions:0}]}));assert.equal(j.suspicious,true);assert.equal(j.priority,'高')})
test('binary is not recommended for merge',()=>assert.equal(rules(pr({files:[{path:'x.exe',additions:0,deletions:0}]})).verdict,'不建议合'))
test('linked issue correspondence is assessed',()=>{const j=rules(pr({linked:[{number:8,title:'unrelated payment invoices',body:'accounting'}]}));assert.ok(j.evidence.some(e=>e.includes('对应性不足')));assert.equal(j.verdict,'改完再合')})
test('default config has zero repositories and is valid schemastery',()=>{assert.deepEqual(settings({}).repositories,[]);assert.deepEqual(Config({}).repositories,[])})
test('config daily/every validation and limits',()=>{assert.throws(()=>settings({repositories:[{repo:'o/r',daily:'25:00'}]}));assert.throws(()=>settings({repositories:[{repo:'o/r',daily:'12:00',everyHours:1}]}));assert.throws(()=>settings({limit:101}));assert.equal(settings({repositories:[{repo:'o/r',everyHours:2}]}).repositories[0].schedule.hours,2)})
test('repository commands overlay config and tombstone removals',()=>{const s=emptyState();repoCommand('add O/R --prs --daily 09:30 --limit 5',s);assert.equal(repositories([repo],s)[0].mode,'prs');repoCommand('remove o/r',s);assert.deepEqual(repositories([repo],s),[]);repoCommand('add o/r --issues --every 2',s);assert.equal(repositories([],s)[0].schedule.hours,2);assert.ok(stateSchema.safeParse(s).success)})
for(const raw of ['add o/r --issues --prs','add o/r --daily 09:00 --every 2','add o/r --every 0','add o/r --daily 24:00','add o/r --limit 101','add o/r --bogus','remove o/r --prs','add ../x','add o/..'])test('invalid repo command '+raw,()=>assert.throws(()=>repoCommand(raw,emptyState())))
test('manual arguments and override limit',()=>{assert.deepEqual(runArguments('o/r --limit 5'),{repo:'o/r',limit:5});assert.deepEqual(runArguments(''),{repo:undefined});assert.throws(()=>runArguments('--limit 0'));assert.throws(()=>runArguments('o/r unexpected'))})
const time=(s)=>new Date(s).getTime()
test('daily local time due boundary and no repeat',()=>{const now=new Date(2026,10,11,9,30).getTime(),s={kind:'daily',time:'09:30'};assert.equal(dueSlot(s,now-1,now),now);assert.equal(dueSlot(s,now,now+1000),undefined)})
test('daily cross day startup catch up exactly one',()=>{const now=new Date(2026,10,12,8,0).getTime(),last=new Date(2026,10,9,10,0).getTime(),s={kind:'daily',time:'09:30'};const slot=dueSlot(s,last,now);assert.equal(slot,new Date(2026,10,11,9,30).getTime());assert.equal(dueSlot(s,now,now+1000),undefined)})
test('daily before time waits after previous run',()=>{const last=new Date(2026,10,10,10).getTime(),now=new Date(2026,10,11,9).getTime();assert.equal(dueSlot({kind:'daily',time:'09:30'},last,now),undefined)})
test('every N hours and missed run coalescing',()=>{const s={kind:'every',hours:2};assert.equal(dueSlot(s,0,7199999),undefined);assert.equal(dueSlot(s,0,7200000),7200000);assert.equal(dueSlot(s,0,72000000),72000000);assert.equal(dueSlot(s,72000000,72000001),undefined)})
test('startup every runs once, no schedule and clock rollback',()=>{assert.equal(dueSlot({kind:'every',hours:1},undefined,12),12);assert.equal(dueSlot(undefined,0,100),undefined);assert.equal(dueSlot({kind:'every',hours:1},100,90),undefined)})
test('incremental new unchanged updated and head sha changes',async()=>{const s=emptyState();let items=[issue(),pr({number:2})],calls=0;const src={list:async()=>items,enrich:async(_,i)=>{calls++;return i}};let r=await run(src,repo,s,options);assert.equal(r.analyzed,2);r=await run(src,repo,s,options);assert.equal(r.analyzed,0);assert.equal(r.reused,2);assert.equal(r.briefing,undefined);items=[{...items[0],updated_at:'new'},{...items[1],head:'b'}];r=await run(src,repo,s,options);assert.equal(r.analyzed,2);assert.equal(calls,4);assert.notEqual(fingerprint(pr()),fingerprint(pr({head:'b'})))})
test('limit applies even to misbehaving sources',async()=>{const s=emptyState();const r=await run(source(Array.from({length:40},(_,i)=>issue({number:i+1}))),repo,s,{...options,limit:5});assert.equal(r.results.length,5);assert.equal(Object.keys(s.cache).length,5)})
test('briefing only for new or updated content',()=>{assert.equal(briefing('o/r',[],5),undefined);assert.match(briefing('o/r',[{judgment:rules(issue())}],0),/1 个 issue，1 个值得修/)})
const good=rules(issue())
for(const [label,text,ok] of [
  ['JSON',JSON.stringify(good),true],['fenced','\x60\x60\x60json\n'+JSON.stringify(good)+'\n\x60\x60\x60',true],
  ['malformed','{broken',false],['missing','{"kind":"issue"}',false],
  ['extra',JSON.stringify({...good,extra:1}),false],['wrong kind',JSON.stringify(rules(pr())),false],
  ['bad priority',JSON.stringify({...good,priority:'urgent'}),false],
])test('model parsing '+label,()=>ok?assert.deepEqual(parseJudgment(text,'issue'),good):assert.throws(()=>parseJudgment(text,'issue')))
test('model valid output and preserves observed evidence',async()=>{const s=emptyState();const r=await run(source([issue()]),repo,s,{...options,model:async()=>JSON.stringify({...good,reason:'最终判断',evidence:['模型解释']})});assert.equal(r.results[0].source,'model');assert.ok(r.results[0].judgment.evidence.includes('模型解释'));assert.ok(r.results[0].judgment.evidence.includes('有复现步骤'))})
for(const [label,model,note] of [['missing',undefined,'模型不可用'],['throws',async()=>{throw new Error('DO NOT ECHO')},'模型不可用'],['bad JSON',async()=>'{oops','模型解析失败']])test('model fallback '+label,async()=>{const r=await run(source([issue()]),repo,emptyState(),{...options,model});assert.equal(r.results[0].source,'rules');assert.match(r.results[0].modelNote,new RegExp(note));assert.ok(!JSON.stringify(r).includes('DO NOT ECHO'))})
test('model cannot erase suspicious flags or CI blocking',async()=>{const item=pr({files:[{path:'package.json',additions:1,deletions:0}]});const candidate=rules(pr());const r=await run(source([item]),repo,emptyState(),{...options,model:async()=>JSON.stringify(candidate)});assert.equal(r.results[0].judgment.suspicious,true);assert.equal(r.results[0].judgment.verdict,'改完再合')})
test('correction overrides same item even after update and becomes few-shot',async()=>{const s=emptyState();await run(source([issue()]),repo,s,options);correct(s,'o/r#1 不值得修 已经由其他模块解决',123);let modelCalls=0;let r=await run(source([issue({updated_at:'later'})]),repo,s,{...options,model:async()=>{modelCalls++;return ''}});assert.equal(r.results[0].source,'correction');assert.equal(r.results[0].judgment.worth,'不值得修');assert.equal(modelCalls,0);let prompt='';await run(source([issue({number:2})]),repo,s,{...options,model:async p=>{prompt=p;return JSON.stringify(good)}});assert.match(prompt,/已经由其他模块解决/);assert.match(render(s.reports['o/r']),/原链接/)})
test('correction validates item and judgment',async()=>{const s=emptyState();assert.throws(()=>correct(s,'o/r#1 bug',0));await run(source([pr()]),repo,s,options);assert.throws(()=>correct(s,'o/r#1 bug',0));correct(s,'o/r#1 不建议合 可疑',0);assert.equal(s.reports['o/r'].results[0].judgment.verdict,'不建议合')})
test('PR suspicious comes first then high to low',()=>{const list=[{number:1,judgment:rules(issue())},{number:2,judgment:rules(pr({files:[{path:'package.json',additions:0,deletions:0}]}))}];assert.equal(sorted(list)[0].number,2)})
test('tokens never enter model, report, correction or serialized state',async()=>{const secret='fixtureSecret123456',safe=new SafeText({GITHUB_TOKEN:secret}),s=emptyState();let prompt='';const src={...source([issue({body:issue().body+' '+secret,title:'bug '+secret})]),safe};const r=await run(src,repo,s,{...options,model:async p=>{prompt=p;return JSON.stringify({...good,reason:secret})}});assert.ok(![prompt,JSON.stringify(s),render(r)].join().includes(secret));correct(s,safe.text('o/r#1 不值得修 '+secret),1);assert.ok(!JSON.stringify(s).includes(secret));assert.ok(!safe.text('github_pat_fixtureABC12345').includes('fixtureABC12345'))})
test('DSH model uses llm.stream without tools or credential access',async()=>{let request;const ctx={get:n=>n==='llm'?{async *stream(r){request=r;yield {type:'text-delta',text:JSON.stringify(good)};yield {type:'finish',reason:{kind:'stop'}}}}:undefined};const model=dshModel(ctx,{modelEnabled:true,provider:'dsh-route',model:'configured-model'});assert.deepEqual(parseJudgment(await model('evidence'),'issue'),good);assert.deepEqual(request.tools,[]);assert.equal(request.provider,'dsh-route');assert.equal(request.messages[0].role,'user');assert.equal(dshModel(ctx,{modelEnabled:false}),undefined)})
test('DSH model stream error falls back',async()=>{const ctx={get:()=>({async *stream(){yield {type:'finish',reason:{kind:'error'}}}})};const r=await run(source([issue()]),repo,emptyState(),{...options,model:dshModel(ctx,{modelEnabled:true,provider:'a',model:'b'})});assert.match(r.results[0].modelNote,/模型不可用/)})


test('global limit is inherited when static repository has no override',()=>{const resolved=settings(Config({repositories:[{repo:'o/r'}],limit:7}));assert.equal(resolved.limit,7);assert.equal(resolved.repositories[0].limit,undefined)})
test('secret redaction preserves valid structured data with escaped characters',()=>{const secret='fixture"quoted\\secret',safe=new SafeText({GH_TOKEN:secret});const result=safe.value({text:secret,nested:[secret]});assert.deepEqual(result,{text:'[REDACTED]',nested:['[REDACTED]']})})
test('cancellation after model does not cache partial conclusion',async()=>{const controller=new AbortController(),s=emptyState();await assert.rejects(run(source([issue()]),repo,s,{...options,signal:controller.signal,model:async()=>{controller.abort();return JSON.stringify(good)}}));assert.deepEqual(s.cache,{})})
test('correction is applied on unchanged cache hits without model calls',async()=>{const s=emptyState();await run(source([issue()]),repo,s,options);correct(s,'o/r#1 不值得修 误报',0);let calls=0;const r=await run(source([issue()]),repo,s,{...options,model:async()=>{calls++;return ''}});assert.equal(r.reused,1);assert.equal(r.results[0].source,'correction');assert.equal(calls,0)})


test('corrections retain the latest authoritative record per item',async()=>{const s=emptyState();await run(source([issue()]),repo,s,options);correct(s,'o/r#1 待补充 first',1);correct(s,'o/r#1 不值得修 latest',2);assert.equal(s.corrections.length,1);assert.equal(s.corrections[0].reason,'latest');assert.ok(stateSchema.safeParse(s).success)})


const disabledNotice='该仓库已关闭 Issues/PR 功能；已跳过对应拉取。'
test('disabled features appear in an empty report and one briefing, then remain quiet',async()=>{
  const state=emptyState(),src={...source([]),warnings:[disabledNotice]}
  const first=await run(src,repo,state,options)
  assert.equal(first.analyzed,0);assert.deepEqual(first.results,[])
  assert.match(render(first),/该仓库已关闭 Issues\/PR 功能/)
  assert.match(first.briefing,/o\/r：该仓库已关闭 Issues\/PR 功能/)
  const restored=stateSchema.parse(JSON.parse(JSON.stringify(state)))
  const second=await run(src,repo,restored,options)
  assert.equal(second.briefing,undefined)
  assert.match(render(second),/该仓库已关闭 Issues\/PR 功能/)
  src.warnings=[]
  await run(src,repo,restored,options)
  src.warnings=[disabledNotice]
  assert.match((await run(src,repo,restored,options)).briefing,/已关闭/)
})
test('partial feature closure appears beside new analysis in the same briefing',async()=>{
  const src={...source([issue()]),warnings:['该仓库已关闭 PR 功能；已跳过对应拉取。']}
  const report=await run(src,repo,emptyState(),options)
  assert.equal(report.results.length,1)
  assert.match(report.briefing,/1 个 issue/)
  assert.match(report.briefing,/该仓库已关闭 PR 功能/)
})
test('anonymous warning alone does not push an empty briefing',async()=>{
  const src={...source([]),warnings:['匿名访问 GitHub，限流额度较低。']}
  assert.equal((await run(src,repo,emptyState(),options)).briefing,undefined)
})
