import test from 'node:test'
import assert from 'node:assert/strict'
import {Context} from '@deepseek-ai/cordis'
import {routeHandler,mountRoutes} from '../lib/ui-routes.js'
import {routeActions,routeFor,routePath,decodeValue} from '../lib/ui-contract.js'
const request=(body,method='POST')=>new Request('https://dsh.invalid/api/dsh-github-triage/repos',{method,...method==='POST'?{body:typeof body==='string'?body:JSON.stringify(body)}:{}})
test('POST route returns no-store ok/value envelope and delegates once',async()=>{
  const calls=[],handler=routeHandler('repos',async r=>{calls.push(r);return {ok:true,data:{repo:r.value.repo}}})
  const response=await handler(request({action:'add',value:{repo:'O/R'}}))
  assert.equal(response.headers.get('cache-control'),'no-store')
  assert.deepEqual(await response.json(),{ok:true,value:{repo:'o/r'}});assert.equal(calls.length,1)
})
for(const [body,code] of [['{','bad-json'],['x'.repeat(150001),'too-large'],[{action:'add',value:{repo:'invalid'}},'validation'],[{action:'jobs'},'wrong-route'],[{action:'remove',repo:'o/r',force:true},'validation']]){
  test('route rejects invalid body '+code,async()=>{
    let calls=0;const response=await routeHandler('repos',async()=>{calls++;return {ok:true,data:'unexpected'}})(request(body)),reply=await response.json()
    assert.equal(reply.ok,false);assert.equal(reply.error.code,code);assert.equal(calls,0)
    if(code==='validation')assert.ok(reply.error.fields)
  })
}
test('GET does not invoke the service',async()=>{
  const response=await routeHandler('repos',async()=>{throw Error('must not call')})(request(null,'GET'))
  assert.equal(response.status,405);assert.equal(response.headers.get('allow'),'POST')
})
test('operation field errors survive envelope; internal errors never expose raw exception',async()=>{
  const a=await routeHandler('repos',async()=>({ok:false,error:'路径无效',fields:{localRepoPath:'不存在'}}))(request({action:'remove',repo:'o/r'}))
  assert.deepEqual((await a.json()).error,{code:'operation',message:'路径无效',fields:{localRepoPath:'不存在'}})
  const b=await routeHandler('repos',async()=>{throw Error('private internal detail')})(request({action:'remove',repo:'o/r'}))
  assert.ok(!(await b.text()).includes('private internal detail'))
})
test('connection capability mounts every exact POST route and releases on unload',async()=>{
  const ctx=new Context(),routes=new Map()
  ctx.provide('connection',{fetch:{register:route=>{routes.set(route.path,route);return()=>{routes.delete(route.path)}}}})
  const fiber=ctx.plugin({name:'route-fixture',apply:c=>mountRoutes(c,async()=>({ok:true,data:[]}))})
  await fiber
  assert.equal(routes.size,Object.keys(routeActions).length)
  for(const route of routes.values()){assert.deepEqual(route.methods,['POST']);assert.equal(route.requestBody,'buffered');assert.ok(route.path.startsWith('/api/dsh-github-triage/'))}
  await fiber.dispose();assert.equal(routes.size,0);await ctx.fiber.dispose()
})
test('missing fetch capability leaves command-only host functional',async()=>{
  for(const face of [{},undefined]){
    const ctx=new Context();if(face)ctx.provide('connection',face)
    const fiber=ctx.plugin({name:'legacy-fixture',apply:c=>mountRoutes(c,async()=>({ok:true,data:'ok'}))});await fiber;await ctx.fiber.dispose()
  }
})
test('all UI actions have an exact route; decoder rejects malformed snapshots and jobs',()=>{
  for(const actions of Object.values(routeActions))for(const action of actions)assert.ok(routePath(routeFor(action)).startsWith('/api/'))
  assert.throws(()=>decodeValue({action:'snapshot'},{}));assert.throws(()=>decodeValue({action:'jobs'},[{status:'fake'}]))
})
