import test from 'node:test'
import assert from 'node:assert/strict'
import { Github, GithubError } from '../lib/github.js'
const response=(body,status=200,headers={})=>({ok:status>=200&&status<300,status,headers:{get:k=>headers[k]??null},json:async()=>body})
const env={},gh=async()=>''
test('client refuses every non-GET method before auth/network',async()=>{let calls=0;const client=new Github({env,gh:async()=>{calls++;return ''},fetch:async()=>{calls++;return response({})}});for(const method of ['POST','PUT','PATCH','DELETE','HEAD','get'])await assert.rejects(client.request('/repos/o/r',method),/非 GET/);assert.equal(calls,0)})
test('GraphQL mutation, mixed operations and direct bypass are refused',async()=>{let calls=0;const client=new Github({env,gh,fetch:async()=>{calls++;return response({})}});for(const q of ['mutation { addComment { id } }','query Q { viewer {login} } mutation X { x }','{ viewer {login}}','subscription { x }','query A {x} query B {y}'])await assert.rejects(client.graphql(q),/query/);await assert.rejects(client.request('/graphql?query='+encodeURIComponent('mutation {x}')),/query/);assert.equal(calls,0);await client.graphql('query Q { viewer { login } }');assert.equal(calls,1)})
test('fixed GitHub origin rejects attacker hosts and redirects',async()=>{let calls=0;const c=new Github({env,gh,fetch:async(url,init)=>{calls++;assert.equal(new URL(url).host,'api.github.com');assert.equal(init.redirect,'error');return response({})}});for(const p of ['https://evil.test/x','//evil.test/x','/repos/o/r#x','/repos/o/r\\x'])await assert.rejects(c.request(p));assert.equal(calls,0);await c.request('/repos/o/r');assert.equal(calls,1)})

