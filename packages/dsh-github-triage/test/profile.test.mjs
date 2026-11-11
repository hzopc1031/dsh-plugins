import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { initProfile, loadProfileDirectory, boot } from '@deepseek-ai/dsh-app-boot'
import { Github } from '../lib/github.js'
import { SessionId } from '@deepseek-ai/dsh-session'
const project=fileURLToPath(new URL('../',import.meta.url))
test('temporary official profile loads prebuilt plugin, commands persist only in own storage domain, unload/reload',async(t)=>{
  t.mock.method(Github.prototype,'list',async()=>[{number:1,kind:'issue',title:'renderer startup fails',body:'Steps to reproduce: 1. open. 2. click. Version: 1.0.0 Error: failed',updated_at:'2026-11-11',url:'https://github.com/o/r/issues/1'}])
  t.mock.method(Github.prototype,'enrich',async(_,item)=>item)
  const parent=path.join(project,'.tmp');await mkdir(parent,{recursive:true})
  const root=await mkdtemp(path.join(parent,'profile-'))
  const old=process.env.DSH_HOME
  let ctx
  try {
    process.env.DSH_HOME=path.join(root,'home')
    const profile=path.join(root,'home','profiles','github-triage-test')
    initProfile(profile,['dsh-github-triage'])
    await mkdir(path.join(profile,'node_modules'),{recursive:true})
    await symlink(project,path.join(profile,'node_modules','dsh-github-triage'),'junction')
    const composed=loadProfileDirectory('github-triage-test',profile,path.join(project,'package.json'))
    assert.equal(composed.skippedBundles.length,0)
    const config=path.join(root,'cordis.yml'),storage=path.join(root,'storage')
    const pluginPath=n=>JSON.stringify(fileURLToPath(import.meta.resolve('@deepseek-ai/'+n)))
    await writeFile(config,[
      '- name: '+pluginPath('dsh-storage'),
      '- name: '+pluginPath('dsh-storage-json')+'\n  config:\n    root: '+JSON.stringify(storage),
      '- name: '+pluginPath('dsh-storage-domain')+'\n  config:\n    backend: json',
      '- name: '+pluginPath('dsh-session'),
      '- name: '+pluginPath('dsh-commands'),
    ].join('\n'))
    const start=()=>boot('github-triage-test',config,composed.layers.flatMap(l=>l.patches),undefined,pathToFileURL(path.join(profile,'package.json')).href)
    const composeBefore=await readFile(config,'utf8')
    ctx=await start()
    let session=ctx.sessions.create(SessionId('github-triage-test'),{meta:{cwd:root}})
    let agent={id:session.id,session,ctx,status:'idle'}
    const execute=async line=>(await ctx.commands.execute(agent,line,[],new AbortController().signal)).result
    assert.deepEqual(ctx.commands.list(agent).map(c=>c.name).filter(n=>n.startsWith('triage')).sort(),['triage','triage-fix','triage-repo','triage-report'])
    assert.match((await execute('/triage')).text,/未配置仓库/)
    assert.match((await execute('/triage-repo add O/R --prs --limit 5')).text,/已保存/)
    assert.match((await execute('/triage-repo list')).text,/o\/r · prs/)
    assert.equal((await execute('/triage-repo add o/r --daily 25:00')).kind,'error')
    assert.match((await execute('/triage-report')).text,/暂无报告/)
    assert.equal((await execute('/triage-fix o/r#1 不建议合')).kind,'error')
    assert.match((await execute('/triage o/r --limit 1')).text,/renderer startup fails/)
    assert.match((await execute('/triage-fix o/r#1 不值得修 已解决')).text,/已保存纠正/)
    assert.match((await execute('/triage-report o/r')).text,/已解决/)
    assert.match((await execute('/triage-repo remove o/r')).text,/已移除/)
    // Re-add without schedule so the startup timer never makes a network request.
    await execute('/triage-repo add o/r --issues --limit 4')
    await ctx.fiber.dispose();ctx=undefined
    assert.equal(await readFile(config,'utf8'),composeBefore)
    const stored=await readdir(storage)
    assert.ok(stored.some(n=>n.startsWith('github_triage')))
    ctx=await start()
    session=ctx.sessions.create(SessionId('github-triage-test-2'),{meta:{cwd:root}})
    agent={id:session.id,session,ctx,status:'idle'}
    assert.match((await execute('/triage-repo list')).text,/o\/r · issues/)
    assert.match((await execute('/triage-repo list')).text,/上限 4/)
    assert.match((await execute('/triage-report o/r')).text,/已解决/)
    await execute('/triage-repo remove o/r')
    assert.match((await execute('/triage-repo list')).text,/未配置仓库/)
  } finally {
    await ctx?.fiber.dispose()
    if(old===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=old
    const relative=path.relative(parent,root)
    assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative))
    await rm(root,{recursive:true,force:true})
  }
})

