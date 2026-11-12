import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readWindowsProxy, evaluatePac, parsePacResult, createSystemProxy, fetchPacDirect } from '../lib/system-proxy.js'
import { createIntranetHttp, effectiveTimeout, fetchOfficial, intranetConfig } from '../lib/intranet-http.js'
const url = 'https://projects.apache.org/json/foundation/chooser.json'
const pac = result => `function FindProxyForURL(url, host) { return ${JSON.stringify(result)}; }`
const deps = { readSettings: async () => ({}), resolve: async () => '10.1.2.3' }

test('mock Windows registry: ProxyEnable=0 with PAC, static map and overrides; Linux never queries', async () => {
  const s = await readWindowsProxy({ platform: 'win32', query: async () => '\n AutoConfigURL    REG_SZ    https://pac.example/a\n ProxyEnable    REG_DWORD    0x0\n ProxyServer    REG_SZ    http=proxy:8080;https=secure:8080\n ProxyOverride    REG_SZ    <local>;*.corp.example\n' })
  assert.deepEqual(s,{AutoConfigURL:'https://pac.example/a',ProxyEnable:0,ProxyServer:'http=proxy:8080;https=secure:8080',ProxyOverride:'<local>;*.corp.example'})
  assert.deepEqual(await readWindowsProxy({platform:'linux',query:()=>assert.fail('must not query')}),{})
})

test('PAC order: first usable HTTP proxy or DIRECT, SOCKS warning, credentials and query redacted', async () => {
  assert.deepEqual(parsePacResult('SOCKS5 socks:1080; PROXY host:8080; DIRECT'),{proxy:'http://host:8080/'})
  assert.deepEqual(parsePacResult('DIRECT; PROXY host:8080'),{})
  assert.deepEqual(parsePacResult('HTTPS host:8443'),{proxy:'https://host:8443/'})
  assert.match(parsePacResult('SOCKS socks:1080').warning,/不支持 SOCKS/)
  for(const v of ['bad','PROXY invalid','PROXY host:99999']) assert.throws(()=>parsePacResult(v))
  const d=createSystemProxy({...deps,readSettings:async()=>({AutoConfigURL:'https://pac.example/a?secret=hide'}),fetchPac:async()=>pac('PROXY user:password@host:8080')})
  const r=await d.detect(url);assert.equal(r.proxy,'http://user:password@host:8080/');assert.equal(r.info.proxy,'http://host:8080/');assert.equal(r.info.pacUrl,'https://pac.example/a')
  assert.doesNotMatch(JSON.stringify(r.info),/user|password|secret|hide/)
})

test('Netscape helpers: target-only DNS, IPv4, shell pattern and GMT date/weekday/time ranges', async () => {
  const script=`function FindProxyForURL(u,h){
    if(!isPlainHostName('local')||!dnsDomainIs(h,'.apache.org')||!localHostOrDomainIs('www','www.example')||dnsDomainLevels(h)!==2||!shExpMatch(h,'*.apache.?rg'))throw 'host';
    if(dnsResolve(h)!=='10.1.2.3'||!isResolvable(h)||isResolvable('other')||dnsResolve('other')!==null||!isInNet(h,'10.0.0.0','255.0.0.0')||isInNet('other','10.0.0.0','255.0.0.0'))throw 'dns';
    if(!/^[0-9.]+$/.test(myIpAddress())||!weekdayRange('THU','GMT')||!weekdayRange('MON','FRI','GMT')||!dateRange(12,'NOV',2026,12,'NOV',2026,'GMT')||!dateRange('NOV',2026,'NOV',2026,'GMT')||!dateRange(12,'NOV',12,'NOV','GMT')||!dateRange('NOV','GMT')||!dateRange(2026,'GMT')||!timeRange(6,7,'GMT')||!timeRange(6,0,7,0,'GMT')||!timeRange(6,0,0,7,0,0,'GMT')||!timeRange(6,'GMT'))throw 'clock';return 'DIRECT';}`
  assert.deepEqual(await evaluatePac(script,url,{...deps,now:()=>Date.parse('2026-11-12T06:30:00Z')}),{})
})

test('vm has no host objects, blocks dynamic code, bounds script/call/output coercion and size', async () => {
  await evaluatePac("function FindProxyForURL(){if(typeof process!=='undefined'||typeof require!=='undefined'||typeof setTimeout!=='undefined'||typeof fetch!=='undefined')throw 'host';return 'DIRECT'}",url,deps)
  for(const s of ["Function('return process')()",'while(true){}','function FindProxyForURL(){while(true){}}','function FindProxyForURL(){return {toString(){while(true){}}}}']) await assert.rejects(evaluatePac(s,url,deps))
  await assert.rejects(evaluatePac('x'.repeat(1024*1024+1),url,deps),/1 MiB/)
})

