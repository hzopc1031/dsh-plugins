import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { initProfile, loadProfileDirectory, boot } from '@deepseek-ai/dsh-app-boot'
import { Github } from '../lib/github.js'
import ClientModules from '@deepseek-ai/dsh-client-modules'
import LlmRuntime, { LlmAdapter } from '@deepseek-ai/dsh-llm'
import { model } from './fixtures.mjs'
import { SessionId } from '@deepseek-ai/dsh-session'
const project=fileURLToPath(new URL('../',import.meta.url))
test('temporary official profile loads prebuilt plugin, commands persist only in own storage domain, unload/reload',async(t)=>{
  const scans=[]
  t.mock.method(Github.prototype,'list',async(repo,mode,limit,signal,scan)=>{scans.push({limit,scan});return [{number:1,kind:'issue',title:'renderer startup fails',body:'Steps to reproduce: 1. open. 2. click. Version: 1.0.0 Error: failed',updated_at:'2026-11-11',url:'https://github.com/o/r/issues/1'}]})
  t.mock.method(Github.prototype,'localDetails',async(_,item)=>item)
  t.mock.method(Github.prototype,'enrich',async(_,item)=>item)
  const parent=path.join(project,'.tmp');await mkdir(parent,{recursive:true})
  const root=await mkdtemp(path.join(parent,'profile-'))
  const old=process.env.DSH_HOME
  let ctx
  try {
    const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,shell:false})
    git('init','-q');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-qm','profile fixture')
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
    const patches=composed.layers.flatMap(l=>l.patches)
    for(const patch of patches)for(const entry of patch.insert??[])if(entry.id==='github-triage')entry.config={provider:'test',model:'test-model'}
    const prompts=[]
    class MockAdapter extends LlmAdapter {
      async listModels(provider){return [{provider,id:'test-model',name:'模拟模型'}]}
      async *stream(request){prompts.push(JSON.parse(request.messages[0].content[0].text));yield {type:'text-delta',text:await model(request.messages[0].content[0].text)};yield {type:'finish',reason:{kind:'stop'}}}
    }
    const start=async()=>{
      const context=await boot('github-triage-test',config,patches,c=>{c.plugin(LlmRuntime);c.plugin(ClientModules)},pathToFileURL(path.join(profile,'package.json')).href)
      context.llm.registerAdapter(['test'],new MockAdapter())
      return context
    }
    const composeBefore=await readFile(config,'utf8')
    ctx=await start()
    let session=ctx.sessions.create(SessionId('github-triage-test'),{meta:{cwd:root}})
    let agent={id:session.id,session,ctx,status:'idle'}
    const execute=async line=>(await ctx.commands.execute(agent,line,[],new AbortController().signal)).result
    assert.deepEqual(ctx.commands.list(agent).map(c=>c.name).filter(n=>n.startsWith('triage')).sort(),['triage','triage-detect-proxy','triage-diagnose','triage-fix','triage-models','triage-repo','triage-report','triage-rules','triage-ui'])
    const manifest=JSON.parse(await readFile(path.join(project,'package.json'),'utf8'))
    assert.equal(manifest.dsh.client.platform,'web')
    assert.deepEqual(manifest.dsh.client.inject,["@deepseek-ai/dsh-client-ui-conversation","@deepseek-ai/dsh-client-ui-session","@deepseek-ai/dsh-api-remotes","@deepseek-ai/dsh-client-ui-sidebar","@deepseek-ai/dsh-client-ui-layout","@deepseek-ai/dsh-client-locale","@deepseek-ai/dsh-client-ui-plugin-manager"])
    assert.equal(manifest.exports['./client'].default,'./lib/client.js')
    assert.match(await readFile(path.join(project,'lib/client.js'),'utf8'),/window\.__ModuleLoader__\.load/)
    const ui=async request=>{
      const response=await execute('/triage-ui '+JSON.stringify(request))
      assert.equal(response.kind,'success');const reply=JSON.parse(response.text);assert.equal(reply.ok,true,JSON.stringify(reply));return reply.data
    }
    assert.equal(ctx.clientModules.clientPath('dsh-github-triage'),path.join(project,'lib','client.js'))
    const graph=ctx.clientModules.graph()
    assert.ok(JSON.stringify(graph).includes('dsh-github-triage'))
    const empty=await ui({action:'snapshot'});assert.equal(empty.repositories.length,0);assert.equal(empty.model.provider,'test')
    assert.match((await ui({action:'models'})),/test-model/)
    await ui({action:'add',value:{repo:'ui/repo',mode:'prs',business:'界面业务',limit:3}})
    await ui({action:'patch',repo:'ui/repo',patch:{limit:4}})
    assert.equal((await ui({action:'snapshot'})).repositories[0].business,'界面业务')
    const invalid=JSON.parse((await execute('/triage-ui {"action":"patch","repo":"ui/repo","patch":{"limit":0}}')).text)
    assert.equal(invalid.ok,false);assert.ok(invalid.fields.limit)
    await ui({action:'remove',repo:'ui/repo'})
    assert.match((await execute('/triage')).text,/未配置仓库/)
    assert.match((await execute('/triage-repo add O/R --prs --limit 5 --business "核心 登录业务"')).text,/已保存/)
    assert.match((await execute('/triage-repo list')).text,/o\/r · prs/)
    assert.equal((await execute('/triage-repo add o/r --daily 25:00')).kind,'error')
    assert.match((await execute('/triage-report')).text,/暂无报告/)
    assert.equal((await execute('/triage-fix o/r#1 不建议合')).kind,'error')
    assert.match((await execute('/triage-models')).text,/provider: "test"  model: "test-model"/)
    assert.equal((await execute('/triage-repo local o/r '+JSON.stringify(path.join(root,'missing')))).kind,'error')
    const invalidLocal=JSON.parse((await execute('/triage-ui '+JSON.stringify({action:'patch',repo:'o/r',patch:{localRepoPath:path.join(root,'missing')}}))).text)
    assert.equal(invalidLocal.ok,false);assert.ok(invalidLocal.fields.localRepoPath)
    await ui({action:'patch',repo:'o/r',patch:{localRepoPath:root,localRef:'HEAD'}})
    assert.equal((await ui({action:'snapshot'})).repositories[0].business,'核心 登录业务')
    assert.match((await execute('/triage-repo local o/r '+JSON.stringify(root)+' --ref HEAD')).text,/已更新本地仓库对照/)
    const triage=(await execute('/triage o/r --limit 1')).text
    assert.match(triage,/renderer startup fails/);assert.match(triage,/业务说明：已使用/);assert.match(triage,/结合业务：/)
    assert.match(triage,/建议采纳/);assert.ok(prompts[0].local.commit)
    await execute('/triage o/r --full --since 2026-01-01 --max 150')
    assert.equal(scans.at(-1).limit,150);assert.equal(scans.at(-1).scan.full,true)
    assert.equal(prompts[0].business.text,'核心 登录业务')
    const started=await ui({action:'start',repo:'o/r',scan:{limit:1}})
    assert.ok(['queued','running'].includes(started.status))
    for(let n=0;n<100;n++){
      const jobs=await ui({action:'jobs'})
      if(jobs.every(j=>j.status==='completed'||j.status==='failed'))break
      await new Promise(resolve=>setTimeout(resolve,10))
    }
    assert.equal((await ui({action:'jobs'}))[0].status,'completed')
    await ui({action:'fix',repo:'o/r',number:1,recommendation:'manual-review',reason:'界面纠正理由'})
    assert.match(await ui({action:'rules',repo:'o/r'}),/界面纠正理由/)
    assert.match((await execute('/triage-fix o/r#1 不值得修 已解决')).text,/已保存纠正/)
    assert.match((await execute('/triage-report o/r')).text,/已解决/)
    assert.match((await execute('/triage-fix o/r#1 manual-review 新三档纠正')).text,/已保存纠正/)
    const rules=path.join(root,'rules.md')
    assert.match((await execute('/triage-rules o/r')).text,/新三档纠正/)
    assert.match((await execute('/triage-rules export o/r '+JSON.stringify(rules))).text,/已导出/)
    assert.equal((await execute('/triage-rules export o/r '+JSON.stringify(rules))).kind,'error')
    await writeFile(rules,(await readFile(rules,'utf8')).replace('新三档纠正','已解决：编辑的规则'))
    assert.match((await execute('/triage-rules import o/r '+JSON.stringify(rules))).text,/已导入/)
    assert.match((await execute('/triage-rules o/r')).text,/编辑的规则/)
    assert.match((await execute('/triage-repo local o/r --clear')).text,/已更新/)
    assert.match((await execute('/triage-repo remove o/r')).text,/已移除/)
    // Re-add without schedule so the startup timer never makes a network request.
    await execute('/triage-repo add o/r --issues --limit 4')
    assert.match((await execute('/triage-repo business o/r "核心 功能"')).text,/已更新业务说明/)
    await ctx.fiber.dispose();ctx=undefined
    assert.equal(await readFile(config,'utf8'),composeBefore)
    const stored=await readdir(storage)
    assert.ok(stored.some(n=>n.startsWith('github_triage')))
    ctx=await start()
    session=ctx.sessions.create(SessionId('github-triage-test-2'),{meta:{cwd:root}})
    agent={id:session.id,session,ctx,status:'idle'}
    assert.match((await execute('/triage-repo list')).text,/o\/r · issues/)
    assert.match((await execute('/triage-repo list')).text,/上限 4/)
    assert.match((await execute('/triage-repo list')).text,/业务说明：内联文本/)
    await execute('/triage-repo business o/r --clear')
    assert.match((await execute('/triage-repo list')).text,/业务说明：未配置/)
    assert.match((await execute('/triage-report o/r')).text,/新三档纠正/)
    assert.match((await execute('/triage-rules o/r')).text,/编辑的规则/)
    await ctx.fiber.dispose();ctx=undefined
    for(const patch of patches)for(const entry of patch.insert??[])if(entry.id==='github-triage')entry.config={}
    ctx=await start()
    session=ctx.sessions.create(SessionId('github-triage-test-3'),{meta:{cwd:root}})
    agent={id:session.id,session,ctx,status:'idle'}
    const unconfigured=(await execute('/triage o/r')).text
    assert.ok(unconfigured.startsWith('**未配置模型'))
    assert.match(unconfigured,/仅规则预筛，未经 AI 研判/)
    assert.ok(!/值得修|真实存在：/.test(unconfigured))
    assert.match((await execute('/triage-report o/r')).text,/业务说明：未配置/)
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

