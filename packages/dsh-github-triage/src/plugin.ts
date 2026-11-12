import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { CommandDefinitionId, type CommandInvocation, type CommandResult } from '@deepseek-ai/dsh-commands'
import z from '@deepseek-ai/schemastery'
import { randomUUID } from 'node:crypto'
import { repoSchema, limitSchema, fullLimitSchema, type Scan, repoName, type Settings, type State } from './types.js'
import { domainSpec, prune } from './state.js'
import { Github, GithubError } from './github.js'
import { repoCommand, repositories, runArguments, tokens } from './config.js'
import { correct, render, run } from './pipeline.js'
import { dueSlot } from './schedule.js'
import { dshModel, listModels, modelWarning } from './model.js'
import { openLocal } from './local.js'
import { rulesCommand } from './rule-files.js'
import { SafeText } from './safety.js'
import { uiService } from './ui-service.js'
import { mountRoutes } from './ui-routes.js'

export const name='github-triage'
export const inject=['commands','storageDomain']
export const Config = z.object({
  repositories:z.array(z.object({
    repo:z.string().required(),
    business:z.string().default('').description('项目业务说明：核心功能、高风险模块、优先级原则；与文件内容一同交给 AI'),
    businessFile:z.string().default('').description('相对路径读 GitHub 默认分支，如 docs/business.md；本机绝对路径只读普通文件，限 16KB，拒绝 UNC/设备路径'),
    localRepoPath:z.string().default('').description('可选本地 Git 仓库绝对路径；只读所选 ref 已提交代码，不读取未提交修改'),
    localRef:z.string().default('').description('本地分支或提交，默认 HEAD；不 checkout、不 fetch'),
    rulesFile:z.string().default('').description('可选本机 UTF-8 规则文件，只读，最多 16KB'),
    fullMax:z.number().min(1).max(500).step(1),
    mode:z.union(['issues','prs','both']).default('both'),
    daily:z.string().default('').description('本地时间 HH:MM，与 everyHours 二选一'),
    everyHours:z.number().min(0).max(8760).default(0),
    limit:z.number().min(1).max(100).step(1),
  })).default([]).description('默认空仓库清单'),
  limit:z.number().min(1).max(100).step(1).default(20),
  fullMax:z.number().min(1).max(500).step(1).default(100),
  modelEnabled:z.boolean().default(true),
  provider:z.string().default('').description('DSH 已注册的服务商路由 ID，运行 /triage-models 复制 provider 值；与 model 分开填，不是密钥；默认空值无法 AI 研判'),
  model:z.string().default('').description('DSH 已注册服务商下的模型 ID，运行 /triage-models 复制 model 值；不填 provider/model 组合；默认空值无法 AI 研判'),
})
export interface Input {
  repositories?: {repo:string;mode?:'issues'|'prs'|'both';daily?:string;everyHours?:number;limit?:number;business?:string;businessFile?:string;localRepoPath?:string;localRef?:string;rulesFile?:string;fullMax?:number}[]
  limit?:number;fullMax?:number;modelEnabled?:boolean;provider?:string;model?:string
}
export function settings(input: Input): Settings {
  const repositories=(input.repositories??[]).map(r=>{
    if (r.daily && r.everyHours) throw new Error('daily 与 everyHours 不能同时设置')
    return repoSchema.parse({repo:r.repo,mode:r.mode??'both',limit:r.limit,business:r.business,businessFile:r.businessFile,localRepoPath:r.localRepoPath||undefined,localRef:r.localRef||undefined,rulesFile:r.rulesFile||undefined,fullMax:r.fullMax,
      schedule:r.daily?{kind:'daily',time:r.daily}:r.everyHours?{kind:'every',hours:r.everyHours}:undefined})
  })
  if (repositories.length>50) throw new Error('最多配置 50 个仓库')
  return {repositories,fullMax:fullLimitSchema.parse(input.fullMax??100),limit:limitSchema.parse(input.limit??20),modelEnabled:input.modelEnabled??true,provider:input.provider?.trim()??'',model:input.model?.trim()??''}
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
  const perform=async(repo: ReturnType<typeof repositories>[number], limit:number, scheduled:boolean, signal:AbortSignal,scan:Scan={})=>{
    if(Date.now()<(retryAt.get(repo.repo)??0))throw new GithubError(429,retryAt.get(repo.repo))
    const client=new Github({safe})
    try {
      const next=structuredClone(state),now=Date.now()
      const report=await run(client,repo,next,{...scan,limit,now,model:dshModel(ctx,config),modelRoute:JSON.stringify([config.modelEnabled,config.provider,config.model]),modelNote:modelWarning(ctx,config),signal})
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
    if (raw==='list') return repositories(config.repositories,state).map(r=>r.repo+' · '+r.mode+' · '+(r.schedule?JSON.stringify(r.schedule):'仅手动')+' · 上限 '+(r.limit??config.limit)+' · 业务说明：'+(r.businessFile||(r.business?'内联文本':'未配置'))+' · 本地：'+(r.localRepoPath||'未配置')+' · 规则：'+(r.rulesFile||'自身存储')).join('\n')||'未配置仓库。'
    const next=structuredClone(state),message=repoCommand(raw,next,config.repositories)
    const [action,changedRepo]=tokens(raw)
    for(const r of Object.values(next.overrides).filter(r=>['add','local'].includes(action)&&r.repo===changedRepo?.toLowerCase())){
      if(r.localRepoPath){const local=await openLocal(r,AbortSignal.any([i.signal,lifetime.signal]));if(!local.sha)throw new Error('本地路径或 ref 无效')}
    }
    if (repositories(config.repositories,next).length>50) throw new Error('最多 50 个仓库')
    await save(next);return message
  }))
  command('triage-models','列出 DSH 已注册的 provider 和 model（只读）',async i=>{
    if(i.rawInput.trim())throw new Error('无参数')
    return listModels(ctx)
  })
  command('triage','只读研判 GitHub issues/PR',async i=>{
    const scan=runArguments(safe.text(i.rawInput)),{repo,limit}=scan,signal=AbortSignal.any([i.signal,lifetime.signal])
    return serialize(async()=>{
      const all=repositories(config.repositories,state)
      const selected=repo?[all.find(r=>r.repo===repo)??{repo,mode:'both' as const}]:all
      if (!selected.length) return '未配置仓库。用 /triage-repo add owner/repo 添加，或 /triage owner/repo 手动运行。'
      const output:string[]=[]
      for(const r of selected) output.push(render(await perform(r,scan.full?(scan.max??r.fullMax??config.fullMax):(limit??r.limit??config.limit),false,signal,scan)))
      return output.join('\n\n')
    })
  })
  command('triage-report','查看最近 GitHub 哨兵结果',async i=>{
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
  command('triage-rules','查看、导出或导入仓库规则',async i=>serialize(async()=>{
    const next=structuredClone(state),message=await rulesCommand(safe.text(i.rawInput),next,repositories(config.repositories,state),safe)
    await save(next);return message
  }))
  command('triage-fix','纠正结论并保存为后续研判参考',async i=>serialize(async()=>{
    const next=structuredClone(state),message=correct(next,safe.text(i.rawInput),Date.now())
    await save(next);return message
  }))
  const ui=uiService({
    config,state:()=>state,save,safe,serialize,perform,signal:lifetime.signal,
    validate:async repo=>{
      if(repo.localRef&&!repo.localRepoPath)throw new Error('ref 需要本地仓库')
      if(repo.localRepoPath){const local=await openLocal(repo,lifetime.signal);if(!local.sha)throw new Error('本地路径或 ref 无效')}
    },
    model:()=>({enabled:config.modelEnabled,provider:config.provider,model:config.model,available:!modelWarning(ctx,config),warning:modelWarning(ctx,config)}),
    models:()=>listModels(ctx),
  })
  mountRoutes(ctx,ui)
  command('triage-ui','GitHub 哨兵界面数据接口（JSON）',async i=>{
    if(i.rawInput.length>150000)return JSON.stringify({ok:false,error:'请求过大'})
    try{return JSON.stringify(await ui(JSON.parse(i.rawInput)))}
    catch{return JSON.stringify({ok:false,error:'请求必须为有效 JSON'})}
  })
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



