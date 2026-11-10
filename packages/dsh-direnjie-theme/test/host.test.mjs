import {test} from 'node:test'
import assert from 'node:assert/strict'
import {Context} from '@deepseek-ai/cordis'
import {apply,Config} from '../index.js'
import vm from 'node:vm'
test('real Cordis scope owns injection and route disposal',async()=>{
 const root=new Context();const routes=new Map()
 root.provide('webServer',{register:route=>{routes.set(route.path,route);return ()=>routes.delete(route.path)}})
 const fork=root.plugin({apply},Config({musicPath:'C:\\Music\\private-name.mp3'}))
 await new Promise(r=>setTimeout(r,10))
 const table=[];root.emit('webserver/index-inject',table)
 assert.equal(routes.size,1);assert.equal(table.length,1)
 assert.ok(!table[0].text.includes('private-name'))
 const sandbox={window:{}};vm.runInNewContext(table[0].text,sandbox)
 assert.ok(routes.has(sandbox.window.__DSH_DIRENJIE__.musicUrl))
 await fork.dispose();assert.equal(routes.size,0)
 const after=[];root.emit('webserver/index-inject',after);assert.equal(after.length,0)

})
