import { judgmentSchema, limitSchema, type Item, type Model, type Report, type Result, type State, type Repo, type Judgment } from './types.js'
import { rules } from './rules.js'
import { outputJsonSchema, parseJudgment } from './model.js'
import { SafeText, md } from './safety.js'

export function fingerprint(item: Item): string { return item.number+':'+item.updated_at+(item.kind==='pr'?':'+item.head:'') }
export interface Source {
  list(repo: string, mode: Repo['mode'], limit: number, signal?: AbortSignal): Promise<Item[]>
  enrich(repo: string, item: Item, signal?: AbortSignal): Promise<Item>
  safe?: SafeText; warnings?: string[]
}
export function sorted(results: Result[]): Result[] {
  const rank = (r: Result) => (r.judgment.kind==='pr'&&(r.judgment.verdict==='不建议合'||r.judgment.suspicious)?-10:0)+['高','中','低'].indexOf(r.judgment.priority)
  return [...results].sort((a,b)=>rank(a)-rank(b)||a.number-b.number)
}
export function briefing(repo: string, changed: Result[], reused: number): string | undefined {
  if (!changed.length) return undefined
  const issues=changed.filter(r=>r.judgment.kind==='issue'), prs=changed.filter(r=>r.judgment.kind==='pr')
  return repo+'：新增/更新 '+issues.length+' 个 issue，'+issues.filter(r=>r.judgment.kind==='issue'&&r.judgment.worth==='值得修').length+' 个值得修；'+prs.length+' 个 PR，'+prs.filter(r=>r.judgment.kind==='pr'&&r.judgment.verdict==='值得合并').length+' 个值得合并。缓存复用 '+reused+' 条。'
}
export async function run(source: Source, repo: Repo, state: State, options: {limit:number; now:number; model?:Model; signal?:AbortSignal}): Promise<Report> {
  const limit=limitSchema.parse(options.limit), safe=source.safe??new SafeText()
  const items=safe.value((await source.list(repo.repo,repo.mode,limit,options.signal)).slice(0,limit))
  const results: Result[]=[],changed:Result[]=[]
  let reused=0
  // Analyze older item numbers first so duplicate detection prefers original reports.
  for (const item of [...items].sort((a,b)=>a.number-b.number)) {
    options.signal?.throwIfAborted()
    const key=repo.repo+'#'+item.number, cached=state.cache[key]
    const correction=[...state.corrections].reverse().find(c=>c.repo===repo.repo&&c.number===item.number)
    if (cached?.fingerprint===fingerprint(item)) {
      results.push(correction?{...cached.result,judgment:correction.judgment,source:'correction',modelNote:undefined}:cached.result);reused++;continue
    }
    const enriched=safe.value(await source.enrich(repo.repo,item,options.signal))
    const rule=rules(enriched,items)
    let judgment=rule, note:string|undefined='模型不可用（纯规则）', used:Result['source']='rules'
    if (correction && correction.judgment.kind===item.kind) {judgment=correction.judgment;used='correction';note=undefined}
    else if (options.model) {
      let output: string | undefined
      try {
        output=await options.model(safe.text(JSON.stringify({schema:outputJsonSchema,item:enriched,rule,
          references:state.corrections.filter(c=>c.repo===repo.repo&&c.judgment.kind===item.kind).slice(-8)})),options.signal)
      } catch { note='模型不可用（纯规则回退）' }
      if (output!==undefined) {
        try {
          judgment=parseJudgment(safe.text(output),item.kind);used='model';note=undefined
          // Keep observed evidence and risk flags even when the model is more optimistic.
          judgment.evidence=[...new Set([...rule.evidence,...judgment.evidence])].slice(0,40)
          if (judgment.kind==='pr'&&rule.kind==='pr') {
            judgment.suspicious ||= rule.suspicious
            if (rule.suspicious||rule.risk==='高') judgment.risk='高'
            if (rule.verdict!=='值得合并'&&judgment.verdict==='值得合并') {
              judgment.verdict='改完再合';judgment.reason+='；规则阻塞项尚需核实'
            }
          }
        } catch {judgment=rule;used='rules';note='模型解析失败（纯规则回退）'}
      }
    }
    options.signal?.throwIfAborted()
    const result=safe.value({number:item.number,title:item.title,url:enriched.url,judgment,source:used,...note?{modelNote:note}:{}} satisfies Result)
    judgmentSchema.parse(result.judgment)
    state.cache[key]={fingerprint:fingerprint(item),result}
    results.push(result);changed.push(result)
  }
  const warnings=source.warnings??[], previousWarnings=state.reports[repo.repo]?.warnings??[]
  const featureWarnings=warnings.filter(w=>w.startsWith('该仓库已关闭 '))
  const summary=briefing(repo.repo,changed,reused)
  // Announce newly observed disabled features even with no items; repeated runs stay quiet.
  const notices=summary?featureWarnings:featureWarnings.filter(w=>!previousWarnings.includes(w))
  const brief=[summary,...notices.map(w=>repo.repo+'：'+w)].filter(Boolean).join('\n')||undefined
  const report=safe.value({repo:repo.repo,at:options.now,results:sorted(results),analyzed:changed.length,reused,
    changed:changed.map(r=>r.number),briefing:brief,warnings} satisfies Report)
  state.reports[repo.repo]=report
  return report
}
export function render(report: Report): string {
  return ['## GitHub 仓库研判 · '+report.repo,new Date(report.at).toLocaleString()+' · 新分析 '+report.analyzed+' / 缓存 '+report.reused,
    ...report.warnings,...sorted(report.results).map(r=>{
      const j=r.judgment
      return '\n### '+j.priority+' · #'+r.number+' '+md(r.title)+'\n'+
        (j.kind==='issue'?j.type+' · 真问题：'+j.real+' · '+j.worth+'\n影响：'+md(j.impact)+'；严重度：'+md(j.severity)+'；成本：'+md(j.cost):j.verdict+' · 风险：'+j.risk)+
        '\n'+md(j.reason)+'\n'+j.evidence.map(e=>'- '+md(e)).join('\n')+
        '\n来源：'+r.source+(r.modelNote?' · '+r.modelNote:'')+'\n[原链接]('+r.url+')'
    })].join('\n\n')
}
export function correct(state: State, raw: string, now: number): string {
  const match=/^([^\s#]+\/[^\s#]+)#(\d+)\s+(\S+)(?:\s+([\s\S]+))?$/.exec(raw.trim())
  if (!match) throw new Error('用法：/triage-fix owner/repo#123 <bug|需求|提问|重复|无效|值得修|待补充|不值得修|值得合并|改完再合|不建议合> [理由]')
  const repo=match[1].toLowerCase(),number=Number(match[2]),key=repo+'#'+number,cached=state.cache[key]
  if (!cached) throw new Error('请先 /triage 拉取该条目')
  let j:Judgment=structuredClone(cached.result.judgment)
  const value=match[3],reason=match[4]||'用户纠正'
  if (j.kind==='pr') {
    if (!['值得合并','改完再合','不建议合'].includes(value)) throw new Error('PR 结论无效')
    j.verdict=value as typeof j.verdict
  } else if (['bug','需求','提问','重复','无效'].includes(value)) {
    j.type=value as typeof j.type
    j.real=['重复','无效'].includes(value)?'否':'待证实'
    j.worth=['重复','无效','提问'].includes(value)?'不值得修':'待补充'
  } else {
    if (!['值得修','待补充','不值得修'].includes(value)) throw new Error('issue 结论无效')
    j.worth=value as typeof j.worth
  }
  j.reason=reason;j.evidence=[...j.evidence.filter(e=>!e.startsWith('用户纠正：')),'用户纠正：'+reason].slice(-40)
  j=judgmentSchema.parse(j)
  state.corrections=state.corrections.filter(c=>c.repo!==repo||c.number!==number)
  state.corrections.push({repo,number,judgment:j,reason,at:now,title:cached.result.title})
  cached.result={...cached.result,judgment:j,source:'correction',modelNote:undefined}
  const report=state.reports[repo]
  if (report) report.results=sorted(report.results.map(r=>r.number===number?cached.result:r))
  return '已保存纠正：'+repo+'#'+number
}

