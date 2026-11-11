import type { Context } from '@deepseek-ai/cordis'
export type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
export type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
export type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { z } from 'zod'
import { type Repo, type Result, type Report } from './types.js'
import { editableRepoSchema, changedFields, fieldErrors, requestSchema, scanSchema, type Snapshot, type Job, type UiCall, type UiRequest, type Reply } from './ui-contract.js'

export const inject=['slots','remote','remote.commands']
const labels={adopt:'建议采纳','manual-review':'需人工看','not-recommended':'不推荐'}
const box:CSSProperties={border:'1px solid var(--dsw-alias-border, #8885)',borderRadius:10,padding:14,margin:'12px 0'}
const row:CSSProperties={display:'flex',flexWrap:'wrap',alignItems:'center',gap:8}
const control:CSSProperties={display:'block',width:'100%',boxSizing:'border-box',padding:8,margin:'5px 0',border:'1px solid #8888',borderRadius:6,background:'transparent',color:'inherit',font:'inherit'}
export class UiError extends Error {
  constructor(message:string,public fields?:Record<string,string>){super(message)}
}
type Execute=(sessionId:PropsRuntime<'conversation.session.header.actions'>['sessionId'],line:string,attachments:[])=>Promise<unknown>
export function commandCall(execute:Execute, sessionId:Parameters<Execute>[0]):UiCall {
  return async<T,>(request:UiRequest):Promise<T>=>{
    requestSchema.parse(request)
    let timer:ReturnType<typeof setTimeout>|undefined
    try{
      const response=await Promise.race([
        execute(sessionId,'/triage-ui '+JSON.stringify(request),[]),
        new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new UiError('界面请求超时；操作可能已提交，请刷新确认，避免重复提交。')),60000)}),
      ]) as {ok:boolean;error?:{message?:string;code?:string};value?:{result?:{kind:string;text?:string}}}
      if(!response?.ok)throw new UiError('界面接口调用失败：'+String(response?.error?.code??response?.error?.message??'未知原因').slice(0,200))
      if(!response.value)throw new UiError('界面接口未注册（/triage-ui），请确认插件已启用，或重新打开会话。')
      if(response.value.result?.kind!=='success')throw new UiError('界面接口出错：'+String(response.value.result?.text??'未知原因').slice(0,200))
      const reply=JSON.parse(response.value.result.text??'') as Reply<T>
      if(!reply.ok)throw new UiError(reply.error,reply.fields)
      return reply.data
    }finally{clearTimeout(timer)}
  }
}
function message(error:unknown):string{return error instanceof Error?error.message:'操作失败，请刷新重试。'}
function Errors({errors,name}:{errors:Record<string,string>;name:string}){
  const error=Object.entries(errors).filter(([key])=>key===name||key.startsWith(name+'.')).map(([,v])=>v).join('；')
  return error?<span role="alert" style={{color:'var(--dsw-alias-error, #c33)',display:'block'}}>{error}</span>:null
}
export function RepoForm({initial,call,onSaved,onCancel}:{initial?:Repo;call:UiCall;onSaved:()=>Promise<void>;onCancel:()=>void}){
  const [form,setForm]=useState(()=>({
    repo:initial?.repo??'',mode:initial?.mode??'both',business:initial?.business??'',businessFile:initial?.businessFile??'',
    localRepoPath:initial?.localRepoPath??'',localRef:initial?.localRef??'',rulesFile:initial?.rulesFile??'',
    limit:initial?.limit?.toString()??'',fullMax:initial?.fullMax?.toString()??'',
    schedule:initial?.schedule?.kind??'none',time:initial?.schedule?.kind==='daily'?initial.schedule.time:'09:00',
    hours:initial?.schedule?.kind==='every'?String(initial.schedule.hours):'6',
  }))
  const [errors,setErrors]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
  const dirty=useRef(new Set<string>())
  const field=(key:keyof typeof form,value:string)=>{
    dirty.current.add(['schedule','time','hours'].includes(key)?'schedule':key)
    setForm(f=>({...f,[key]:value}))
  }
  async function submit(e:FormEvent){
    e.preventDefault();if(busy)return
    setErrors({});setNotice('')
    try{
      const value=editableRepoSchema.parse({
        repo:form.repo,mode:form.mode,business:form.business||undefined,businessFile:form.businessFile||undefined,
        localRepoPath:form.localRepoPath||undefined,localRef:form.localRef||undefined,rulesFile:form.rulesFile||undefined,
        limit:form.limit?Number(form.limit):undefined,fullMax:form.fullMax?Number(form.fullMax):undefined,
        schedule:form.schedule==='daily'?{kind:'daily',time:form.time}:form.schedule==='every'?{kind:'every',hours:Number(form.hours)}:undefined,
      })
      if(value.localRef&&!value.localRepoPath){setErrors({localRef:'填写 ref 前请先配置本地代码路径'});return}
      setBusy(true)
      await call(initial?{action:'patch',repo:initial.repo,patch:Object.fromEntries(Object.entries(changedFields(initial,value)).filter(([key])=>dirty.current.has(key)))}:{action:'add',value})
      await onSaved()
    }catch(error){
      if(error instanceof z.ZodError)setErrors(fieldErrors(error))
      else{if(error instanceof UiError)setErrors(error.fields??{});setNotice(message(error))}
    }finally{setBusy(false)}
  }
  const text=(key:'repo'|'businessFile'|'localRepoPath'|'localRef'|'rulesFile'|'limit'|'fullMax',label:string)=><label>{label}<input style={control} aria-label={label} value={form[key]} disabled={key==='repo'&&!!initial} onChange={e=>field(key,e.target.value)}/><Errors errors={errors} name={key}/></label>
  return <form onSubmit={e=>void submit(e)} style={box} aria-label={initial?'编辑仓库':'添加仓库'} noValidate>
    <h3>{initial?'编辑仓库':'添加仓库'}</h3>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12}}>
      {text('repo','GitHub 仓库（owner/repo）')}
      <label>分析类型<select style={control} aria-label="分析类型" value={form.mode} onChange={e=>field('mode',e.target.value)}><option value="both">问题与代码改动（两者）</option><option value="issues">仅 issues</option><option value="prs">仅 PR</option></select><Errors errors={errors} name="mode"/></label>
      {text('localRepoPath','本地代码路径（可空，绝对路径）')}{text('localRef','本地 ref（可空，默认 HEAD）')}
      {text('businessFile','业务说明文件（仓库相对路径或本机绝对路径）')}
      {text('rulesFile','只读规则文件（可空，本机绝对路径）')}
      {text('limit','普通分析单次上限（1–100，空为继承）')}{text('fullMax','全量单次上限（1–500，空为继承）')}
      <label>定时<select style={control} aria-label="定时" value={form.schedule} onChange={e=>field('schedule',e.target.value)}><option value="none">不定时</option><option value="daily">每天 HH:MM</option><option value="every">每 N 小时</option></select>
        {form.schedule==='daily'&&<input style={control} aria-label="每天时间" value={form.time} onChange={e=>field('time',e.target.value)}/>}
        {form.schedule==='every'&&<input style={control} aria-label="间隔小时" value={form.hours} onChange={e=>field('hours',e.target.value)}/>}
        <Errors errors={errors} name="schedule"/>
      </label>
    </div>
    <label>业务说明<textarea style={{...control,minHeight:100}} aria-label="业务说明" value={form.business} onChange={e=>field('business',e.target.value)} placeholder="产品做什么、核心用户场景、哪些问题重要、哪些方向暂不需要"/><Errors errors={errors} name="business"/></label>
    <p>业务文字、规则和选定 ref 的已提交代码片段会交给所选模型。插件不修改 GitHub 或本地代码；定时需要 DSH 持续运行。</p>
    <Errors errors={errors} name="form"/><p role="alert">{notice}</p>
    <div style={row}><button type="submit" disabled={busy}>{busy?'保存中…':'保存仓库'}</button><button type="button" disabled={busy} onClick={onCancel}>取消编辑</button></div>
  </form>
}
function ScanControl({repo,job,defaults,call,onStarted}:{repo:Repo;job?:Job;defaults:Snapshot['defaults'];call:UiCall;onStarted:()=>Promise<void>}){
  const [full,setFull]=useState(false),[since,setSince]=useState(''),[until,setUntil]=useState(''),[limit,setLimit]=useState('')
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const active=busy||job?.status==='running'||job?.status==='queued'
  async function start(){
    setError('');setBusy(true)
    try{
      const scan=scanSchema.parse({full,...full?{since:since||undefined,until:until||undefined,max:limit?Number(limit):undefined}:{limit:limit?Number(limit):undefined}})
      await call({action:'start',repo:repo.repo,scan});await onStarted()
    }catch(e){setError(e instanceof z.ZodError?'请检查日期范围和上限（普通 1–100，全量 1–500）。':message(e))}
    finally{setBusy(false)}
  }
  return <div>
    <div style={row}><label><input type="checkbox" checked={full} onChange={e=>{setFull(e.target.checked);setLimit('')}}/>全量（含关闭条目）</label>
      {full&&<><label>开始日期<input aria-label={'开始日期 '+repo.repo} type="date" value={since} onChange={e=>setSince(e.target.value)}/></label><label>结束日期<input aria-label={'结束日期 '+repo.repo} type="date" value={until} onChange={e=>setUntil(e.target.value)}/></label></>}
      <label>本次上限<input style={{width:65}} aria-label={'本次上限 '+repo.repo} value={limit} placeholder={String(full?(repo.fullMax??defaults.fullMax):(repo.limit??defaults.limit))} onChange={e=>setLimit(e.target.value)}/></label>
      <button disabled={active} onClick={()=>void start()}>{active?'分析进行中…':'立即分析'}</button>
      {job&&<span role="status">{({queued:'排队中',running:'进行中',completed:'完成',failed:'失败'})[job.status]} {job.message}</span>}
    </div>
    {full&&<small>按最后更新时间筛选，达到上限会截断；全量增加 GitHub 请求与模型费用。</small>}
    <p role="alert">{error}</p>
  </div>
}
export function safeLink(raw:string):string|undefined{
  try{const u=new URL(raw);if(u.origin==='https://github.com'&&!u.username&&!u.password&&/^\/[^/]+\/[^/]+\/(?:issues|pull)\/\d+$/.test(u.pathname)&&!u.search&&!u.hash)return u.href}catch{}
}
function Details({result:r,repo,call,onChanged}:{result:Result;repo:string;call:UiCall;onChanged:()=>Promise<void>}){
  const j=r.judgment,[value,setValue]=useState(j?.recommendation??'manual-review'),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
  useEffect(()=>setValue(j?.recommendation??'manual-review'),[j?.recommendation])
  async function fix(e:FormEvent){
    e.preventDefault();setNotice('')
    if(!reason.trim()){setNotice('请填写纠正理由');return}
    setBusy(true)
    try{await call({action:'fix',repo,number:r.number,recommendation:value,reason});setNotice('已保存纠正并沉淀规则');setReason('');await onChanged()}
    catch(e){setNotice(message(e))}finally{setBusy(false)}
  }
  const url=safeLink(r.url)
  return <article style={box}>
    <strong>#{r.number} {r.title}</strong> <small>{r.kind==='issue'?'issue':'PR'} · {r.source==='correction'?'用户纠正':r.source==='model'?'AI 研判':'规则预筛'}</small>
    {!j?<p role="note">仅规则预筛，未经 AI 研判。{r.modelNote}</p>:<>
      <p>{labels[j.recommendation]} · 优先级：{j.priority} · {j.kind==='issue'?'真实存在：'+j.exists+' · '+j.worthFixing:j.verdict+' · 符合业务方向：'+j.fitsDirection+' · 风险：'+j.risk}</p>
      <p>结合业务：{j.businessReason}</p><p>本地适用性：{j.localApplicability} · {j.localReason}</p>
      {j.kind==='pr'&&<p>测试：{j.testing}</p>}
    </>}
    <details><summary>查看详情与纠正</summary>
      <p>{j?.reason}</p><p>{r.localStatus??'未配置本地仓库对照'}</p>
      <h4>证据（含本地对照）</h4><ul>{[...new Set([...r.evidence,...j?.evidence??[]])].map((e,i)=><li key={i}>{e}</li>)}</ul>
      {url?<a href={url} target="_blank" rel="noopener noreferrer">打开 GitHub 原链接</a>:<span>原链接格式不安全，未提供可点击入口</span>}
      {j&&<form onSubmit={e=>void fix(e)}>
        <label>纠正结论<select aria-label={'纠正结论 #'+r.number} value={value} onChange={e=>setValue(e.target.value as typeof value)}>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label>纠正理由<textarea style={control} maxLength={1200} aria-label={'纠正理由 #'+r.number} value={reason} onChange={e=>setReason(e.target.value)}/></label>
        <button type="submit" disabled={busy}>{busy?'提交中…':'提交纠正'}</button><p role="status">{notice}</p>
      </form>}
    </details>
  </article>
}
export function Results({reports,selected,call,onChanged}:{reports:Report[];selected:string;call:UiCall;onChanged:()=>Promise<void>}){
  const [kind,setKind]=useState('both')
  const report=reports.find(r=>r.repo===selected)
  return <section aria-label="研判结果"><h3>研判结果 · {selected||'请先选择仓库'}</h3>
    <label>结果类型<select aria-label="结果类型" value={kind} onChange={e=>setKind(e.target.value)}><option value="both">全部</option><option value="issue">issue</option><option value="pr">PR</option></select></label>
    {!report?<p>暂无报告，点击仓库的“立即分析”。</p>:<>
      <p>{new Date(report.at).toLocaleString()} · 本轮 {report.analyzed} / 复用 {report.reused}</p>
      <p>{report.businessStatus} · {report.localStatus}</p><p role="status">{report.modelStatus}</p>
      {report.warnings.map((w,i)=><p key={i}>{w}</p>)}
      {[...Object.entries(labels),['unassessed','仅规则预筛，未经 AI 研判']].map(([key,label])=>{
        const results=report.results.filter(r=>(r.judgment?.recommendation??'unassessed')===key&&(kind==='both'||kind===r.kind))
          .sort((a,b)=>['高','中','低'].indexOf(a.judgment?.priority??'低')-['高','中','低'].indexOf(b.judgment?.priority??'低')||a.number-b.number)
        return <section key={key} aria-label={label}><h4>{label}（{results.length}）</h4>{results.map(r=><Details key={selected+'#'+r.number} result={r} repo={selected} call={call} onChanged={onChanged}/>)}</section>
      })}
    </>}
  </section>
}
export function Dashboard({call}:{call:UiCall}){
  const [snapshot,setSnapshot]=useState<Snapshot>(),[error,setError]=useState(''),[edit,setEdit]=useState<Repo|null|undefined>(),[selected,setSelected]=useState(''),[models,setModels]=useState('')
  const [ruleRepo,setRuleRepo]=useState(''),[rules,setRules]=useState(''),[path,setPath]=useState(''),[ruleNotice,setRuleNotice]=useState(''),[deleting,setDeleting]=useState(''),[deleteBusy,setDeleteBusy]=useState(false)
  const alive=useRef(true),refreshSeq=useRef(0)
  async function refresh(){
    const seq=++refreshSeq.current
    try{const next=await call<Snapshot>({action:'snapshot'});if(alive.current&&seq===refreshSeq.current){setSnapshot(next);setSelected(s=>s||next.repositories[0]?.repo||'');setError('')}}
    catch(e){if(alive.current)setError(message(e))}
  }
  useEffect(()=>{alive.current=true;void refresh();return()=>{alive.current=false;refreshSeq.current++}},[call])
  const active=snapshot?.jobs.some(j=>j.status==='queued'||j.status==='running')
  useEffect(()=>{
    if(!active)return
    let disposed=false,timer:ReturnType<typeof setTimeout>|undefined
    const poll=async()=>{
      try{
        const jobs=await call<Job[]>({action:'jobs'})
        if(disposed)return
        setSnapshot(s=>s?{...s,jobs}:s)
        if(jobs.some(j=>j.status==='queued'||j.status==='running'))timer=setTimeout(()=>void poll(),1500)
        else await refresh()
      }catch(e){if(!disposed){setError(message(e));timer=setTimeout(()=>void poll(),5000)}}
    }
    timer=setTimeout(()=>void poll(),1500)
    return()=>{disposed=true;clearTimeout(timer)}
  },[active,call])
  async function showRules(repo:string){
    try{setRuleRepo(repo);setRules(await call<string>({action:'rules',repo}));setRuleNotice('')}catch(e){setRuleNotice(message(e))}
  }
  return <div style={{width:'min(980px,82vw)',maxHeight:'75vh',overflowY:'auto',padding:2,overflowWrap:'anywhere'}}>
    <div style={row}><button data-modal-autofocus onClick={()=>void refresh()}>刷新</button><button onClick={()=>setEdit(null)}>添加仓库</button></div>
    <p role="alert">{error}</p>
    {!snapshot?<p role="status">加载仓库和模型状态…</p>:<>
      <section style={box} aria-label="模型状态">
        <strong>模型：{snapshot.model.available?'已配置':'尚不可研判'}</strong>
        <p>启用：{snapshot.model.enabled?'是':'否'} · provider：{snapshot.model.provider||'未填写'} · model：{snapshot.model.model||'未填写'}</p>
        {!snapshot.model.available&&<p role="alert" style={{color:'var(--dsw-alias-error, #c33)'}}>{snapshot.model.warning} 请到 DSH 插件设置 → GitHub 仓库研判，分别填写 provider / model，并启用 modelEnabled。</p>}
        <button onClick={()=>void call<string>({action:'models'}).then(setModels).catch(e=>setError(message(e)))}>查看可复制的模型 ID</button>
        {models&&<pre style={{whiteSpace:'pre-wrap',userSelect:'text'}}>{models}</pre>}
      </section>
      {edit!==undefined&&<RepoForm key={edit?.repo??'new'} initial={edit??undefined} call={call} onCancel={()=>setEdit(undefined)} onSaved={async()=>{setEdit(undefined);await refresh()}}/>}
      <section aria-label="仓库列表"><h3>仓库列表（{snapshot.repositories.length}）</h3>
        {!snapshot.repositories.length&&<p>尚未配置仓库。点击“添加仓库”，填写 owner/repo 和业务说明。</p>}
        {snapshot.repositories.map(r=><section style={box} key={r.repo}>
          <div style={{...row,justifyContent:'space-between'}}><strong>{r.repo}</strong><span>{r.mode} · {r.schedule?.kind==='daily'?'每天 '+r.schedule.time:r.schedule?.kind==='every'?'每 '+r.schedule.hours+' 小时':'不定时'}</span></div>
          <p>本地：{r.localRepoPath||'未配置'} {r.localRef||''} · 业务：{r.business||r.businessFile||'未配置'}</p>
          <div style={row}><button onClick={()=>setEdit(r)}>编辑</button><button onClick={()=>setDeleting(r.repo)}>删除</button><button onClick={()=>setSelected(r.repo)}>查看结果</button><button onClick={()=>void showRules(r.repo)}>查看/导出规则</button></div>
          {deleting===r.repo&&<div role="alert"><p>停止跟踪 {r.repo}？保留历史报告与纠正。</p><button disabled={deleteBusy} onClick={()=>void(async()=>{setDeleteBusy(true);try{await call({action:'remove',repo:r.repo});setDeleting('');await refresh()}catch(e){setError(message(e))}finally{setDeleteBusy(false)}})()}>确认删除</button><button onClick={()=>setDeleting('')}>取消删除</button></div>}
          <hr/><ScanControl repo={r} job={snapshot.jobs.find(j=>j.repo===r.repo)} defaults={snapshot.defaults} call={call} onStarted={async()=>{setSelected(r.repo);await refresh()}}/>
        </section>)}
      </section>
      {!!snapshot.reports.length&&<label>查看报告<select aria-label="查看报告" value={selected} onChange={e=>setSelected(e.target.value)}>{[...new Set([...snapshot.repositories.map(r=>r.repo),...snapshot.reports.map(r=>r.repo)])].map(r=><option key={r}>{r}</option>)}</select></label>}
      <Results reports={snapshot.reports} selected={selected} call={call} onChanged={refresh}/>
      {ruleRepo&&<section style={box} aria-label="仓库规则"><h3>规则 · {ruleRepo}</h3><pre style={{whiteSpace:'pre-wrap',maxHeight:240,overflowY:'auto',userSelect:'text'}}>{rules}</pre>
        <label>导出路径（绝对路径，不覆盖已有文件）<input style={control} aria-label="导出路径" value={path} onChange={e=>setPath(e.target.value)}/></label>
        <button onClick={()=>void call<string>({action:'export',repo:ruleRepo,path}).then(setRuleNotice).catch(e=>setRuleNotice(message(e)))}>导出规则</button><button onClick={()=>setRuleRepo('')}>收起规则</button><p role="status">{ruleNotice}</p>
      </section>}
    </>}
    <small>只读取 GitHub 和本地代码。规则仅导出到你指定的新文件。AI 判断仍需复现与审查。</small>
  </div>
}
export function TriageButton({call,sessionId}:{call:UiCall;sessionId:string}){
  const [open,setOpen]=useState(false)
  useEffect(()=>setOpen(false),[sessionId])
  return <><button title="配置仓库、业务与本地代码，查看 GitHub 研判" onClick={()=>setOpen(true)}>GitHub 仓库研判</button>
    <Modal open={open} onClose={()=>setOpen(false)} title="GitHub 仓库研判" closeLabel="关闭研判面板">{open&&<Dashboard call={call}/>}</Modal>
  </>
}
export function apply(ctx:Context):void{
  const Button=(props:PropsRuntime<'conversation.session.header.actions'>)=>{
    const call=useRef<UiCall>()
    const session=useRef(props.sessionId)
    if(!call.current||session.current!==props.sessionId){session.current=props.sessionId;call.current=commandCall((...args)=>ctx.remote.commands.execute(...args),props.sessionId)}
    return <TriageButton key={props.sessionId} sessionId={props.sessionId} call={call.current}/>
  }
  ctx.slots.inject('conversation.session.header.actions',()=>ctx.slots.register({name:'conversation.session.header.actions',id:'dsh-github-triage',order:160},Button))
}