test('PAC direct fetch caps size/status, rejects file and credentials without global fetch', async t => {
  const server=createServer((req,res)=>{if(req.url==='/big')res.end('x'.repeat(1024*1024+1));else if(req.url==='/redirect'){res.writeHead(302,{location:'/ok'});res.end()}else res.end(pac('DIRECT'))})
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)))
  const base='http://127.0.0.1:'+server.address().port
  assert.match(await fetchPacDirect(base+'/ok'),/FindProxyForURL/)
  await assert.rejects(fetchPacDirect(base+'/big'),/1 MiB/);await assert.rejects(fetchPacDirect(base+'/redirect'),/获取失败/)
  for(const input of ['file:///tmp/proxy.pac','http://user:password@host/pac'])assert.throws(()=>fetchPacDirect(input),/HTTP/)
})

test('static system proxy honors per-protocol map, ProxyOverride and <local>', async () => {
  const d=createSystemProxy({readSettings:async()=>({ProxyEnable:1,ProxyServer:'http=plain:8080;https=secure:8080',ProxyOverride:'<local>;*.corp.example'})})
  assert.equal((await d.detect(url)).proxy,'http://secure:8080/');assert.equal((await d.detect('http://external.example/')).proxy,'http://plain:8080/')
  for(const u of ['https://printer/','https://api.corp.example/'])assert.equal((await d.detect(u)).proxy,undefined)
})

test('memory TTL caches script/settings, per-host decisions differ, manual clear re-reads', async () => {
  let reads=0,fetches=0,now=1_000_000
  const d=createSystemProxy({...deps,now:()=>now,readSettings:async()=>{reads++;return {AutoConfigURL:'http://pac.example/a'}},fetchPac:async()=>{fetches++;return "function FindProxyForURL(u,h){return h==='projects.apache.org'?'PROXY host:8080':'DIRECT'}"}})
  assert.ok((await d.detect(url)).proxy);assert.equal((await d.detect('https://other.example/')).proxy,undefined)
  assert.equal(reads,1);assert.equal(fetches,1);now+=30*60*1000;await d.detect(url);assert.equal(reads,2)
  await d.clear();await d.detect(url);assert.equal(fetches,3)
})

test('optional local cache reuses fresh static settings without persisting credentials', async t => {
  const dir=await mkdtemp(join(tmpdir(),'dsh-pac-'));t.after(()=>rm(dir,{recursive:true,force:true}))
  const d=createSystemProxy({cacheDirectory:dir,readSettings:async()=>({ProxyEnable:1,ProxyServer:'proxy:8080'})})
  await d.detect(url);assert.match(await readFile(join(dir,'system-proxy-cache.json'),'utf8'),/proxy:8080/)
  assert.equal((await createSystemProxy({cacheDirectory:dir,readSettings:async()=>assert.fail('cached')}).detect(url)).proxy,'http://proxy:8080/')
  await d.clear();await createSystemProxy({cacheDirectory:dir,readSettings:async()=>({ProxyEnable:1,ProxyServer:'user:password@proxy:8080'})}).detect(url)
  assert.doesNotMatch(await readFile(join(dir,'system-proxy-cache.json'),'utf8'),/user|password/)
})

async function capture(settings,injected,env,run){
  const saved=globalThis.fetch,calls=[],client=createIntranetHttp(settings,env,injected)
  globalThis.fetch=async(input,init)=>{calls.push({input,init});return new Response('ok')}
  try{await run(client,calls)}finally{globalThis.fetch=saved;await client.close()}
}

test('explicit proxy unchanged and PAC never invoked, including mixed-case environment', async () => {
  for(const [s,e] of [[{httpsProxy:'http://proxy:8080'},{}],[{},{HTTPS_PROXY:'http://proxy:8080'}],[{},{http_proxy:'http://proxy:8080'}],[{},{ALL_PROXY:'http://proxy:8080'}],[{},{Https_Proxy:'http://proxy:8080'}]])
    await capture(s,{readSettings:()=>assert.fail('PAC must never run')},e,async(c,calls)=>{await c.fetch(url);assert.ok(calls[0].init.dispatcher);assert.match((await c.detectProxy()).note,/未运行系统检测/)})
})

