import {useState,useRef,type FormEvent} from 'react'
import {z} from 'zod'
import type {Repo} from './types.js'
import {editableRepoSchema,changedFields,fieldErrors,scanSchema,type Snapshot,type Job,type UiCall} from './ui-contract.js'
import {UiError} from './client-route.js'
function message(error:unknown):string{return error instanceof Error?error.message:'操作失败，请刷新重试。'}
function Errors({errors,name}:{errors:Record<string,string>;name:string}){
  const error=Object.entries(errors).filter(([key])=>key===name||key.startsWith(name+'.')).map(([,v])=>v).join('；')
  return error?<span role="alert" className="gt-field-error">{error}</span>:null
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
  const text=(key:'repo'|'businessFile'|'localRepoPath'|'localRef'|'rulesFile'|'limit'|'fullMax',label:string)=><label>{label}<input className="gt-input" aria-label={label} value={form[key]} disabled={key==='repo'&&!!initial} onChange={e=>field(key,e.target.value)}/><Errors errors={errors} name={key}/></label>
  return <form onSubmit={e=>void submit(e)} className="gt-form" aria-label={initial?'编辑仓库':'添加仓库'} noValidate>
    <h3>{initial?'编辑仓库':'添加仓库'}</h3>
    <div className="gt-form-grid">
      <h4 className="gt-form-section">仓库</h4>{text('repo','GitHub 仓库（owner/repo）')}
      <label>分析类型<select className="gt-input" aria-label="分析类型" value={form.mode} onChange={e=>field('mode',e.target.value)}><option value="both">问题与代码改动（两者）</option><option value="issues">仅 issues</option><option value="prs">仅 PR</option></select><Errors errors={errors} name="mode"/></label>
      <h4 className="gt-form-section">本地代码对照</h4>{text('localRepoPath','本地代码路径（可空，绝对路径）')}{text('localRef','本地 ref（可空，默认 HEAD）')}
      <h4 className="gt-form-section">业务与规则</h4>{text('businessFile','业务说明文件（仓库相对路径或本机绝对路径）')}
      {text('rulesFile','只读规则文件（可空，本机绝对路径）')}
      <h4 className="gt-form-section">定时与上限</h4>{text('limit','普通分析单次上限（1–100，空为继承）')}{text('fullMax','全量单次上限（1–500，空为继承）')}
      <label>定时<select className="gt-input" aria-label="定时" value={form.schedule} onChange={e=>field('schedule',e.target.value)}><option value="none">不定时</option><option value="daily">每天 HH:MM</option><option value="every">每 N 小时</option></select>
        {form.schedule==='daily'&&<input className="gt-input" aria-label="每天时间" value={form.time} onChange={e=>field('time',e.target.value)}/>}
        {form.schedule==='every'&&<input className="gt-input" aria-label="间隔小时" value={form.hours} onChange={e=>field('hours',e.target.value)}/>}
        <Errors errors={errors} name="schedule"/>
      </label>
    </div>
    <label>业务说明<textarea className="gt-input gt-textarea" aria-label="业务说明" value={form.business} onChange={e=>field('business',e.target.value)} placeholder="产品做什么、核心用户场景、哪些问题重要、哪些方向暂不需要"/><Errors errors={errors} name="business"/></label>
    <p>业务文字、规则和选定 ref 的已提交代码片段会交给所选模型。插件不修改 GitHub 或本地代码；定时需要 DSH 持续运行。</p>
    <Errors errors={errors} name="form"/><p role="alert">{notice}</p>
    <div className="gt-row"><button type="submit" disabled={busy}>{busy?'保存中…':'保存仓库'}</button><button type="button" disabled={busy} onClick={onCancel}>取消编辑</button></div>
  </form>
}
export function ScanControl({repo,job,defaults,call,onStarted,initialFull=false}:{repo:Repo;job?:Job;defaults:Snapshot['defaults'];call:UiCall;onStarted:()=>Promise<void>;initialFull?:boolean}){
  const [full,setFull]=useState(initialFull),[since,setSince]=useState(''),[until,setUntil]=useState(''),[limit,setLimit]=useState('')
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
    <div className="gt-row"><label><input type="checkbox" checked={full} onChange={e=>{setFull(e.target.checked);setLimit('')}}/>全量（含关闭条目）</label>
      {full&&<><label>开始日期<input className="gt-input" aria-label={'开始日期 '+repo.repo} type="date" value={since} onChange={e=>setSince(e.target.value)}/></label><label>结束日期<input className="gt-input" aria-label={'结束日期 '+repo.repo} type="date" value={until} onChange={e=>setUntil(e.target.value)}/></label></>}
      <label>本次上限<input className="gt-input gt-limit" aria-label={'本次上限 '+repo.repo} value={limit} placeholder={String(full?(repo.fullMax??defaults.fullMax):(repo.limit??defaults.limit))} onChange={e=>setLimit(e.target.value)}/></label>
      <button disabled={active} onClick={()=>void start()}>{active?'分析进行中…':'立即分析'}</button>
      {job&&<span role="status">{({queued:'排队中',running:'进行中',completed:'完成',failed:'失败'})[job.status]} {job.message}</span>}
    </div>
    {full&&<small>按最后更新时间筛选，达到上限会截断；全量增加 GitHub 请求与模型费用。</small>}
    <p role="alert">{error}</p>
  </div>
}
