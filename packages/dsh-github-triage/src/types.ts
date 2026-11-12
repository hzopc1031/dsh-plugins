import { z } from 'zod'

/** Extract the repository before interpreting URL paths (no URL dot-segment rewriting).
 * An exact authority allowlist also rejects credentials, ports and lookalike hosts.
 * Never include the supplied address in validation errors: it may contain a token.
 */
export const repoName = z.string().transform((input,ctx) => {
  const value=input.trim()
  const web=/^(?:https?:\/\/)?(?:www\.)?github\.com\/(.*)$/i.exec(value)
  const ssh=/^git@github\.com:([^?#]+)$/i.exec(value)
  const path=web?web[1].split(/[?#]/,1)[0]:ssh?ssh[1]:value
  const parts=path.replace(/\/+$/,'').split('/')
  const owner=parts[0],repo=parts[1]?.replace(/(?:\.git)+$/i,'')
  if(/[\s\\\u0000-\u001f\u007f]/.test(value)||(!web&&parts.length!==2)||!owner||!repo
    ||!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/.test(owner)
    ||!/^[a-zA-Z0-9_.-]{1,100}$/.test(repo)||repo==='.'||repo==='..') {
    ctx.addIssue({code:'custom',message:'请输入 owner/repo 或 github.com 仓库地址；不接受其他主机或含凭据的地址'})
    return z.NEVER
  }
  return (owner+'/'+repo).toLowerCase()
})
export const limitSchema = z.number().int().min(1).max(100)
export const fullLimitSchema = z.number().int().min(1).max(500)
export interface Scan { full?: boolean; since?: string; until?: string }
export const scheduleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('daily'), time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/) }).strict(),
  z.object({ kind: z.literal('every'), hours: z.number().finite().min(0.001).max(8760) }).strict(),
])
export const repoSchema = z.object({
  repo: repoName, mode: z.enum(['issues', 'prs', 'both']).default('both'),
  schedule: scheduleSchema.optional(), limit: limitSchema.optional(),
  business: z.string().max(100000).optional(), businessFile: z.string().max(4096).optional(),
  localRepoPath: z.string().max(4096).optional(), localRef: z.string().max(256).optional(),
  rulesFile: z.string().max(4096).optional(), fullMax: fullLimitSchema.optional(),
})
export type Repo = z.infer<typeof repoSchema>
export type Schedule = z.infer<typeof scheduleSchema>
export interface Settings { repositories: Repo[]; limit: number; fullMax: number; provider: string; model: string; modelEnabled: boolean }
export interface Item {
  number: number; kind: 'issue' | 'pr'; title: string; body: string; updated_at: string; url: string
  commits?: {sha:string; message:string}[]; mergeCommit?: string; fixes?: Item[]
  head?: string; files?: { path: string; additions: number; deletions: number; status?:string; patch?: string }[]
  additions?: number; deletions?: number; changedFiles?: number; draft?: boolean
  ci?: { name: string; state: 'pass' | 'fail' | 'pending' }[]
  linked?: { number: number; title: string; body: string }[]
  locations?: string[]; notes?: string[]; snippets?: {path:string; text:string; truncated:boolean}[]
}
const common = {
  recommendation:z.enum(['adopt','manual-review','not-recommended']),
  priority:z.enum(['高','中','低']),
  localApplicability:z.enum(['present','already-fixed','not-applicable','unclear']),
  localReason:z.string().trim().min(1).max(1200),
  reason:z.string().trim().min(1).max(1200),businessReason:z.string().trim().min(1).max(1200),
  evidence:z.array(z.string().min(1).max(800)).min(1).max(40),
}
export const issueJudgment=z.object({kind:z.literal('issue'),type:z.enum(['bug','需求','提问','重复','无效']),
  exists:z.enum(['confirmed','likely','unclear','not_a_bug']),worthFixing:z.enum(['值得修','待补充','不值得修']),
  ...common}).strict()
export const prJudgment=z.object({kind:z.literal('pr'),verdict:z.enum(['值得合并','改完再合','不建议合']),
  fitsDirection:z.enum(['yes','unclear','no']),risk:z.enum(['高','中','低']),testing:z.string().trim().min(1).max(1200),...common}).strict()
