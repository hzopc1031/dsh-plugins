/** GET-only live acceptance; no DSH loading, no model by default, no credential output. */
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { Github, GithubError } from '../lib/github.js'
import { run } from '../lib/pipeline.js'
import { emptyState, stateSchema, repoName, limitSchema } from '../lib/types.js'
import { dueSlot } from '../lib/schedule.js'

const usage='用法：node packages/dsh-github-triage/scripts/smoke-real.mjs [owner/repo] [--limit 5] [--schedule-only] [--model-adapter <本地 mjs>]'
let args
try {
  const {values,positionals}=parseArgs({allowPositionals:true,options:{
    limit:{type:'string',default:'5'},'schedule-only':{type:'boolean'},'model-adapter':{type:'string'},help:{type:'boolean'},
  }})
  if(positionals.length>1)throw new Error('too many repositories')
  args={...values,repo:repoName.parse(positionals[0]??'cordiverse/cordis'),limit:limitSchema.parse(Number(values.limit))}
}catch{
  console.error('参数无效；仓库须为 owner/repo，limit 须为 1–100 的整数。\n'+usage)
  process.exitCode=1
}
if(args?.help)console.log(usage+'\n默认仓库：cordiverse/cordis；--limit 为 issues/PR 合计候选上限，默认 5。')
else if(args){
  let last,triggered=0
  for(const now of [0,1000,3600]){
    const slot=dueSlot({kind:'every',hours:0.001},last,now)
    if(slot!==undefined){last=now;triggered++;console.log('调度演示 #'+triggered+'：注入时钟 '+now+'ms')}
  }
  assert.equal(triggered,2)
  if(!args['schedule-only']){
    const dir=await mkdtemp(path.join(os.tmpdir(),'dsh-github-triage-')),client=new Github()
    try {
      const {repo,limit}=args
      console.log('真实 smoke：'+repo+'；候选合计上限 '+limit)
      const snapshot=await client.list(repo,'both',limit)
      let model
      if(args['model-adapter']){
        model=(await import(pathToFileURL(path.resolve(args['model-adapter'])).href)).default
        if(typeof model!=='function')throw new Error('adapter must export a function')
      }
      const source={safe:client.safe,get warnings(){return client.warnings},list:async()=>snapshot,enrich:client.enrich.bind(client)}
      const state=emptyState(),settings={repo,mode:'both'}
      const first=await run(source,settings,state,{limit,now:Date.now(),model})
      assert.equal(first.analyzed,snapshot.length)
      for(const r of first.results){
        const j=r.judgment
        console.log('#'+r.number+' '+(j.kind==='issue'?j.type+'/'+j.worth:j.verdict)+' | '+j.priority+' | '+j.evidence.slice(0,2).join('；'))
      }
      for(const w of first.warnings)console.log(client.safe.text(w))
      const cache=path.join(dir,'cache.json')
      await writeFile(cache,JSON.stringify(client.safe.value(state)),{mode:0o600})
      const restored=stateSchema.parse(JSON.parse(await readFile(cache,'utf8')))
      // Same fetched snapshot, persisted round-trip: isolate cache from concurrent GitHub updates.
      const second=await run(source,settings,restored,{limit,now:Date.now(),model})
      assert.equal(second.analyzed,0);assert.equal(second.reused,snapshot.length);assert.equal(second.briefing,undefined)
      console.log('第二次运行（同一 GitHub 快照、从 TEMP 重载缓存）：0 条需重新分析，'+second.reused+' 条缓存命中；不推送简报。')
      const issues=snapshot.filter(i=>i.kind==='issue').length,prs=snapshot.filter(i=>i.kind==='pr').length
      console.log('PASS：'+issues+' issues + '+prs+' PR；严格只读；'+(model?'使用显式模型适配器。':'无模型，纯规则回退。'))
    }catch(error){
      console.error(error instanceof GithubError?'真实 smoke 失败：'+error.message+' (HTTP '+error.status+')':'真实 smoke 未通过：网络、数据或断言失败；未输出原始错误以防凭据泄露。')
      process.exitCode=1
    }finally{
      await client.close()
      const relative=path.relative(os.tmpdir(),dir)
      assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative))
      await rm(dir,{recursive:true,force:true})
    }
  }
}