test('URL repository list and enrichment request only canonical fixed-origin paths',async()=>{
  const urls=[]
  const c=new Github({env,gh,fetch:async(url,init)=>{
    urls.push(url);assert.equal(init.method,'GET');assert.equal(init.headers['User-Agent'],'dsh-github-triage/0.4.4')
    if(url.endsWith('/repos/o/r'))return response({default_branch:'main',has_issues:true})
    if(url.includes('/git/trees/'))return response({tree:[]})
    return response({items:[]})
  }})
  await c.list(' https://www.github.com/O/R.git/issues?state=open#intro ','issues',1)
  await c.enrich('git@github.com:O/R.git',{kind:'issue',title:'render fails',number:1})
  assert.ok(urls.includes('https://api.github.com/repos/o/r'))
  assert.ok(urls.some(u=>u.includes('/repos/o/r/git/trees/main')))
  assert.ok(urls.every(u=>{const parsed=new URL(u);return parsed.origin==='https://api.github.com'&&!parsed.pathname.includes('.git')}))
  const count=urls.length
  await assert.rejects(c.list('https://user:fixture-secret@github.com/O/R','issues',1))
  assert.equal(urls.length,count)
})
test('token precedence GH_TOKEN then GITHUB_TOKEN then gh, never output',async()=>{for(const [vars,expected] of [[{GH_TOKEN:'first-fixture',GITHUB_TOKEN:'second-fixture'},'first-fixture'],[{GITHUB_TOKEN:'second-fixture'},'second-fixture'],[{},'gh-fixture']]){let auth,ghCalls=0;const c=new Github({env:vars,gh:async()=>{ghCalls++;return 'gh-fixture'},fetch:async(_,i)=>{auth=i.headers.Authorization;assert.equal(i.method,'GET');return response({text:expected})}});const data=await c.request('/repos/o/r');assert.equal(auth,'Bearer '+expected);assert.ok(!JSON.stringify(data).includes(expected));assert.equal(ghCalls,Object.keys(vars).length?0:1);assert.ok(!JSON.stringify(c).includes(expected));assert.ok(!c.warnings.join().includes(expected));}})
test('anonymous auth warns without leaking details',async()=>{let headers;const c=new Github({env,gh,fetch:async(_,i)=>{headers=i.headers;return response({})}});await c.request('/repos/o/r');assert.equal(headers.Authorization,undefined);assert.match(c.warnings.join(),/匿名/);assert.equal(c.warnings.length,1)})
test('403 and 429 cooldown respects retry headers and suppresses repeated requests',async()=>{for(const status of [403,429]){let calls=0;const c=new Github({env,gh,now:()=>1000,fetch:async()=>{calls++;return response({},status,{'retry-after':'120','x-ratelimit-reset':'200'})}});await assert.rejects(c.request('/repos/o/r'),e=>e instanceof GithubError&&e.retryAt===200000);await assert.rejects(c.request('/repos/o/r'));assert.equal(calls,1)}})
test('network errors never echo token or server response text',async()=>{const secret='fake-error-secret';const c=new Github({env:{GH_TOKEN:secret},fetch:async()=>{throw new Error(secret)}});await assert.rejects(c.request('/repos/o/r'),e=>!String(e).includes(secret))})
test('cancelled requests stop at boundary',async()=>{let calls=0;const signal=AbortSignal.abort();const c=new Github({env,gh,fetch:async()=>{calls++;return response({})}});await assert.rejects(c.request('/repos/o/r','GET',signal));assert.equal(calls,0)})
test('request timeout is passed to fetch and aborts',async()=>{const c=new Github({env,gh,timeoutMs:5,fetch:(_,i)=>new Promise((resolve,reject)=>{const hold=setTimeout(()=>resolve(response({})),100);i.signal.addEventListener('abort',()=>{clearTimeout(hold);reject(new Error('aborted'))},{once:true})})});await assert.rejects(c.request('/repos/o/r'),GithubError)})
const issueWire=(n)=>({number:n,title:'renderer broken',body:'steps',updated_at:'2026-11-11',html_url:'https://github.com/o/r/issues/'+n})
test('list fetches only bounded recent open items with explicit GET',async()=>{const urls=[];const c=new Github({env,gh,fetch:async(url,i)=>{urls.push(url);assert.equal(i.method,'GET');if(url.endsWith('/repos/o/r'))return response({has_issues:true,has_pull_requests:true});if(url.includes('/search/issues'))return response({items:[issueWire(1)]});return response([{...issueWire(2),head:{sha:'abc'}}])}});const result=await c.list('o/r','both',1);assert.equal(result.length,1);assert.equal(urls[0],'https://api.github.com/repos/o/r');assert.ok(urls.slice(1).every(u=>u.includes('per_page=1')));assert.match(urls[1],/sort=updated/);await assert.rejects(c.list('o/r','both',101))})
test('PR detail files checks links all remain GET and file pagination is capped',async()=>{const urls=[],pr={...issueWire(5),body:'Fixes #8\nResolves https://github.com/other/repo/issues/2',head:{sha:'abc'},changed_files:350,additions:500,deletions:2};const c=new Github({env,gh,maxPages:2,fetch:async(url,i)=>{urls.push(url);assert.equal(i.method,'GET');if(url.includes('/files?'))return response(Array.from({length:100},(_,i)=>({filename:'src/f'+i+'.ts',additions:1,deletions:0})));if(url.includes('/check-runs'))return response({total_count:1,check_runs:[{name:'build',status:'completed',conclusion:'failure'}]});if(url.includes('/status?'))return response({statuses:[]});if(url.endsWith('/issues/8'))return response(issueWire(8));return response(pr)}});const enriched=await c.enrich('o/r',{number:5,kind:'pr',head:'abc',updated_at:pr.updated_at,title:pr.title,body:pr.body});assert.equal(enriched.files.length,200);assert.equal(urls.filter(u=>u.includes('/files?')).length,2);assert.ok(enriched.notes.some(n=>n.includes('分页上限')));assert.deepEqual(enriched.linked.map(i=>i.number),[8]);assert.equal(enriched.ci[0].state,'fail');assert.ok(!urls.some(u=>u.includes('/issues/2')))})
test('changed PR head is not cached with stale facts',async()=>{const c=new Github({env,gh,fetch:async()=>response({...issueWire(1),head:{sha:'new'}})});await assert.rejects(c.enrich('o/r',{kind:'pr',number:1,head:'old',updated_at:'2026-11-11'}),/更新/)})
test('issue keyword tree location, otherwise explicitly unlocated',async()=>{let calls=0;const c=new Github({env,gh,fetch:async(url)=>{calls++;return url.includes('/git/trees/')?response({tree:[{path:'src/renderer.ts',type:'blob'},{path:'docs/other.md',type:'blob'}],truncated:false}):response({default_branch:'main'})}});const a=await c.enrich('o/r',{kind:'issue',title:'renderer crashes',number:1});assert.deepEqual(a.locations,['src/renderer.ts']);const b=await c.enrich('o/r',{kind:'issue',title:'zzzzzz missing',number:2});assert.deepEqual(b.locations,[]);assert.equal(calls,3)})


