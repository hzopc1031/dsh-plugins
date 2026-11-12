/** Official profile composer + Loader boot smoke test, no credentials/model/network. */
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { initProfile, loadProfileDirectory, boot } from '@deepseek-ai/dsh-app-boot'
import { SessionId } from '@deepseek-ai/dsh-session'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { prepareTools, executeTool } from './tool-fixture.mjs'
const project=fileURLToPath(new URL('../',import.meta.url))
const parent=path.join(project,'.tmp'); await mkdir(parent,{recursive:true})
const root=await mkdtemp(path.join(parent,'profile-smoke-'))
const oldHome=process.env.DSH_HOME
let ctx
try {
  process.env.DSH_HOME=path.join(root,'home')
  const profile=path.join(process.env.DSH_HOME,'profiles','task-review-test')
  initProfile(profile,['dsh-task-review'])
  await mkdir(path.join(profile,'node_modules'),{recursive:true})
  await symlink(project,path.join(profile,'node_modules','dsh-task-review'),'junction')
  const loaded=loadProfileDirectory('task-review-smoke',profile,path.join(project,'package.json'))
  assert.equal(loaded.skippedBundles.length,0)
  const config=path.join(root,'cordis.yml')
  const services=['dsh-session','dsh-system-prompt','dsh-tools','dsh-commands']
  await writeFile(config,services.map(name=>`- name: ${JSON.stringify(import.meta.resolve('@deepseek-ai/'+name).startsWith('file:') ? fileURLToPath(import.meta.resolve('@deepseek-ai/'+name)) : name)}`).join('\n'))
  ctx=await boot('task-review-smoke',config,loaded.layers.flatMap(layer=>layer.patches),undefined,pathToFileURL(path.join(profile,'package.json')).href)
  await prepareTools(ctx)
  const session=ctx.sessions.create(SessionId('profile-review'),{meta:{cwd:root}})
  const agent={id:session.id,session,ctx,status:'idle'}
  assert.ok(ctx.commands.list(agent).some(c=>c.name==='review'))
  ctx.tools.register(defineTool({name:'smoke_read',description:'Read-only test fixture',parameters:{},output:{schema:{type:'string'},render:(_,value)=>[{type:'text',text:value}]},async execute(){return 'fixture result'}}))
  session.append('user/message',createUserMessage({source:{kind:'user'},content:[{type:'text',text:'验证独立 profile 复盘'}]}),{surfaceOp:'append'})
  const result=await executeTool(ctx,{callId:'smoke',name:'smoke_read',arguments:{},agent,signal:new AbortController().signal})
  assert.equal(result.isError,false)
  const command=await ctx.commands.execute(agent,'/review',[],new AbortController().signal)
  assert.equal(command.result.kind,'success')
  assert.ok(command.result.text.includes('smoke_read'))
  const files=await readdir(path.join(root,'.dsh/reports'))
  assert.equal(files.length,1)
  assert.ok((await readFile(path.join(root,'.dsh/reports',files[0]),'utf8')).includes('smoke_read'))
  console.log('PASS: isolated profile bundle composition, official Loader boot, real tool event, /review, Markdown archive')
} finally {
  await ctx?.fiber.dispose()
  if(oldHome===undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME=oldHome
  // Remove only this mkdtemp child, after confirming it stays under the owned parent.
  const relative=path.relative(parent,root)
  if(!relative.startsWith('..') && !path.isAbsolute(relative)) await rm(root,{recursive:true,force:true})
}