export const judgmentSchema = z.discriminatedUnion('kind', [issueJudgment, prJudgment])
export type Judgment = z.infer<typeof judgmentSchema>
export const resultSchema = z.object({
  number: z.number().int().positive(), title: z.string(), url: z.string(),
  kind: z.enum(['issue','pr']), judgment: judgmentSchema.optional(), evidence: z.array(z.string()),
  localStatus:z.string().optional(),
  observation: z.string().optional(), source: z.enum(['rules', 'model', 'correction']), modelNote: z.string().optional(),
})
export type Result = z.infer<typeof resultSchema>
export const correctionSchema = z.object({
  repo: repoName, number: z.number().int().positive(), judgment: judgmentSchema,
  business:z.string().optional(),
  reason: z.string(), at: z.number(), title: z.string(),
})
export type Correction = z.infer<typeof correctionSchema>
export const reportSchema = z.object({
  repo: repoName, at: z.number(), results: z.array(resultSchema), analyzed: z.number(), reused: z.number(),
  changed: z.array(z.number()), briefing: z.string().optional(), warnings: z.array(z.string()),
  businessContext:z.string().optional(), rulesStatus:z.string().optional(), localStatus:z.string().optional(),
  businessStatus: z.string(), modelStatus: z.string().optional(),
})
export type Report = z.infer<typeof reportSchema>
const currentStateSchema = z.object({
  formatVersion: z.literal(3),
  ruleDocuments:z.record(z.string(),z.string().max(16384)),
  overrides: z.record(z.string(), repoSchema), removed: z.array(repoName),
  cache: z.record(z.string(), z.object({ fingerprint: z.string(), result: resultSchema })),
  corrections: z.array(correctionSchema),
  reports: z.record(z.string(), reportSchema),
  lastRun: z.record(z.string(), z.number()),
  pending: z.record(z.string(), z.string()),
})
export type State = z.infer<typeof currentStateSchema>
export function emptyState(): State { return { formatVersion:3, ruleDocuments:{}, overrides: {}, removed: [], cache: {}, corrections: [], reports: {}, lastRun: {}, pending: {} } }
export type Model = (prompt: string, signal?: AbortSignal) => Promise<string>


// Preserve authoritative 0.1.0 settings/corrections, discard derived rule conclusions.
const legacyJudgment = z.object({kind:z.enum(['issue','pr']),type:z.enum(['bug','需求','提问','重复','无效']).optional(),
  real:z.enum(['是','待证实','否']).optional(),worth:z.enum(['值得修','待补充','不值得修']).optional(),
  verdict:z.enum(['值得合并','改完再合','不建议合']).optional(),risk:z.enum(['高','中','低']).optional(),
  priority:z.enum(['高','中','低']),reason:z.string(),evidence:z.array(z.string())})
export const stateSchema = z.preprocess(value=>{
  if (!value || typeof value!=='object') return value
  if ('formatVersion' in value) {
    if(value.formatVersion!==2)return value
    const old=value as Record<string,unknown>
    const corrections=z.array(z.record(z.string(),z.unknown())).parse(old.corrections).map(c=>{
      const j=c.judgment as Record<string,unknown>
      return {...c,judgment:{...j,...migrateConclusion(j)}}
    })
    return {...emptyState(),overrides:old.overrides,removed:old.removed,lastRun:old.lastRun,corrections}
  }
  const old=z.object({overrides:z.record(z.string(),repoSchema),removed:z.array(repoName),lastRun:z.record(z.string(),z.number()),
    corrections:z.array(z.object({repo:repoName,number:z.number().int().positive(),judgment:legacyJudgment,reason:z.string(),at:z.number(),title:z.string()}))}).parse(value)
  const corrections=old.corrections.map(c=>({...c,judgment:c.judgment.kind==='issue'?{
    kind:'issue',type:c.judgment.type,exists:c.judgment.real==='是'?'confirmed':c.judgment.real==='否'?'not_a_bug':'unclear',
    worthFixing:c.judgment.worth,priority:c.judgment.priority,reason:c.judgment.reason,evidence:c.judgment.evidence,
    businessReason:'0.1.0 用户纠正；未提供业务说明，按通用标准判断',
  }:{kind:'pr',verdict:c.judgment.verdict,fitsDirection:'unclear',risk:c.judgment.risk,testing:'0.1.0 用户纠正；测试情况待核实',
    reason:c.judgment.reason,evidence:c.judgment.evidence,businessReason:'0.1.0 用户纠正；未提供业务说明，按通用标准判断'}}))
  return {...emptyState(),overrides:old.overrides,removed:old.removed,corrections:corrections.map(c=>({...c,judgment:{...c.judgment,...migrateConclusion(c.judgment)}})),lastRun:old.lastRun}
},currentStateSchema)

function migrateConclusion(j:Record<string,unknown>) {
  const v=j.kind==='pr'?j.verdict:j.worthFixing
  return {recommendation:['值得修','值得合并'].includes(String(v))?'adopt':['不值得修','不建议合'].includes(String(v))?'not-recommended':'manual-review',
    priority:j.priority??'中',localApplicability:'unclear',localReason:'旧版用户纠正，尚未进行本地仓库对照'}
}