for(const mode of ['issues','prs','both'])for(const [has_issues,has_pull_requests] of [[false,false],[false,true],[true,false],[undefined,undefined]]){
  test('repository capabilities '+mode+' '+has_issues+'/'+has_pull_requests,async()=>{
    const urls=[]
    const client=new Github({env,gh,fetch:async(url,init)=>{
      assert.equal(init.method,'GET');urls.push(new URL(url).pathname)
      if(url.endsWith('/repos/o/r'))return response({has_issues,has_pull_requests})
      if(url.includes('/search/issues')){assert.notEqual(has_issues,false);return response({items:[issueWire(1)]})}
      assert.notEqual(has_pull_requests,false)
      return response([{...issueWire(2),head:{sha:'abc'}}])
    }})
    const items=await client.list('O/R',mode,5)
    const issuesEnabled=mode!=='prs'&&has_issues!==false,prsEnabled=mode!=='issues'&&has_pull_requests!==false
    assert.deepEqual(urls,['/repos/o/r',...(issuesEnabled?['/search/issues']:[]),...(prsEnabled?['/repos/o/r/pulls']:[])])
    assert.equal(items.filter(i=>i.kind==='issue').length,Number(issuesEnabled))
    assert.equal(items.filter(i=>i.kind==='pr').length,Number(prsEnabled))
    const disabledIssues=mode!=='prs'&&has_issues===false,disabledPrs=mode!=='issues'&&has_pull_requests===false
    const notices=client.warnings.filter(w=>w.startsWith('该仓库已关闭 '))
    assert.deepEqual(notices,disabledIssues||disabledPrs?['该仓库已关闭 '+(disabledIssues&&disabledPrs?'issues / PR':disabledIssues?'issues':'PR')+' 功能；已跳过对应拉取。']:[])
  })
}
test('metadata errors are not mistaken for disabled features',async()=>{
  const urls=[]
  const client=new Github({env,gh,fetch:async url=>{urls.push(url);return response({},404)}})
  await assert.rejects(client.list('o/r','both',5),e=>e instanceof GithubError&&e.status===404)
  assert.deepEqual(urls,['https://api.github.com/repos/o/r'])
  assert.ok(!client.warnings.some(w=>w.includes('已关闭')))
})
test('capabilities refresh on each run and warnings do not leak across repositories',async()=>{
  let disabled=true
  const client=new Github({env,gh,fetch:async url=>url.includes('/search/issues')?response({items:[]}):url.includes('/pulls?')?response([]):response({has_issues:!disabled,has_pull_requests:!disabled})})
  await client.list('o/r','both',5);await client.list('o/r','both',5)
  assert.equal(client.warnings.filter(w=>w.includes('已关闭')).length,1)
  disabled=false
  await client.list('o/r','both',5)
  assert.ok(!client.warnings.some(w=>w.includes('已关闭')))
  disabled=true;await client.list('o/r','both',5)
  disabled=false;await client.list('other/repo','both',5)
  assert.ok(!client.warnings.some(w=>w.includes('已关闭')))
  assert.equal(client.warnings.filter(w=>w.includes('匿名')).length,1)
})
test('disabled Issues also skips linked issue enrichment while retaining PR evidence',async()=>{
  const urls=[],pr={...issueWire(5),body:'Fixes #8',head:{sha:'abc'},changed_files:0}
  const client=new Github({env,gh,fetch:async url=>{
    urls.push(url)
    if(url.endsWith('/repos/o/r'))return response({has_issues:false,has_pull_requests:true})
    if(url.includes('/pulls?'))return response([pr])
    if(url.endsWith('/pulls/5'))return response(pr)
    if(url.includes('/files?'))return response([])
    if(url.includes('/status?'))return response({statuses:[]})
    if(url.includes('/check-runs?'))return response({total_count:0,check_runs:[]})
    assert.fail('unexpected endpoint')
  }})
  const [item]=await client.list('o/r','both',5)
  const result=await client.enrich('o/r',item)
  assert.deepEqual(result.linked,[])
  assert.ok(result.notes.some(w=>w.includes('已关闭 issues 功能')))
  assert.ok(!urls.some(u=>u.includes('/issues/8')))
})

