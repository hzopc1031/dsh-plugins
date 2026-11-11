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
test('issue rules collect evidence only',()=>{const r=rules(issue());assert.deepEqual(Object.keys(r).sort(),['evidence','kind']);for(const value of ['有复现步骤','有版本信息','有日志/报错'])assert.ok(r.evidence.includes(value))})
test('missing issue evidence is explicit',()=>{const r=rules(issue({body:'No details'}));for(const value of ['缺复现步骤','缺版本信息','缺日志/报错'])assert.ok(r.evidence.includes(value));assert.match(r.evidence.join(),/缺 issue 模板/)})
test('rough location is evidence and no reproduction proof',()=>assert.match(rules(issue({locations:['src/start.ts']})).evidence.join(),/粗略定位/))
test('duplicate compares older issues only',()=>{const a=issue(),b=issue({number:2});assert.equal(duplicateOf(b,[a,b]),1);assert.match(rules(b,[a]).evidence.join(),/疑似重复 #1/);assert.equal(duplicateOf(a,[a,pr({number:0})]),undefined)})
test('Chinese similarity and unrelated reports',()=>{assert.equal(similarity('无法启动桌面应用','无法启动桌面应用'),1);assert.ok(similarity('登录失败','文件路径错误')<0.5);assert.equal(similarity('',''),0)})
test('body similarity with title threshold',()=>{const a=issue({title:'renderer startup failure',body:'The startup renderer produces an invalid node and crashes. '.repeat(5)});assert.equal(duplicateOf({...a,number:2,title:'renderer startup failures'},[a]),1)})
test('PR rules do not produce any verdict',()=>{const r=rules(pr());assert.deepEqual(Object.keys(r).sort(),['evidence','kind']);assert.match(r.evidence.join(),/有测试改动/)})
for(const [label,extra,evidence] of [
  ['missing tests',{files:[{path:'src/a.ts',additions:2,deletions:0}]},'没加测试'],
  ['CI fail',{ci:[{name:'build',state:'fail'}]},'CI 失败: build'],
  ['CI pending',{ci:[{name:'build',state:'pending'}]},'CI 未完成'],
  ['CI unknown',{ci:[]},'状态未知'],['large scope',{changedFiles:31},'规模超过'],
  ['draft',{draft:true},'草稿'],['partial',{notes:['审查不完整']},'不完整'],
])test('PR evidence '+label,()=>assert.ok(rules(pr(extra)).evidence.some(e=>e.includes(evidence))))
for(const path of ['package.json','pnpm-lock.yaml','.github/workflows/ci.yml','scripts/install.js','setup.sh','permissions/admin.ts','lib/a.dll','Cargo.toml','requirements.txt','yarn.lock'])test('sensitive path evidence '+path,()=>assert.match(rules(pr({files:[{path,additions:1,deletions:0}]})).evidence.join(),/可疑\/敏感改动/))
test('linked issue correspondence remains evidence',()=>assert.match(rules(pr({linked:[{number:8,title:'unrelated payment invoices',body:'accounting'}]})).evidence.join(),/对应性不足/))
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
test('global limit is inherited when static repository has no override',()=>{const resolved=settings(Config({repositories:[{repo:'o/r'}],limit:7}));assert.equal(resolved.limit,7);assert.equal(resolved.repositories[0].limit,undefined)})
test('secret redaction preserves valid structured data with escaped characters',()=>{const secret='fixture"quoted\\secret',safe=new SafeText({GH_TOKEN:secret});const result=safe.value({text:secret,nested:[secret]});assert.deepEqual(result,{text:'[REDACTED]',nested:['[REDACTED]']})})

test('add merges only explicit options into latest command/static repository settings',()=>{
  const s=emptyState(),staticRepo={repo:'o/r',mode:'prs',business:'核心业务',businessFile:'docs/business.md',localRepoPath:'C:\\repo',localRef:'release',rulesFile:'C:\\rules.md',fullMax:200,schedule:{kind:'daily',time:'09:30'},limit:8}
  repoCommand('add o/r --limit 4',s,[staticRepo])
  assert.deepEqual(s.overrides['o/r'],{...staticRepo,limit:4})
  repoCommand('add o/r --business "新业务"',s,[staticRepo])
  assert.equal(s.overrides['o/r'].business,'新业务');assert.equal(s.overrides['o/r'].limit,4);assert.equal(s.overrides['o/r'].businessFile,'docs/business.md')
})
