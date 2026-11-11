/** GET-only live acceptance; no DSH loading, no model by default, no credential output. */
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { Github, GithubError } from '../lib/github.js'
import { run,render } from '../lib/pipeline.js'
import { emptyState, stateSchema, repoName, limitSchema } from '../lib/types.js'
import { dueSlot } from '../lib/schedule.js'

const usage='用法：node packages/dsh-github-triage/scripts/smoke-real.mjs [owner/repo] [--limit 5] [--schedule-only] [--business "文本"] [--business-file <路径>] [--model-adapter <本地 mjs> | --mock-model]'
let args
try {
  const {values,positionals}=parseArgs({allowPositionals:true,options:{
    limit:{type:'string',default:'5'},business:{type:'string'},'business-file':{type:'string'},'mock-model':{type:'boolean'},'schedule-only':{type:'boolean'},'model-adapter':{type:'string'},help:{type:'boolean'},
  }})
  if(values['mock-model']&&values['model-adapter'])throw new Error('conflicting model options')
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
      let model
      if(args['mock-model']){
        model=(await import('./mock-model.mjs')).default
        console.log('模拟模型：固定演示输出，不调用真实 AI；结论仅展示格式。')
      }
      if(args['model-adapter']){
        model=(await import(pathToFileURL(path.resolve(args['model-adapter'])).href)).default
        if(typeof model!=='function')throw new Error('adapter must export a function')
      }
      const source={safe:client.safe,get warnings(){return client.warnings},list:async()=>snapshot,enrich:client.enrich.bind(client),contents:client.contents.bind(client)}
      const state=emptyState(),settings={repo,mode:'both',business:args.business,businessFile:args['business-file']}
      const modelRoute=args['mock-model']?'smoke/mock-model':args['model-adapter']?'smoke/adapter:'+path.resolve(args['model-adapter']):'unconfigured'
      if(!model)console.log('未配置模型，仅规则预筛，未经 AI 研判。')
      const snapshot=await client.list(repo,'both',limit)
      const first=await run(source,settings,state,{limit,now:Date.now(),model,modelRoute})
      assert.equal(first.analyzed,snapshot.length)
      console.log(render(first))
      const cache=path.join(dir,'cache.json')
      await writeFile(cache,JSON.stringify(client.safe.value(state)),{mode:0o600})
      const restored=stateSchema.parse(JSON.parse(await readFile(cache,'utf8')))
      // Same fetched snapshot, persisted round-trip: isolate cache from concurrent GitHub updates.
      const second=await run(source,settings,restored,{limit,now:Date.now(),model,modelRoute})
      const assessed=first.results.filter(r=>r.judgment).length
      assert.equal(second.reused,assessed);assert.equal(second.analyzed,snapshot.length-assessed);assert.equal(second.briefing,undefined)
      assert.equal(Object.keys(restored.cache).length,assessed)
      console.log('第二次运行（同一 GitHub 快照、从 TEMP 重载缓存）：'+second.analyzed+' 条重新处理，'+second.reused+' 条已研判缓存命中；不推送重复简报。')
      if(model)assert.equal(assessed,snapshot.length)
      const issues=snapshot.filter(i=>i.kind==='issue').length,prs=snapshot.filter(i=>i.kind==='pr').length
      console.log('PASS：'+issues+' issues + '+prs+' PR；严格只读；'+(args['mock-model']?'模拟模型（非真实 AI 结论）。':model?'使用显式模型适配器。':'未配置模型，仅规则预筛，未经 AI 研判；不缓存结论。'))
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