const contentWire=text=>({type:'file',size:Buffer.byteLength(text),encoding:'base64',content:Buffer.from(text).toString('base64')})
test('contents reads encoded relative path from default branch only by GET',async()=>{const seen=[];const c=new Github({env,gh,fetch:async(url,init)=>{seen.push(url);assert.equal(init.method,'GET');return response(contentWire('核心业务'))}});assert.equal(await c.contents('O/R','docs/business notes.md',16384),'核心业务');assert.equal(seen[0],'https://api.github.com/repos/o/r/contents/docs/business%20notes.md');assert.ok(!seen[0].includes('ref='))})
for(const file of ['/etc/passwd','../x','docs/../secret','docs//file','docs\\file',''])test('contents rejects unsafe repo path '+file,async()=>{let calls=0;const c=new Github({env,gh,fetch:async()=>{calls++;return response({})}});await assert.rejects(c.contents('o/r',file,16384));assert.equal(calls,0)})
for(const [label,wire] of [['directory',[]],['symlink',{...contentWire('text'),type:'symlink'}],['oversized',{...contentWire('x'),size:16385}],['lying size',{...contentWire('x'.repeat(16385)),size:1}],['binary',contentWire('a\0b')],['bad encoding',{...contentWire('text'),encoding:'none'}]])test('contents rejects '+label,async()=>{const c=new Github({env,gh,fetch:async()=>response(wire)});await assert.rejects(c.contents('o/r','business.md',16384))})
test('issue stack paths and keywords fetch at most three bounded textual snippets',async()=>{const seen=[],files=['src/renderer0.ts','src/renderer1.ts','src/renderer2.ts','src/renderer3.ts','src/stack.ts'];const c=new Github({env,gh,fetch:async(url,init)=>{assert.equal(init.method,'GET');seen.push(new URL(url).pathname);if(url.includes('/contents/'))return response(contentWire('代码'.repeat(3000)));if(url.includes('/git/trees/'))return response({tree:files.map(path=>({path,type:'blob'})),truncated:false});return response({default_branch:'main'})}});const r=await c.enrich('o/r',{kind:'issue',title:'renderer failure',body:'at fn (/workspace/src/stack.ts:12:4)',number:1});assert.equal(r.locations[0],'src/stack.ts');assert.equal(r.snippets.length,3);assert.equal(seen.filter(p=>p.includes('/contents/')).length,3);assert.ok(r.snippets.every(s=>Buffer.byteLength(s.text)<=3072&&s.truncated));assert.match(r.snippets[0].text,/已截断/)})
test('PR reads at most three related default-branch files and preserves patch',async()=>{const seen=[],pr={...issueWire(1),body:'fix',head:{sha:'abc'},changed_files:5};const c=new Github({env,gh,fetch:async(url,init)=>{assert.equal(init.method,'GET');seen.push(url);if(url.includes('/contents/'))return response(contentWire('related code'));if(url.includes('/files?'))return response(Array.from({length:5},(_,i)=>({filename:'src/file'+i+'.ts',additions:1,deletions:0,patch:'+new code'})));if(url.includes('/status?'))return response({statuses:[]});if(url.includes('/check-runs?'))return response({total_count:0,check_runs:[]});return response(pr)}});const r=await c.enrich('o/r',{kind:'pr',head:'abc',number:1,updated_at:pr.updated_at,title:'fix',body:'fix'});assert.equal(r.snippets.length,3);assert.match(r.files[0].patch,/new code/);assert.ok(seen.filter(u=>u.includes('/contents/')).every(u=>!u.includes('ref=')))})
test('large related files are skipped with explicit evidence, not delivered to model',async()=>{const c=new Github({env,gh,fetch:async url=>url.includes('/contents/')?response({...contentWire('x'),size:65537}):url.includes('/git/trees/')?response({tree:[{path:'src/renderer.ts',type:'blob'}]}):response({default_branch:'main'})});const r=await c.enrich('o/r',{kind:'issue',number:1,title:'renderer failure',body:''});assert.deepEqual(r.snippets,[]);assert.match(r.notes.join(),/超过 64KB/)})
test('contents never follows a returned download URL or echoes token',async()=>{const secret='contentsFixtureSecret',seen=[];const c=new Github({env:{GH_TOKEN:secret},fetch:async(url)=>{seen.push(url);return response({...contentWire(secret),download_url:'https://evil.example/file'})}});assert.equal(await c.contents('o/r','business.md',16384),'[REDACTED]');assert.equal(seen.length,1);assert.equal(new URL(seen[0]).host,'api.github.com')})

