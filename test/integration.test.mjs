import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import Sessions, { SessionId, Session, appendPluginRecord } from '@deepseek-ai/dsh-session'
import Tools, { defineTool } from '@deepseek-ai/dsh-tools'
import Commands from '@deepseek-ai/dsh-commands'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import * as plugin from '../index.js'
import { segment, boundary } from '../lib/state.js'

async function harness(config={},workspace) {
  const root=await mkdtemp(path.join(os.tmpdir(),'task-review-integration-'))
  const ctx=new Context()
  await ctx.plugin(Sessions)
  await ctx.plugin(Commands)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(Tools)
  if (workspace) ctx.provide('workspaceChanges', workspace)
  const pluginFiber=await ctx.plugin(plugin,config)
  const session=ctx.sessions.create(SessionId('review-test'),{meta:{cwd:root}})
  const agent={id:session.id,session,status:'idle',ctx}
  const user=(value)=>session.append('user/message',createUserMessage({content:[{type:'text',text:value}],source:{kind:'user'}}),{surfaceOp:'append'})
  const run=(name,args={},id=String(Math.random()))=>ctx.tools.execute({callId:id,name,arguments:args,agent,signal:new AbortController().signal})
  const review=()=>ctx.commands.execute(agent,'/review',[],new AbortController().signal)
  ctx.tools.register(defineTool({name:'fixture',description:'test only',parameters:{token:{type:'string'},file_path:{type:'string'}},output:{schema:{type:'string'},render:(_,v)=>[{type:'text',text:v}]},async execute(){return 'ok'}}))
  return {ctx,pluginFiber,root,session,agent,user,run,review,async close(){await ctx.fiber.dispose();await rm(root,{recursive:true,force:true})}}
}
test('real Cordis load, tool pipeline, slash command, archive, replay boundary, cleanup', async()=>{
  const h=await harness({auto:false})
  try {
    h.user('修复边界')
    assert.equal((await h.run('fixture',{token:'SECRET',file_path:'one.ts'},'call1')).isError,false)
    const first=await h.review(); assert.equal(first.result.kind,'success')
    assert.ok(first.result.text.includes('1 次工具调用'))
    assert.equal(first.result.text.includes('SECRET'),false)
    const dir=path.join(h.root,'.dsh/reports'), files=await readdir(dir)
    assert.equal(files.length,1); assert.equal((await readFile(path.join(dir,files[0]),'utf8')).includes('SECRET'),false)
    assert.ok(boundary(h.session.snapshotEvents())>0)
    assert.equal(segment(h.session),null)
    assert.equal((await h.review()).result.text,'没有尚未复盘的新内容。')
    h.user('第二段'); await h.run('fixture',{},'call2')
    const [a,b]=await Promise.all([h.review(),h.review()])
    assert.equal(a.result.kind,'success'); assert.equal(b.result.text,'没有尚未复盘的新内容。')
    assert.equal((await readdir(dir)).length,2)
    const restored=Session.create(SessionId('restored'),h.session.snapshotEvents())
    assert.equal(segment(restored),null)
  } finally {await h.close()}
})
test('automatic idle trigger with exact configured threshold, no repeat',async()=>{
  const h=await harness({toolThreshold:1})
  try {
    h.user('自动复盘'); await h.run('fixture')
    h.ctx.emit('agent/status',{agent:h.agent,status:'running'})
    assert.ok(segment(h.session))
    h.ctx.emit('agent/status',{agent:h.agent,status:'idle'})
    await new Promise(resolve=>setImmediate(resolve))
    await h.ctx.sessions.flush(h.session)
    assert.equal(segment(h.session),null)
    assert.equal((await readdir(path.join(h.root,'.dsh/reports'))).length,1)
    h.ctx.emit('agent/status',{agent:h.agent,status:'idle'})
    await new Promise(resolve=>setImmediate(resolve)); await h.ctx.sessions.flush(h.session)
    assert.equal((await readdir(path.join(h.root,'.dsh/reports'))).length,1)
  }finally{await h.close()}
})
test('failure and pending evidence, archive failure preserves boundary',async()=>{
  const h=await harness({auto:false,reportDir:'blocked/reports'})
  try{
    h.user('修复失败'); await h.run('missing',{},'failed')
    h.session.append('tool/call',{turn:1,step:1,callId:'pending',name:'fixture',arguments:'{}'})
    await writeFile(path.join(h.root,'blocked'),'not a directory')
    assert.equal((await h.review()).result.kind,'error'); assert.equal(boundary(h.session.snapshotEvents()),0)
    await rm(path.join(h.root,'blocked'))
    const out=await h.review(); assert.equal(out.result.kind,'success')
    assert.ok(out.result.text.includes('1 次失败')); assert.ok(out.result.text.includes('1 次未完成'))
  }finally{await h.close()}
})
test('invalid schema rejected and lifecycle unregisters command',async()=>{
  const h=await harness({auto:false})
  try {
    assert.equal((await h.ctx.commands.execute(h.agent,'/review unexpected',[],new AbortController().signal)).result.kind,'error')
    assert.ok(h.ctx.commands.list(h.agent).some(c=>c.name==='review'))
    assert.throws(()=>plugin.Config({toolThreshold:0}))
    await h.pluginFiber.dispose()
    assert.equal(h.ctx.commands.list(h.agent).some(c=>c.name==='review'),false)
  }finally{await h.close()}
})
test('host workspace evidence classifies create/edit/delete and triggers file threshold',async()=>{
  const workspace={summary(){return {files:['a','b','c'].map(path=>({path})),total:3}},async diff(_id,_seq,index){return {kind:'text',before:index!==0,after:index!==2}}}
  const h=await harness({toolThreshold:100,fileThreshold:3},workspace)
  try{
    h.user('按文件门槛自动复盘')
    h.session.append('workspace/changes',{turn:1})
    h.ctx.emit('agent/status',{agent:h.agent,status:'idle'})
    await h.ctx.sessions.flush(h.session)
    const names=await readdir(path.join(h.root,'.dsh/reports'))
    const output=await readFile(path.join(h.root,'.dsh/reports',names[0]),'utf8')
    for(const entry of ['新建：a','修改：b','删除：c']) assert.ok(output.includes(entry))
  }finally{await h.close()}
})
test('file mutations require explicit domain evidence',async()=>{
  const {fileChanges}=await import('../lib/plugin.js')
  assert.deepEqual(fileChanges('read',{path:'a',before:null,after:'x'}),[])
  assert.deepEqual(fileChanges('write',{path:'a',before:null,after:'x'}),[{path:'a',kind:'新建'}])
  assert.deepEqual(fileChanges('edit',{path:'a',before:'x',after:'y'}),[{path:'a',kind:'修改'}])
  assert.deepEqual(fileChanges('bash',{path:'a'}),[])
})
test('native historical results are recognized without telemetry; corrupt boundary ignored',async()=>{
  const {createToolResultMessage}=await import('@deepseek-ai/dsh-llm')
  const session=Session.create(SessionId('historical'))
  session.append('tool/call',{turn:1,step:1,callId:'old',name:'read',arguments:JSON.stringify({password:'SECRET',file_path:'old.ts'})})
  session.append('tool/result',{turn:1,step:1,message:createToolResultMessage({callId:'old',content:[{type:'text',text:'ok'}],isError:false})},{surfaceOp:'append'})
  appendPluginRecord(session,'plugin:task-review/boundary',{version:1,to:1000,file:'invalid'})
  const s=segment(session)
  assert.equal(s.calls[0].status,'success'); assert.equal(s.calls[0].duration,null)
  assert.equal(s.calls[0].args.includes('SECRET'),false); assert.deepEqual(s.calls[0].paths,['old.ts'])
  assert.equal(boundary(session.snapshotEvents()),0)
})
