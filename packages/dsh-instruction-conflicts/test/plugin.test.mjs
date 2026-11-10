import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import Sessions, { SessionId } from '@deepseek-ai/dsh-session'
import Commands from '@deepseek-ai/dsh-commands'
import { SessionQueryEngine } from '@deepseek-ai/dsh-session-query'
import SystemPrompt, { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import { createUserMessage, createSystemMessage } from '@deepseek-ai/dsh-llm'
import * as plugin from '../index.js'
import { observeMessages } from '../lib/adapter.js'
import { inventory } from '../lib/inventory.js'
import { workspace, skill } from './fixtures.mjs'
class Query extends SessionQueryEngine {
  async searchSessions() { throw Error('FTS must not be called') }
  async searchEvents() { throw Error('FTS must not be called') }
}
async function harness(fn) {
  const ctx=new Context()
  try {
    await ctx.plugin(Sessions);await ctx.plugin(Commands);await ctx.plugin(Query)
    await ctx.plugin(SystemPrompt,{includeHarnessIdentity:false,includeRuntimeContext:false})
    const fiber=await ctx.plugin(plugin)
    const session=ctx.sessions.create(SessionId('instruction-test'))
    const agent={id:session.id,session,ctx,status:'idle'}
    const execute=(raw='',signal=new AbortController().signal)=>ctx.commands.execute(agent,'/instruction-conflicts '+raw,[],signal)
    const json=async(raw='json')=>{
      const result=(await execute(raw)).result;assert.equal(result.kind,'success',result.text);return JSON.parse(result.text)
    }
    const append=(m,opts={surfaceOp:'append'})=>session.append('user/message',createUserMessage({content:[{type:'text',text:m.body}],source:m.source}),opts)
    await fn({ctx,fiber,session,agent,execute,json,append})
  } finally {await ctx.fiber.dispose()}
}
test('真实 Cordis、官方 Commands、Session Query 挂载与卸载',()=>harness(async h=>{
  assert.equal(plugin.name,'instruction-conflicts');assert.deepEqual(plugin.inject,['commands','sessionQuery'])
  assert.ok(h.ctx.commands.list(h.agent).some(c=>c.name==='instruction-conflicts'))
  assert.deepEqual(plugin.Config({}),{})
  await h.fiber.dispose()
  assert.equal(h.ctx.commands.list(h.agent).some(c=>c.name==='instruction-conflicts'),false)
}))
test('真实 Session 注入正文→命令 JSON→疑似冲突且不发模型消息',()=>harness(async h=>{
  h.append(workspace([{body:'禁止全局安装'}]));h.append(skill('必须全局安装依赖'))
  const r=await h.json();assert.equal(r.conflicts.length,1)
  assert.equal(r.conflicts[0].left.source,'AGENTS.md')
  assert.equal(r.rows.find(r=>r.label==='AGENTS.md').currentContext,true)
  const events=h.session.snapshotEvents()
  assert.equal(events.filter(e=>e.type==='user/message').length,2)
  assert.equal(events.filter(e=>e.type==='request/header').length,0)
  assert.ok(events.some(e=>e.type==='command/done'))
  assert.ok(events.filter(e=>e.type==='command/run').every(e=>!e.data.rawInput))
}))
test('官方 fold 与 Session Query readSurface 对压缩替换给出相同原文保留状态',()=>harness(async h=>{
  const original=h.append(workspace([{body:'禁止全局安装'}]))
  h.append({body:'摘要中提到 AGENTS.md',source:{kind:'compaction',form:'recall'}},{surfaceOp:{op:'replace',startSeq:original.seq,endSeq:original.seq},sourceEventSeqs:[original.seq]})
  const r=await h.json('history-json')
  const row=r.rows.find(r=>r.label==='AGENTS.md');assert.equal(row.everInjected,true);assert.equal(row.currentContext,false)
  const surface=await h.ctx.sessionQuery.readSurface(h.session.id)
  assert.equal(surface.events.some(e=>e.seq===original.seq),false)
  assert.equal(r.rows.some(r=>r.label==='compaction'),false)
}))
test('空 system 替换清除规则，不将已清空节点计入当前上下文',()=>harness(async h=>{
  const a=h.session.append('system/message',{turn:0,step:0,message:createSystemMessage('禁止联网')},{surfaceOp:'append'})
  h.session.append('system/message',{turn:0,step:1,message:createSystemMessage('')},{surfaceOp:{op:'replace',startSeq:a.seq,endSeq:a.seq},sourceEventSeqs:[a.seq]})
  const r=await h.json('history-json');const row=r.rows.find(r=>r.label==='system-prompt')
  assert.equal(row.currentContext,false);assert.equal(row.versions[0].body,'禁止联网')
}))
test('assembly 候选不能自行变成已注入证据',()=>harness(async h=>{
  h.ctx.systemPrompt.section({name:'fixture:policy',order:10,text:'禁止联网'})
  await h.ctx.systemPrompt.assemble({scope:h.agent})
  const r=await h.json();assert.equal(r.rows.some(r=>r.category==='runtime'),false)
}))
test('逐字匹配已入日志的完整 system 正文后归属命名 section',()=>harness(async h=>{
  h.ctx.systemPrompt.section({name:'fixture:policy',order:10,text:'禁止联网'})
  h.ctx.systemPrompt.section({name:'fixture:workflow',order:20,text:'必须联网'})
  const assembly=await h.ctx.systemPrompt.assemble({scope:h.agent})
  h.session.append('system/message',{turn:0,step:0,message:createSystemMessage(renderPrompt(assembly))},{surfaceOp:'append'})
  const r=await h.json();assert.equal(r.conflicts.length,1)
  assert.ok(r.rows.some(r=>r.label==='system-prompt / fixture:policy'))
  assert.ok(r.rows.some(r=>r.label==='system-prompt / fixture:workflow'))
}))
test('另一个 agent 的 assembly 不能归属给本会话',()=>harness(async h=>{
  h.ctx.systemPrompt.section({name:'fixture:policy',order:10,text:'禁止联网'})
  const assembly=await h.ctx.systemPrompt.assemble({scope:{}})
  h.session.append('system/message',{turn:0,step:0,message:createSystemMessage(renderPrompt(assembly))},{surfaceOp:'append'})
  const r=await h.json();assert.ok(r.rows.some(r=>r.label==='system-prompt'))
  assert.ok(!r.rows.some(r=>r.label.includes('fixture:policy')))
}))
test('complete section 的最终修复与候选不同则不伪造分段归属',()=>harness(async h=>{
  h.ctx.systemPrompt.section({name:'fixture:complete',order:0,text:'禁止联网',complete:true})
  h.ctx.on('system-prompt/assemble',async(_a,_c,next)=>{const a=await next();a.sections.push({name:'fixture:extra',text:'必须联网'});return a})
  const assembly=await h.ctx.systemPrompt.assemble({scope:h.agent})
  assert.equal(renderPrompt(assembly),'禁止联网')
  h.session.append('system/message',{turn:0,step:0,message:createSystemMessage(renderPrompt(assembly))},{surfaceOp:'append'})
  const r=await h.json();assert.equal(r.conflicts.length,0)
  assert.equal(r.rows.filter(r=>r.category==='runtime').length,1)
}))
test('读取使用单一 observation cut，后续 append 不混入旧观察',()=>harness(async h=>{
  h.append(workspace([{body:'禁止全局安装'}]))
  const observation=await h.ctx.sessionQuery.observeSession(h.session.id,{projectionMode:'none'})
  try {
    h.append(skill('必须全局安装依赖'))
    assert.equal(observeMessages(observation.events).length,1)
    assert.equal(observation.cursor,0)
  } finally {observation[Symbol.dispose]()}
  assert.equal((await h.json()).conflicts.length,1)
}))
test('恢复后的新插件没有 assembly 缓存仍保留完整 system 正文',()=>harness(async h=>{
  h.session.append('system/message',{turn:0,step:0,message:createSystemMessage('禁止联网\n必须联网')},{surfaceOp:'append'})
  const r=await h.json();assert.equal(r.rows.find(r=>r.label==='system-prompt').versions[0].body,'禁止联网\n必须联网')
  assert.equal(r.conflicts.length,1)
}))
test('无 fs 时元数据为未知，未知不等于不存在',()=>harness(async h=>{
  h.append(workspace([{body:'禁止全局安装'}]))
  const r=await h.json();assert.equal(r.rows.find(r=>r.label==='AGENTS.md').fileExists,'unknown')
  assert.match(r.notices.join('\n'),/fs 服务未挂载/)
}))
test('无参数、history、help 可读；畸形命令报错',()=>harness(async h=>{
  for(const arg of ['','history','help']) assert.equal((await h.execute(arg)).result.kind,'success')
  for(const arg of ['fix','history json','../../AGENTS.md']) assert.equal((await h.execute(arg)).result.kind,'error')
}))
test('取消在读取前生效',()=>harness(async h=>{
  const cancel=new AbortController();cancel.abort()
  await assert.rejects(()=>h.execute('json',cancel.signal))
}))
test('Query 读取失败不伪造空上下文',()=>harness(async h=>{
  h.ctx.sessionQuery.observeSession=async()=>{throw Error('fake backend failure')}
  const result=(await h.execute('json')).result
  assert.equal(result.kind,'error');assert.match(result.text,/未将读取失败当成规则不存在/)
}))
function mockFs(entries) {
  const calls=[]
  return {calls,async resolve(p){calls.push(['resolve',p]);return {targetKey:p,displayPath:p}},async stat(target){calls.push(['stat',target.displayPath]);const item=entries.get(target.displayPath);if(item instanceof Error)throw item;return item}}
}
const file={type:'file',version:'v1'},directory={type:'directory',version:'v1'}
test('元数据探测默认候选与来源文件，不读正文，不进入禁止目录',async()=>{
  const root=path.resolve('fixture-root'),cwd=path.join(root,'app')
  const entries=new Map([[path.join(root,'.git'),directory],[path.join(root,'AGENTS.md'),file],[path.join(cwd,'CLAUDE.md'),file]])
  const fs=mockFs(entries),m=workspace([{body:'禁止联网'}])
  const result=await inventory(fs,cwd,[m],new AbortController().signal)
  assert.equal(result.files.find(f=>f.key==='agent-instructions:.\0AGENTS.md').exists,'yes')
  assert.equal(result.files.find(f=>f.key==='agent-instructions:app\0CLAUDE.md').exists,'yes')
  assert.ok(fs.calls.every(([action])=>['resolve','stat'].includes(action)))
  assert.ok(!fs.calls.some(([,p])=>p.includes('_private')||p.includes('_tools')))
})
test('元数据读取错误给未知，普通不存在给否，目录不给文件存在',async()=>{
  const root=path.resolve('fixture-root')
  const denied=Object.assign(Error('denied'),{code:'EACCES'})
  const fs=mockFs(new Map([[path.join(root,'.git'),directory],[path.join(root,'AGENTS.md'),denied],[path.join(root,'CLAUDE.md'),directory]]))
  const r=await inventory(fs,root,[],new AbortController().signal)
  assert.equal(r.files.find(f=>f.path==='AGENTS.md').exists,'unknown')
  assert.equal(r.files.find(f=>f.path==='CLAUDE.md').exists,'no')
  assert.equal(r.files.find(f=>f.path==='AGENTS.local.md').exists,'no')
})
test('来源路径穿越或禁止路径不会被探测',async()=>{
  const root=path.resolve('fixture-root'),fs=mockFs(new Map([[path.join(root,'.git'),directory]]))
  const messages=[workspace([{path:'../secret.md',scope:'..\0secret.md',body:'禁止联网'}]),workspace([{path:'_private/AGENTS.md',scope:'_private\0AGENTS.md',body:'禁止联网'}],1)]
  const r=await inventory(fs,root,messages,new AbortController().signal)
  assert.equal(r.files.find(f=>f.path==='../secret.md').exists,'unknown')
  assert.ok(!fs.calls.some(([,p])=>p.includes('_private')||p.includes('secret.md')))
})
test('元数据探测尊重中途取消',async()=>{
  const abort=new AbortController(),fs=mockFs(new Map())
  fs.resolve=async()=>{abort.abort();throw Error('cancel')}
  await assert.rejects(()=>inventory(fs,path.resolve('fixture-root'),[],abort.signal))
})

test('工作目录 change 日志使历史项目路径元数据变为未知',()=>harness(async h=>{
  h.append(workspace([{body:'禁止联网'}]))
  h.session.append('working-directory/change',{cwd:path.resolve('different-project')})
  const r=await h.json();assert.match(r.notices.join('\n'),/存在工作目录变更/)
  assert.equal(r.rows.find(r=>r.label==='AGENTS.md').fileExists,'unknown')
}))