test('contents rejects invalid UTF8 business and code text',async()=>{const bytes=Buffer.from([0xff,0xfe]);const c=new Github({env,gh,fetch:async()=>response({type:'file',size:bytes.length,encoding:'base64',content:bytes.toString('base64')})});await assert.rejects(c.contents('o/r','business.md',16384))})

for(const scenario of ['incremental','full issues','full prs','full both','merged fix PR'])test('every search query has an explicit issue/PR type: '+scenario,async()=>{
  const queries=[]
  const c=new Github({env,gh,fetch:async url=>{
    const u=new URL(url)
    if(u.pathname==='/search/issues'){
      const q=u.searchParams.get('q');queries.push(q);assert.match(q,/\bis:(?:issue|pr)\b/)
      return response({items:[],total_count:0})
    }
    if(u.pathname==='/repos/o/r')return response({})
    assert.equal(u.pathname,'/repos/o/r/pulls');return response([])
  }})
  if(scenario==='merged fix PR')await c.localDetails('o/r',{number:42,kind:'issue',notes:[]})
  else await c.list('o/r',scenario.startsWith('full ')?scenario.slice(5):'both',10,undefined,{full:scenario.startsWith('full ')})
  const expected=scenario==='incremental'?['repo:o/r is:issue is:open']:scenario==='merged fix PR'?['repo:o/r is:pr is:merged "#42"']:scenario==='full both'?['repo:o/r is:issue','repo:o/r is:pr']:['repo:o/r is:'+(scenario==='full issues'?'issue':'pr')]
  assert.deepEqual(queries,expected)
})
test('HTTP failures retain named status codes in the user-visible message', () => {
  for (const status of [403, 429, 503]) {
    const error = new GithubError(status)
    assert.equal(error.code, 'HTTP_' + status)
    assert.match(error.message, new RegExp('HTTP ' + status))
  }
})

test('GitHub network timeout defaults to 30s and honors clamped timeoutSeconds', async () => {
  const original=AbortSignal.timeout,seen=[]
  AbortSignal.timeout=ms=>{seen.push(ms);return original(ms)}
  try{
    for(const timeoutSeconds of [undefined,45,2,200,NaN]){
      const client=new Github({env:{},gh:async()=>'',network:{timeoutSeconds},fetch:async()=>({ok:true,status:200,headers:new Headers(),json:async()=>({})})})
      try{await client.request('/repos/o/r')}finally{await client.close()}
    }
    assert.deepEqual(seen,[30000,45000,10000,120000,30000])
  }finally{AbortSignal.timeout=original}
})
