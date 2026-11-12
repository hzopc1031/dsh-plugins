/** Browser-safe schemas shared by forms and the command-backed UI service. */
import { z } from 'zod'
import { repoSchema, repoName, limitSchema, fullLimitSchema, scheduleSchema, reportSchema, resultSchema, type Repo, type Report } from './types.js'
export const editableRepoSchema=repoSchema.strict().superRefine((r,c)=>{
  if(r.localRef&&!r.localRepoPath)c.addIssue({code:'custom',path:['localRef'],message:'填写 ref 前请先配置本地代码路径'})
})
export const patchSchema = z.object({
  mode: repoSchema.shape.mode.unwrap().optional(), schedule: scheduleSchema.nullable().optional(),
  limit: limitSchema.nullable().optional(), fullMax: fullLimitSchema.nullable().optional(),
  business: repoSchema.shape.business.nullable(), businessFile: repoSchema.shape.businessFile.nullable(),
  localRepoPath: repoSchema.shape.localRepoPath.nullable(), localRef: repoSchema.shape.localRef.nullable(),
  rulesFile: repoSchema.shape.rulesFile.nullable(),
}).strict()
export type RepoPatch = z.infer<typeof patchSchema>
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s)
export const scanSchema = z.object({ full:z.boolean().optional(), since:date.optional(), until:date.optional(), limit:limitSchema.optional(), max:fullLimitSchema.optional() }).strict().superRefine((s,c)=>{
  if (!s.full && (s.since || s.until || s.max !== undefined)) c.addIssue({code:'custom',path:['full'],message:'时间范围和全量上限需要选择全量扫描'})
  if (s.full && s.limit !== undefined) c.addIssue({code:'custom',path:['limit'],message:'全量扫描请填写全量上限'})
  if (s.since && s.until && s.since > s.until) c.addIssue({code:'custom',path:['until'],message:'结束日期不能早于开始日期'})
})
export type UiScan = z.infer<typeof scanSchema>
export const requestSchema = z.discriminatedUnion('action',[
  z.object({action:z.literal('snapshot'),compact:z.boolean().optional()}).strict(),
  z.object({action:z.literal('detail'),repo:repoName,number:z.number().int().positive()}).strict(),
  z.object({action:z.literal('jobs')}).strict(),
  z.object({action:z.literal('models')}).strict(),
  z.object({action:z.literal('detect-proxy')}).strict(),
  z.object({action:z.literal('diagnose')}).strict(),
  z.object({action:z.literal('add'),value:editableRepoSchema}).strict(),
  z.object({action:z.literal('patch'),repo:repoName,patch:patchSchema}).strict(),
  z.object({action:z.literal('remove'),repo:repoName}).strict(),
  z.object({action:z.literal('start'),repo:repoName,scan:scanSchema}).strict(),
  z.object({action:z.literal('fix'),repo:repoName,number:z.number().int().positive(),recommendation:z.enum(['adopt','manual-review','not-recommended']),reason:z.string().trim().min(1).max(1200)}).strict(),
  z.object({action:z.literal('rules'),repo:repoName}).strict(),
  z.object({action:z.literal('export'),repo:repoName,path:z.string().min(1).max(4096)}).strict(),
  z.object({action:z.literal('import'),repo:repoName,text:z.string().min(1).max(16384)}).strict(),
])
export type UiRequest = z.infer<typeof requestSchema>
export interface Job { repo:string; status:'queued'|'running'|'completed'|'failed'; message?:string; at?:number }
export interface ModelStatus { enabled:boolean; provider:string; model:string; available:boolean; warning?:string }
const summaryJudgment=z.object({kind:z.enum(['issue','pr']),recommendation:z.enum(['adopt','manual-review','not-recommended']),priority:z.enum(['高','中','低']),businessReason:z.string()})
export const summaryResult=resultSchema.omit({evidence:true,judgment:true}).extend({deferred:z.literal(true),judgment:summaryJudgment.optional()})
export type UiResult=z.infer<typeof summaryResult>|z.infer<typeof resultSchema>
export type UiReport=Omit<Report,'results'>&{results:UiResult[]}
export interface Snapshot { repositories:Repo[]; reports:UiReport[]; jobs:Job[]; model:ModelStatus; defaults:{limit:number;fullMax:number} }
export type Reply<T=unknown> = {ok:true;data:T}|{ok:false;error:string;fields?:Record<string,string>}
export type UiCall = <T=unknown>(request:UiRequest)=>Promise<T>
export const jobSchema=z.object({repo:repoName,status:z.enum(['queued','running','completed','failed']),message:z.string().optional(),at:z.number().optional()})
export const snapshotSchema=z.object({repositories:z.array(repoSchema),reports:z.array(reportSchema.extend({results:z.array(z.union([summaryResult,resultSchema]))})),jobs:z.array(jobSchema),model:z.object({enabled:z.boolean(),provider:z.string(),model:z.string(),available:z.boolean(),warning:z.string().optional()}),defaults:z.object({limit:limitSchema,fullMax:fullLimitSchema})})
/** Decode every transport response before exposing it to React. */
export function decodeValue(request:UiRequest,value:unknown):unknown {
  if(request.action==='snapshot')return snapshotSchema.parse(value)
  if(request.action==='jobs')return z.array(jobSchema).parse(value)
  if(request.action==='start')return jobSchema.parse(value)
  if(request.action==='detail')return resultSchema.parse(value)
  if(request.action==='add'||request.action==='patch')return repoSchema.parse(value)
  return z.string().parse(value)
}
export const routeActions={snapshot:['snapshot'],detail:['detail'],repos:['add','patch','remove'],run:['start'],correct:['fix'],rules:['rules','export','import'],models:['models','detect-proxy','diagnose'],jobs:['jobs']} as const
export type RouteName=keyof typeof routeActions
export const routePath=(name:RouteName)=>'/api/dsh-github-triage/'+name
export function routeFor(action:UiRequest['action']):RouteName {
  return (Object.keys(routeActions) as RouteName[]).find(name=>(routeActions[name] as readonly string[]).includes(action))!
}
/** Null clears an optional value. Omitted keys retain the latest server value. */
export function mergeRepo(existing:Repo, patch:RepoPatch):Repo {
  const next:Record<string,unknown>={...existing}
  for(const [key,value] of Object.entries(patchSchema.parse(patch))) {
    if(value===null) delete next[key]; else if(value!==undefined) next[key]=value
  }
  return editableRepoSchema.parse(next)
}
export function changedFields(before:Repo, after:Repo):RepoPatch {
  const patch:Record<string,unknown>={}
  for(const key of Object.keys(patchSchema.shape) as (keyof RepoPatch)[])
    if(JSON.stringify(before[key])!==JSON.stringify(after[key])) patch[key]=after[key]??null
  return patchSchema.parse(patch)
}
export function fieldErrors(error:z.ZodError):Record<string,string> {
  const out:Record<string,string>={}
  for(const issue of error.issues) {
    const path=issue.path.filter(p=>!['value','patch','scan'].includes(String(p))).join('.')||'form'
    const field=path.split('.')[0]
    const hints:Record<string,string>={repo:'请按 owner/repo 填写 GitHub 仓库',mode:'请选择 issues、PR 或两者',limit:'请输入 1–100 的整数',fullMax:'请输入 1–500 的整数',max:'请输入 1–500 的整数',schedule:'每日时间请填 HH:MM；间隔需在 0.001–8760 小时内',since:'请填写有效日期 YYYY-MM-DD',until:'请填写有效日期 YYYY-MM-DD',reason:'请填写 1–1200 字符的纠正理由'}
    out[path]=issue.code==='custom'?issue.message:hints[field]??(issue.code==='unrecognized_keys'?'包含不支持的字段':'请检查字段类型或长度')
  }
  return out
}
