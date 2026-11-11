import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp,mkdir,writeFile,readFile,rm,readdir,link } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { openLocal,localEvidence,gitAllowed,gitRead,completePatch,refValue,LOCAL_TOTAL } from '../lib/local.js'
import { rulesDocument,exportDocument,importDocument,loadRules,rulesCommand } from '../lib/rule-files.js'
import { emptyState,stateSchema,fullLimitSchema } from '../lib/types.js'
import { run,render,sorted,briefing,correct } from '../lib/pipeline.js'
import { parseJudgment } from '../lib/model.js'
import { repoCommand,runArguments } from '../lib/config.js'
import { settings,Config } from '../lib/plugin.js'
import { Github } from '../lib/github.js'
import { SafeText } from '../lib/safety.js'
import { repo,issue,pr,good,goodPr,options,source } from './fixtures.mjs'
const parent=fileURLToPath(new URL('../.tmp/',import.meta.url)),safe=new SafeText({})
async function temp(fn){await mkdir(parent,{recursive:true});const dir=await mkdtemp(path.join(parent,'local-'));try{return await fn(dir)}finally{const rel=path.relative(parent,dir);assert.ok(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel));await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100})}}
const git=(dir,...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',windowsHide:true,shell:false,env:{...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null'}}).trim()
async function repository(dir){git(dir,'init','-q');git(dir,'config','user.name','Test');git(dir,'config','user.email','fixture@example.invalid');git(dir,'config','core.autocrlf','false');await mkdir(path.join(dir,'src'));await writeFile(path.join(dir,'src/render.ts'),'export function render(){return false}\n');git(dir,'add','.');git(dir,'commit','-qm','initial snapshot');return git(dir,'rev-parse','HEAD')}
const response=body=>({ok:true,status:200,headers:{get:()=>null},json:async()=>body})
const wire=n=>({number:n,title:'renderer issue '+n,body:'Steps',updated_at:'2026-11-11',pull_request:n%2?undefined:{}})