test('no PAC, DIRECT, registry/fetch/parse failure and off preserve original options identity', async () => {
  const cases=[[{},deps],[{systemProxy:'off'},{readSettings:()=>assert.fail('off')}],[{},{readSettings:async()=>{throw Error('registry')}}],[{},{readSettings:async()=>({AutoConfigURL:'http://pac.example/a'}),fetchPac:async()=>{throw Error('fetch')}}],[{},{...deps,readSettings:async()=>({AutoConfigURL:'http://pac.example/a'}),fetchPac:async()=>'invalid('}],[{},{...deps,readSettings:async()=>({AutoConfigURL:'http://pac.example/a'}),fetchPac:async()=>pac('DIRECT')}]]
  for(const [s,d] of cases)await capture(s,d,{},async(c,calls)=>{const init={headers:{Accept:'text/plain'},credentials:'omit'};await c.fetch(url,init);assert.equal(calls[0].input,url);assert.equal(calls[0].init,init)})
})

test('PAC PROXY adds request dispatcher and auto-use note; DIRECT host stays unchanged', async () => {
  await capture({},{...deps,readSettings:async()=>({AutoConfigURL:'http://pac.example/a'}),fetchPac:async()=>"function FindProxyForURL(u,h){return h==='projects.apache.org'?'PROXY host:8080':'DIRECT'}"},{},async(c,calls)=>{
    const init={method:'GET'};await c.fetch(url,init);assert.ok(calls[0].init.dispatcher);assert.equal(c.proxyStatus().automatic,true)
    await c.fetch('https://other.example/',init);assert.equal(calls[1].init,init)
  })
})

test('effective timeout: default 30000ms, configurable, clamp 10–120s, invalid default', () => {
  assert.equal(effectiveTimeout(),30000)
  assert.equal(intranetConfig.timeoutSeconds('bad'),30);assert.equal(intranetConfig.timeoutSeconds({}),30)
  for(const [v,e] of [[45,45000],[1,10000],[999,120000],[NaN,30000],[Infinity,30000],['45',30000],[null,30000]])assert.equal(effectiveTimeout({timeoutSeconds:v}),e)
})

test('safe redirects follow whitelisted HTTPS, omit credentials, retain signal', async () => {
  const calls=[],signal=AbortSignal.timeout(30000)
  const r=await fetchOfficial(async(u,i)=>{calls.push([u,i]);return calls.length===1?new Response(null,{status:302,headers:{Location:'https://cwiki.apache.org/new'}}):new Response('ok')},url,{signal},new Set(['projects.apache.org','cwiki.apache.org']))
  assert.equal(await r.text(),'ok');assert.equal(calls[1][0],'https://cwiki.apache.org/new')
  for(const [,i] of calls){assert.equal(i.redirect,'manual');assert.equal(i.credentials,'omit');assert.equal(i.signal,signal)}
})

test('safe redirects reject off-list, HTTP, userinfo, IP, missing location, loops and sixth hop', async () => {
  const hosts=new Set(['projects.apache.org','cwiki.apache.org','127.0.0.1'])
  for(const location of ['https://evil.example/a','http://cwiki.apache.org/a','https://user:secret@cwiki.apache.org/a','https://127.0.0.1/a','']){
    let calls=0;await assert.rejects(fetchOfficial(async()=>{calls++;return new Response(null,{status:302,headers:{Location:location}})},url,{},hosts),/REDIRECT_BLOCKED.*重定向/);assert.equal(calls,1)
  }
  await assert.rejects(fetchOfficial(async()=>new Response(null,{status:302,headers:{Location:url}}),url,{},hosts),/REDIRECT_LOOP/)
  let calls=0;await assert.rejects(fetchOfficial(async()=>new Response(null,{status:302,headers:{Location:'/hop'+(++calls)}}),url,{},hosts),/REDIRECT_LIMIT/);assert.equal(calls,6)
})


test('automatic proxy transport failure retries original path; explicit proxy errors never retry', async () => {
  const saved=globalThis.fetch
  const init={method:'GET'}
  let calls=0
  const c=createIntranetHttp({}, {}, {...deps,readSettings:async()=>({AutoConfigURL:'http://pac.example/a'}),fetchPac:async()=>pac('PROXY host:8080')})
  try {
    globalThis.fetch=async(_u,i)=>{calls++;if(i?.dispatcher)throw Error('proxy unavailable');assert.equal(i,init);return new Response('direct success')}
    assert.equal(await (await c.fetch(url,init)).text(),'direct success');assert.equal(calls,2)
    calls=0
    const explicit=createIntranetHttp({httpsProxy:'http://proxy:8080'},{},{readSettings:()=>assert.fail('explicit')})
    try{await assert.rejects(explicit.fetch(url,init));assert.equal(calls,1)}finally{await explicit.close()}
  } finally {globalThis.fetch=saved;await c.close()}
})
