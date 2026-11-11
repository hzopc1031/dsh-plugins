import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { CommandDefinitionId, type CommandInvocation, type CommandResult } from '@deepseek-ai/dsh-commands'
import z from '@deepseek-ai/schemastery'
import { randomUUID } from 'node:crypto'
import { repoSchema, limitSchema, repoName, type Settings, type State } from './types.js'
import { domainSpec, prune } from './state.js'
import { Github, GithubError } from './github.js'
import { repoCommand, repositories, runArguments } from './config.js'
import { correct, render, run } from './pipeline.js'
import { dueSlot } from './schedule.js'
import { dshModel } from './model.js'
import { SafeText } from './safety.js'

export const name='github-triage'
export const inject=['commands','storageDomain']
export const Config = z.object({
  repositories:z.array(z.object({
    repo:z.string().required(),
    mode:z.union(['issues','prs','both']).default('both'),
    daily:z.string().default('').description('本地时间 HH:MM，与 everyHours 二选一'),
    everyHours:z.number().min(0).max(8760).default(0),
    limit:z.number().min(1).max(100).step(1),
  })).default([]).description('默认空仓库清单'),
  limit:z.number().min(1).max(100).step(1).default(20),
  modelEnabled:z.boolean().default(true),
  provider:z.string().default('').description('DSH 已注册的 provider route；空值使用纯规则'),
  model:z.string().default('').description('该 route 的模型 ID；不接收 API key'),
})
export interface Input {
  repositories?: {repo:string;mode?:'issues'|'prs'|'both';daily?:string;everyHours?:number;limit?:number}[]
  limit?:number;modelEnabled?:boolean;provider?:string;model?:string
}
export function settings(input: Input): Settings {
  const repositories=(input.repositories??[]).map(r=>{
    if (r.daily && r.everyHours) throw new Error('daily 与 everyHours 不能同时设置')
    return repoSchema.parse({repo:r.repo,mode:r.mode??'both',limit:r.limit,
      schedule:r.daily?{kind:'daily',time:r.daily}:r.everyHours?{kind:'every',hours:r.everyHours}:undefined})
  })
  if (repositories.length>50) throw new Error('最多配置 50 个仓库')
  return {repositories,limit:limitSchema.parse(input.limit??20),modelEnabled:input.modelEnabled??true,provider:input.provider??'',model:input.model??''}
}
export async function apply(ctx: Context, input: Input = {}): Promise<void> {
  const config=settings(input), domain=await ctx.storageDomain.open(domainSpec)
  const lifetime=new AbortController(),safe=new SafeText(),briefs=new Map<string,string>()
  const retryAt=new Map<string,number>()
  let state:State=structuredClone(domain.global.get()),chain:Promise<unknown>=Promise.resolve(),stopped=false,ticking=false
  let target:Agent|undefined,delivering=false
  const serialize=<T>(operation:()=>Promise<T>):Promise<T>=>{
    const job=chain.then(()=>{if(stopped)throw new Error('插件已停止');return operation()})
    chain=job.catch(()=>{})
    return job
  }
  const save=async(next:State)=>{
    prune(next); const clean=safe.value(next)
    await domain.global.set(clean);state=clean
  }
  const choose=()=>target??ctx.get('agents')?.roots().at(-1)
  const deliver=async()=>{
    if(stopped||delivering)return
    const agent=choose()
    if (!agent) return
    delivering=true
    try {
    for (const [repo,brief] of Object.entries(state.pending)) {
      const token=randomUUID();briefs.set(token,brief)
      try {
        const response=await ctx.commands.execute(agent,'/triage-report --brief '+token,[],lifetime.signal)
        if (response?.result.kind!=='success') continue
        // A newer briefing may have replaced this one during delivery.
        await serialize(async()=>{const next=structuredClone(state);if(next.pending[repo]===brief){delete next.pending[repo];await save(next)}})
      } catch {ctx.logger.warn('仓库简报暂未送达；下次会话可用 /triage-report 查看')}
      finally {briefs.delete(token)}
    }
    } finally {delivering=false}
  }
  const perform=async(repo: ReturnType<typeof repositories>[number], limit:number, scheduled:boolean, signal:AbortSignal)=>{
    if(Date.now()<(retryAt.get(repo.repo)??0))throw new GithubError(429,retryAt.get(repo.repo))
    const client=new Github({safe})
    try {
      const next=structuredClone(state),now=Date.now()
      const report=await run(client,repo,next,{limit,now,model:dshModel(ctx,config),signal})
      // Credentials learned from gh must also be redacted at the durable boundary.
      const clean=client.safe.value(next)
      if (scheduled) {
        clean.lastRun[repo.repo]=now
        if (report.briefing) clean.pending[repo.repo]=report.briefing
      }
      await save(clean)
      return report
    } catch(error) {
      if(error instanceof GithubError&&error.retryAt)retryAt.set(repo.repo,error.retryAt)
      throw error
    } finally {await client.close()}
  }
  const command=(name:string,description:string,handler:(i:CommandInvocation)=>Promise<string>)=>{
    ctx.effect(()=>ctx.commands.register({
      definitionId:CommandDefinitionId('dsh-github-triage/'+name),name,description,recordInput:false,
      handler:async (i):Promise<CommandResult>=>{
        target=i.agent
        try {return {kind:'success',text:safe.text(await handler(i))}}
        catch (error) {
          // Never expose arbitrary dependency, provider, OS, or schema exception text.
          return {kind:'error',text:i.signal.aborted||lifetime.signal.aborted?'研判已取消。':
            error instanceof GithubError?error.message:'操作失败：请检查命令格式、配置、仓库权限和网络。详见插件 README。'}
        }
      },
    }))
  }
  command('triage-repo','增删、列出只读研判 GitHub 仓库',async i=>serialize(async()=>{
    const raw=safe.text(i.rawInput).trim()
    if (raw==='list') return repositories(config.repositories,state).map(r=>r.repo+' · '+r.mode+' · '+(r.schedule?JSON.stringify(r.schedule):'仅手动')+' · 上限 '+(r.limit??config.limit)).join('\n')||'未配置仓库。'
    const next=structuredClone(state),message=repoCommand(raw,next)
    if (repositories(config.repositories,next).length>50) throw new Error('最多 50 个仓库')
    await save(next);return message
  }))
  command('triage','只读研判 GitHub issues/PR',async i=>{
    const {repo,limit}=runArguments(safe.text(i.rawInput)),signal=AbortSignal.any([i.signal,lifetime.signal])
    return serialize(async()=>{
      const all=repositories(config.repositories,state)
      const selected=repo?[all.find(r=>r.repo===repo)??{repo,mode:'both' as const}]:all
      if (!selected.length) return '未配置仓库。用 /triage-repo add owner/repo 添加，或 /triage owner/repo 手动运行。'
      const output:string[]=[]
      for(const r of selected) output.push(render(await perform(r,limit??r.limit??config.limit,false,signal)))
      return output.join('\n\n')
    })
  })
  command('triage-report','查看最近 GitHub 仓库研判结果',async i=>{
    const raw=i.rawInput.trim()
    if(raw.startsWith('--brief ')) {
      const token=raw.slice(8),brief=briefs.get(token)
      if(!brief)throw new Error('简报不存在')
      return brief+'\n用 /triage-report 查看证据和原链接。'
    }
    const repo=raw?repoName.parse(raw):undefined
    const reports=repo?[state.reports[repo]].filter(Boolean):Object.values(state.reports)
    return reports.length?reports.map(render).join('\n\n'):'暂无报告。'
  })
  command('triage-fix','纠正结论并保存为后续研判参考',async i=>serialize(async()=>{
    const next=structuredClone(state),message=correct(next,safe.text(i.rawInput),Date.now())
    await save(next);return message
  }))
  const tick=async()=>{
    if(stopped||ticking)return
    ticking=true
    try {
      await serialize(async()=>{
        for(const repo of repositories(config.repositories,state)){
          const now=Date.now()
          if(dueSlot(repo.schedule,state.lastRun[repo.repo],now)===undefined || now<(retryAt.get(repo.repo)??0))continue
          try {await perform(repo,repo.limit??config.limit,true,lifetime.signal);retryAt.delete(repo.repo)}
          catch(error){if(!stopped){retryAt.set(repo.repo,error instanceof GithubError&&error.retryAt?error.retryAt:now+300000);ctx.logger.warn('仓库定时研判失败，稍后重试；没有推进上次成功时间')}}
        }
      })
      await deliver()
    } catch { /* Disposal cancels queued work. */ }
    finally {ticking=false}
  }
  ctx.on('agent/created',({agent})=>{
    if(agent.session.header.origin==='subagent')return
    target=agent
    // Defer appends outside Session event publication.
    const timer=setTimeout(()=>{if(!stopped)void deliver().catch(()=>{if(!stopped)ctx.logger.warn('仓库简报投递失败；可用 /triage-report 查看')})},0)
    timer.unref?.()
    return undefined
  })
  ctx.on('agent/disposed',({agent})=>{if(target===agent)target=undefined})
  ctx.effect(()=>{
    const timer=setInterval(()=>{void tick()},30000);timer.unref?.()
    const startup=setTimeout(()=>{void tick()},0);startup.unref?.()
    return async()=>{
      stopped=true;lifetime.abort();clearInterval(timer);clearTimeout(startup)
      await chain;await domain.close()
    }
  })
}