test('local snapshot reads existing/missing files and never reads dirty files',()=>temp(async dir=>{await repository(dir);await writeFile(path.join(dir,'src/render.ts'),'UNCOMMITTED SECRET');const local=await openLocal({...repo,localRepoPath:dir});assert.ok(local.sha);const r=await localEvidence(local,pr({files:[{path:'src/render.ts'},{path:'src/missing.ts'}]}));assert.deepEqual(r.files.map(f=>f.exists),[true,false]);assert.match(r.files[0].snippet,/function render/);assert.ok(!JSON.stringify(r).includes('UNCOMMITTED'));assert.ok(Buffer.byteLength(JSON.stringify(r))<=LOCAL_TOTAL);assert.equal(git(dir,'status','--porcelain').slice(0,2),'M ')}))
test('issue fix commit keyword and upstream PR already contained in local history',()=>temp(async dir=>{await repository(dir);await writeFile(path.join(dir,'src/render.ts'),'export function render(){return true}\n');git(dir,'add','.');git(dir,'commit','-qm','fix #42 renderer failure');const sha=git(dir,'rev-parse','HEAD'),local=await openLocal({...repo,localRepoPath:dir});const r=await localEvidence(local,issue({number:42,locations:['src/render.ts'],fixes:[pr({number:43,mergeCommit:sha})]}));assert.match(r.evidence.join(),/fix #42 renderer failure/);assert.match(r.evidence.join(),/上游提交已包含在本地历史/);assert.match(r.evidence.join(),/关联修复 PR #43/)}))
test('same complete patch with another upstream SHA is detected by real git patch-id',()=>temp(async dir=>{await repository(dir);await writeFile(path.join(dir,'src/render.ts'),'export function render(){return true}\n');git(dir,'add','.');git(dir,'commit','-qm','downstream backport');const item=pr({head:'a'.repeat(40),changedFiles:1,files:[{path:'src/render.ts',additions:1,deletions:1,patch:'@@ -1 +1 @@\n-export function render(){return false}\n+export function render(){return true}'}]});assert.ok(completePatch(item));const r=await localEvidence(await openLocal({...repo,localRepoPath:dir}),item);assert.match(r.evidence.join(),/相同 patch-id/)}))
test('selected ref remains pinned and HEAD changes invalidate local fingerprint',()=>temp(async dir=>{const first=await repository(dir),one=await openLocal({...repo,localRepoPath:dir});git(dir,'commit','--allow-empty','-qm','second');const two=await openLocal({...repo,localRepoPath:dir}),pinned=await openLocal({...repo,localRepoPath:dir,localRef:first});assert.notEqual(one.fingerprint,two.fingerprint);assert.equal(pinned.sha,first);assert.equal((await localEvidence(pinned,issue({locations:['src/render.ts']}))).commit,first)}))
test('unconfigured local comparison performs no process/file inspection',async()=>{const local=await openLocal(repo);assert.equal(local.status,'未配置本地仓库对照');assert.deepEqual((await localEvidence(local,issue())).files,[]);assert.match(render(await run(source([issue()]),repo,emptyState(),options)),/未配置本地仓库对照/)})
for(const value of ['relative','\\\\host\\share','\\\\?\\C:\\repo','C:\\NUL','/dev/null','C:\\repo:ads'])test('invalid local repository path '+value,async()=>{const local=await openLocal({...repo,localRepoPath:value});assert.equal(local.sha,undefined);assert.match(local.status,/失败/)})
test('missing directory, non-git directory, file, invalid ref are rejected',()=>temp(async dir=>{await writeFile(path.join(dir,'file'),'x');for(const localRepoPath of [dir,path.join(dir,'missing'),path.join(dir,'file')])assert.equal((await openLocal({...repo,localRepoPath})).sha,undefined);await repository(dir);assert.equal((await openLocal({...repo,localRepoPath:dir,localRef:'missing-ref'})).sha,undefined)}))
for(const cmd of ['checkout','fetch','pull','push','add','commit','reset','clean','merge','cherry-pick','apply','update-ref','config','init','clone','gc','repack','branch','tag','switch'])test('git whitelist refuses '+cmd,async()=>{assert.equal(gitAllowed([cmd]),false);await assert.rejects(gitRead(parent,[cmd]),/白名单/)})
for(const args of [['branch','--delete','main'],['log','--output=x'],['rev-parse','--git-dir'],['-c','alias.x=!bad','x'],['show','--output=x','HEAD'],['patch-id','--verbatim'],['merge-base','--is-ancestor','--all','HEAD']])test('git whitelist refuses option injection '+args.join(' '),()=>assert.equal(gitAllowed(args),false))
for(const ref of ['--output=x','main~1','main^{tree}','main:src','../foo','a\nb','a\\b','a@{1}'])test('invalid ref '+JSON.stringify(ref),()=>assert.throws(()=>refValue(ref)))
test('real git has bounded stdout and a cancellable timeout',()=>temp(async dir=>{await repository(dir);const local=await openLocal({...repo,localRepoPath:dir});await assert.rejects(gitRead(dir,['log','-n80','--format=%H%x09%s',local.sha],{maxBytes:1}),/输出超过上限/);await assert.rejects(gitRead(dir,['patch-id','--stable'],{input:'x'.repeat(2*1024*1024),timeoutMs:1}),/超时/);const controller=new AbortController();const task=gitRead(dir,['patch-id','--stable'],{input:'x'.repeat(2*1024*1024),signal:controller.signal});controller.abort();await assert.rejects(task,/取消/)}))
test('local source files respect 3 files, 3KB snippets, 64KB blob and 16KB context budgets',()=>temp(async dir=>{await repository(dir);for(let i=0;i<5;i++)await writeFile(path.join(dir,'src/f'+i+'.ts'),i===0?'x'.repeat(65537):'文'.repeat(5000));git(dir,'add','.');git(dir,'commit','-qm','large files');const r=await localEvidence(await openLocal({...repo,localRepoPath:dir}),pr({files:Array.from({length:5},(_,i)=>({path:'src/f'+i+'.ts'}))}));assert.equal(r.files.length,3);assert.equal(r.files[0].snippet,undefined);assert.ok(r.files.slice(1).every(f=>Buffer.byteLength(f.snippet)<=3072));assert.match(r.evidence.join(),/64KB/);assert.ok(Buffer.byteLength(JSON.stringify(r))<=LOCAL_TOTAL)}))
test('incomplete/unsafe patches cannot claim patch-id equivalence',()=>{for(const extra of [{changedFiles:3},{changedFiles:1,files:[{path:'../bad',patch:'@@ x',additions:0,deletions:0}]},{changedFiles:1,files:[{path:'a',patch:'@@ -1 +1 @@\n+partial',additions:2,deletions:0}]}])assert.equal(completePatch(pr(extra)),undefined)})
test('local evidence is supplied to model and local HEAD changes force reanalysis',()=>temp(async dir=>{await repository(dir);let prompt;const config={...repo,localRepoPath:dir},s=emptyState(),opts={...options,model:async p=>{prompt=JSON.parse(p);return JSON.stringify({...good,localApplicability:'present',localReason:'本地 render 函数存在'})}};const src=source([issue({locations:['src/render.ts']})]);await run(src,config,s,opts);assert.equal(prompt.local.files[0].exists,true);assert.match(prompt.local.files[0].snippet,/function render/);assert.equal((await run(src,config,s,opts)).reused,1);git(dir,'commit','--allow-empty','-qm','new snapshot');assert.equal((await run(src,config,s,opts)).analyzed,1)}))
test('local command/add options persist, clear preserves other settings',()=>{const s=emptyState();repoCommand('add o/r --local "C:\\my repo" --ref main --rules-file "C:\\rules.md" --full-max 250',s);assert.equal(s.overrides['o/r'].localRepoPath,'C:\\my repo');assert.equal(s.overrides['o/r'].localRef,'main');repoCommand('local o/r "C:\\other repo" --ref release',s);assert.equal(s.overrides['o/r'].fullMax,250);repoCommand('local o/r --clear',s);assert.equal(s.overrides['o/r'].localRef,undefined);assert.equal(s.overrides['o/r'].rulesFile,'C:\\rules.md')})
for(const raw of ['add o/r --ref main','local o/r --clear extra','local o/r a --wrong main','add o/r --local','add o/r --full-max 501'])test('reject local/rule config '+raw,()=>assert.throws(()=>repoCommand(raw,emptyState())))
for(const recommendation of ['adopt','manual-review','not-recommended'])for(const kind of ['issue','pr'])test('model parses and correction accepts '+kind+' '+recommendation,async()=>{const valid={...(kind==='issue'?good:goodPr),recommendation};assert.equal(parseJudgment('```json\n'+JSON.stringify(valid)+'\n```',kind).recommendation,recommendation);const s=emptyState();await run(source([kind==='issue'?issue():pr()]),repo,s,options);correct(s,'o/r#1 '+recommendation+' 业务规则纠正',123);assert.equal(s.cache['o/r#1'].result.judgment.recommendation,recommendation);assert.match(rulesDocument('o/r',s),/业务规则纠正/)})
test('cards and briefs group both kinds by recommendation then priority',()=>{const rows=[{number:1,kind:'issue',judgment:{...good,priority:'高',recommendation:'not-recommended'}},{number:2,kind:'pr',judgment:{...goodPr,priority:'低',recommendation:'adopt'}},{number:3,kind:'issue',judgment:{...good,priority:'高',recommendation:'manual-review'}},{number:4,kind:'pr',judgment:{...goodPr,priority:'高',recommendation:'adopt'}}].map(r=>({...r,title:'title',evidence:[],url:'https://github.com/o/r/issues/'+r.number,source:'model'}));assert.deepEqual(sorted(rows).map(r=>r.number),[4,2,3,1]);for(const text of [briefing('o/r',rows,0),render({repo:'o/r',at:1,results:rows,analyzed:4,reused:0,warnings:[],businessStatus:'未配置'})]){assert.ok(text.indexOf('建议采纳')<text.indexOf('需人工看'));assert.ok(text.indexOf('需人工看')<text.indexOf('不推荐'));assert.ok(text.indexOf('#4')<text.indexOf('#2'))}})
test('old 0.2.0 derived cache/report is invalidated while corrections are migrated',()=>{const {recommendation,localApplicability,localReason,...legacy}=good;const s=stateSchema.parse({formatVersion:2,overrides:{'o/r':repo},removed:[],cache:{invalid:'old'},reports:{invalid:'old'},pending:{'o/r':'old'},lastRun:{'o/r':1},corrections:[{repo:'o/r',number:1,title:'old',reason:'keep',at:1,judgment:legacy}]});assert.deepEqual(s.cache,{});assert.deepEqual(s.reports,{});assert.deepEqual(s.pending,{});assert.equal(s.corrections[0].judgment.recommendation,'adopt');assert.equal(s.formatVersion,3)})
test('old model output without unified fields is refused',()=>{const {recommendation,...old}=good;assert.throws(()=>parseJudgment(JSON.stringify(old),'issue'))})
test('full scan arguments and configurable bounds',()=>{assert.deepEqual(runArguments('o/r --full --since 2026-01-01 --until 2026-11-11 --max 500'),{repo:'o/r',full:true,since:'2026-01-01',until:'2026-11-11',max:500});assert.equal(settings({}).fullMax,100);assert.equal(settings(Config({fullMax:500,repositories:[{repo:'o/r',fullMax:200,localRepoPath:'C:\\repo',localRef:'main',rulesFile:'C:\\rules.md'}]})).repositories[0].fullMax,200);assert.throws(()=>fullLimitSchema.parse(501));assert.throws(()=>settings({fullMax:501}))})
for(const raw of ['o/r --full --max 0','o/r --full --max 501','o/r --since 2026-01-01','o/r --max 100','o/r --full --limit 5','o/r --full --since 2026-02-30','o/r --full --since 2026-11-11 --until 2026-01-01','o/r --full --max 1 --max 2','o/r --full --from-tag v1'])test('reject full arguments '+raw,()=>assert.throws(()=>runArguments(raw)))
test('full GitHub search paginates each kind, merges by updated time and caps the combined result',async()=>{
  const queries=[]
  const c=new Github({env:{},gh:async()=>'',fetch:async(url,init)=>{
    assert.equal(init.method,'GET')
    const u=new URL(url)
    if(u.pathname==='/repos/o/r')return response({})
    assert.equal(u.pathname,'/search/issues')
    const q=u.searchParams.get('q'),page=Number(u.searchParams.get('page')),isPr=q.includes('is:pr')
    assert.match(q,/\bis:(?:issue|pr)\b/)
    assert.equal(q,'repo:o/r is:'+(isPr?'pr':'issue')+' updated:2026-01-01..2026-11-11')
    assert.equal(u.searchParams.get('sort'),'updated');assert.equal(u.searchParams.get('order'),'desc')
    assert.equal(u.searchParams.get('per_page'),'100')
    queries.push([isPr?'pr':'issue',page])
    return response({items:Array.from({length:100},(_,i)=>{
      const n=((page-1)*100+i)*2+(isPr?2:1)
      return {...wire(n),updated_at:new Date(Date.UTC(2026,10,11)-n*1000).toISOString()}
    }),total_count:600,incomplete_results:page===1})
  }})
  const items=await c.list('o/r','both',150,undefined,{full:true,since:'2026-01-01',until:'2026-11-11'})
  assert.deepEqual(queries,[['issue',1],['issue',2],['pr',1],['pr',2]])
  assert.deepEqual(items.map(i=>i.number),Array.from({length:150},(_,i)=>i+1))
  assert.equal(items.filter(i=>i.kind==='pr').length,75)
  assert.ok(items.every(i=>i.url==='https://github.com/o/r/'+(i.kind==='pr'?'pull/':'issues/')+i.number))
  assert.equal(c.warnings.filter(w=>w.includes('超过上限 150')).length,1)
  assert.match(c.warnings.join(),/不完整/)
})
for(const [issues,prs,limit,warns] of [[2,2,3,true],[2,1,3,false],[1,1,3,false],[6,0,5,true]])test('full total_count cap notice '+issues+'+'+prs+'/'+limit,async()=>{
  const c=new Github({env:{},gh:async()=>'',fetch:async url=>{
    const u=new URL(url)
    if(u.pathname==='/repos/o/r')return response({})
    const q=u.searchParams.get('q');assert.match(q,/\bis:(?:issue|pr)\b/)
    return response({items:[],total_count:q.includes('is:pr')?prs:issues})
  }})
  await c.list('o/r','both',limit,undefined,{full:true})
  assert.equal(c.warnings.filter(w=>w.includes('超过上限')).length,Number(warns))
})
test('full pagination stops a short issue stream independently of the PR stream',async()=>{
  const queries=[]
  const c=new Github({env:{},gh:async()=>'',fetch:async url=>{
    const u=new URL(url)
    if(u.pathname==='/repos/o/r')return response({})
    const q=u.searchParams.get('q'),isPr=q.includes('is:pr'),page=Number(u.searchParams.get('page'))
    assert.match(q,/\bis:(?:issue|pr)\b/);queries.push([isPr?'pr':'issue',page])
    return response({items:isPr?Array.from({length:100},(_,i)=>({...wire(2*((page-1)*100+i+1)),updated_at:new Date(Date.UTC(2026,10,11)-((page-1)*100+i)*1000).toISOString()})):[{...wire(1),updated_at:'2026-01-01'}],total_count:isPr?300:1})
  }})
  const items=await c.list('o/r','both',150,undefined,{full:true})
  assert.deepEqual(queries,[['issue',1],['pr',1],['pr',2]])
  assert.equal(items.length,150);assert.ok(items.every(i=>i.kind==='pr'))
  assert.deepEqual(items.map(i=>i.number),Array.from({length:150},(_,i)=>2*(i+1)))
})
test('full run passes scan flags and enforces total bound before enrichment',async()=>{let scan,limit;const r=await run({...source([]),list:async(_,m,n,s,x)=>{limit=n;scan=x;return Array.from({length:170},(_,i)=>issue({number:i+1}))}},repo,emptyState(),{...options,full:true,since:'2026-01-01',limit:120});assert.equal(r.results.length,120);assert.equal(limit,120);assert.equal(scan.since,'2026-01-01');await assert.rejects(run(source([]),repo,emptyState(),{...options,full:true,limit:501}))})
test('GitHub local issue details get only explicit same-repo merged fixing PRs and commits',async()=>{const calls=[],sha='a'.repeat(40);const c=new Github({env:{},gh:async()=>'',fetch:async url=>{calls.push(url);if(url.includes('/search/issues'))return response({items:[{...wire(2),body:'Fixes #42'},{...wire(4),body:'Related #42'}]});if(url.endsWith('/pulls/2'))return response({...wire(2),merged:true,head:{sha},merge_commit_sha:sha,changed_files:1});if(url.includes('/files?'))return response([{filename:'src/render.ts',additions:1,deletions:1,patch:'@@ -1 +1 @@\n-old\n+new'}]);if(url.includes('/commits?'))return response([{sha,commit:{message:'fix #42 renderer'}}]);assert.fail(url)}});const r=await c.localDetails('o/r',issue({number:42}));assert.equal(r.fixes.length,1);assert.equal(r.fixes[0].commits[0].sha,sha);assert.equal(calls.length,4)})
test('no local repository means no extra upstream fix-PR requests',async()=>{let called=0;await run({...source([issue()]),localDetails:async()=>{called++;throw new Error()}},repo,emptyState(),options);assert.equal(called,0)})
test('rules export is explicit, refuses overwrite, force replaces, import preserves edits and injects',()=>temp(async dir=>{const s=emptyState();await run(source([issue()]),{...repo,business:'核心登录'},s,options);correct(s,'o/r#1 not-recommended 本地没有该模块',1);const text=rulesDocument('o/r',s);assert.match(text,/核心登录/);assert.match(text,/not-recommended/);const file=path.join(dir,'rules.md');await exportDocument(file,text);await assert.rejects(exportDocument(file,'overwritten'));assert.equal(await readFile(file,'utf8'),text);await writeFile(file,text.replace('本地没有该模块','编辑后的适用规则'));await rulesCommand('import o/r "'+file+'"',s,[repo],safe);assert.match(rulesDocument('o/r',s),/编辑后的适用规则/);let prompt;await run(source([issue({number:2})]),repo,s,{...options,model:async p=>{prompt=JSON.parse(p);return JSON.stringify(good)}});assert.match(prompt.repositoryRules,/编辑后的适用规则/);await exportDocument(file,'forced',true);assert.equal(await readFile(file,'utf8'),'forced');assert.deepEqual(await readdir(dir),['rules.md'])}))
test('rulesFile is read-only, bounded, redacted and changes invalidate cache',()=>temp(async dir=>{const file=path.join(dir,'external.md');await writeFile(file,'外部规则：只关注认证');const config={...repo,rulesFile:file},s=emptyState();let prompt;const opts={...options,model:async p=>{prompt=JSON.parse(p);return JSON.stringify(good)}};await run(source([issue()]),config,s,opts);assert.match(prompt.repositoryRules,/只关注认证/);assert.equal((await run(source([issue()]),config,s,opts)).reused,1);await writeFile(file,'新的外部规则');assert.equal((await run(source([issue()]),config,s,opts)).analyzed,1);assert.equal(await readFile(file,'utf8'),'新的外部规则');const missing=await loadRules({...repo,rulesFile:path.join(dir,'missing')},s,'',safe);assert.match(missing.status,/读取失败/)}))
test('rules reject mismatched repo/oversize/UNC and invalid CLI',()=>temp(async dir=>{const s=emptyState();assert.throws(()=>importDocument('o/r','# GitHub triage rules: x/y',s));assert.throws(()=>importDocument('o/r','# GitHub triage rules: o/r\n'+'x'.repeat(17000),s));await assert.rejects(exportDocument('\\\\host\\share\\rules.md','x'));for(const args of ['','export o/r','export o/r "'+path.join(dir,'r')+'" --bad','import o/r "'+path.join(dir,'r')+'" --force'])await assert.rejects(rulesCommand(args,s,[repo],safe));await writeFile(path.join(dir,'bad.md'),Buffer.from([255]));await assert.rejects(rulesCommand('import o/r "'+path.join(dir,'bad.md')+'"',s,[repo],safe))}))
test('large rules bounded by UTF8 and beyond-prefix external changes still invalidate',()=>temp(async dir=>{const file=path.join(dir,'rules.md'),s=emptyState();await writeFile(file,'文'.repeat(5000)+'A');const a=await loadRules({...repo,rulesFile:file},s,'业务',safe);assert.ok(Buffer.byteLength(a.text)<=8192);await writeFile(file,'文'.repeat(5000)+'B');const b=await loadRules({...repo,rulesFile:file},s,'业务',safe);assert.notEqual(a.fingerprint,b.fingerprint);assert.match(b.status,/截断/)}))

test('local comparison leaves all repository files and Git metadata byte-for-byte unchanged',()=>temp(async dir=>{await repository(dir);const snapshot=async root=>{const out={};const visit=async folder=>{for(const row of await readdir(folder,{withFileTypes:true})){const file=path.join(folder,row.name);if(row.isDirectory())await visit(file);else if(row.isFile())out[path.relative(root,file)]=createHash('sha256').update(await readFile(file)).digest('hex')}};await visit(root);return out};const before=await snapshot(dir);await localEvidence(await openLocal({...repo,localRepoPath:dir}),pr());assert.deepEqual(await snapshot(dir),before)}))
test('forced export rejects directories and hard links without altering the existing file',()=>temp(async dir=>{await assert.rejects(exportDocument(dir,'bad',true));const original=path.join(dir,'original.md'),alias=path.join(dir,'alias.md');await writeFile(original,'keep');await link(original,alias);await assert.rejects(exportDocument(alias,'bad',true));assert.equal(await readFile(original,'utf8'),'keep')}))
for(const field of ['recommendation','localApplicability'])test('model refuses invalid unified enum '+field,()=>assert.throws(()=>parseJudgment(JSON.stringify({...good,[field]:'invalid'}),'issue')))
for(const localApplicability of ['present','already-fixed','not-applicable','unclear'])test('model accepts local applicability '+localApplicability,()=>assert.equal(parseJudgment(JSON.stringify({...good,localApplicability}),'issue').localApplicability,localApplicability))
test('renamed/added/deleted/binary or partial diffs cannot claim stable patch equivalence',()=>{for(const status of ['renamed','added','removed'])assert.equal(completePatch(pr({changedFiles:1,files:[{path:'a.ts',status,patch:'@@ -1 +1 @@\n-old\n+new',additions:1,deletions:1}]})),undefined)})
test('full mode respects disabled repository capabilities without fetching other kinds',async()=>{
  for(const [mode,meta,kind] of [['both',{has_issues:false},'pr'],['both',{has_pull_requests:false},'issue'],['issues',{has_issues:false},undefined],['prs',{has_pull_requests:false},undefined],['both',{has_issues:false,has_pull_requests:false},undefined]]){
    const queries=[]
    const c=new Github({env:{},gh:async()=>'',fetch:async url=>{
      if(url.endsWith('/repos/o/r'))return response(meta)
      const q=new URL(url).searchParams.get('q');assert.match(q,/\bis:(?:issue|pr)\b/);queries.push(q)
      return response({items:[],total_count:0})
    }})
    assert.deepEqual(await c.list('o/r',mode,100,undefined,{full:true}),[])
    assert.deepEqual(queries,kind?['repo:o/r is:'+kind]:[])
  }
})
test('full search PR without head can be enriched consistently from the detail endpoint',async()=>{const c=new Github({env:{},gh:async()=>'',fetch:async url=>url.includes('/files?')?response([]):url.includes('/status?')?response({statuses:[]}):url.includes('/check-runs?')?response({total_count:0,check_runs:[]}):response({...wire(2),head:{sha:'a'.repeat(40)},changed_files:0})});const result=await c.enrich('o/r',{...pr(),head:undefined,updated_at:'2026-11-11'});assert.equal(result.head,'a'.repeat(40))})

test('local path must be the chosen repository root rather than inheriting a parent repo',()=>temp(async dir=>{await repository(dir);await mkdir(path.join(dir,'child'));assert.equal((await openLocal({...repo,localRepoPath:path.join(dir,'child')})).sha,undefined)}))

test('imported editable document retains text beyond prompt budget while newest corrections come first',async()=>{const s=emptyState(),text='# GitHub triage rules: o/r\n\n'+('manual rule\n'.repeat(900))+'TAIL EDIT';importDocument('o/r',text,s);assert.match(rulesDocument('o/r',s),/TAIL EDIT/);await run(source([issue()]),repo,s,options);correct(s,'o/r#1 manual-review 最新人工规则',99);const doc=rulesDocument('o/r',s);assert.match(doc,/TAIL EDIT/);assert.ok(doc.indexOf('最新人工规则')<doc.indexOf('manual rule'));const loaded=await loadRules(repo,s,'',safe);assert.ok(Buffer.byteLength(loaded.text)<=8192);assert.match(loaded.status,/截断/)})
