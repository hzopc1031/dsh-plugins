import {useState,useRef,useId,type FormEvent} from 'react'
import {Input} from '@deepseek-ai/dsh-client-ui-primitives'
import {z} from 'zod'
import type {Repo} from './types.js'
import {repoName} from './types.js'
import {editableRepoSchema,changedFields,fieldErrors,scanSchema,type Snapshot,type Job,type UiCall} from './ui-contract.js'
import {UiError} from './client-route.js'
function message(error:unknown):string{return error instanceof Error?error.message:'操作失败，请刷新重试。'}
function Errors({errors,name,id}:{errors:Record<string,string>;name:string;id?:string}){
  const error=Object.entries(errors).filter(([key])=>key===name||key.startsWith(name+'.')).map(([,v])=>v).join('；')
  return error?<span id={id} role="alert" className="gt-field-error">{error}</span>:null
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
  const id=useId(),fieldId=(key:string)=>id+'-'+key
  const invalid=(key:string)=>Object.keys(errors).some(name=>name===key||name.startsWith(key+'.'))
  const described=(key:string)=>[fieldId(key)+'-hint',invalid(key)?fieldId(key)+'-error':''].filter(Boolean).join(' ')
  const field=(key:keyof typeof form,value:string)=>{
    dirty.current.add(['schedule','time','hours'].includes(key)?'schedule':key)
    setForm(f=>({...f,[key]:value}))
  }
  function normalizeRepo(){
    const parsed=repoName.safeParse(form.repo)
    if(parsed.success){setForm(f=>({...f,repo:parsed.data}));setErrors(e=>{const next={...e};delete next.repo;return next})}
    else setErrors(e=>({...e,repo:parsed.error.issues[0].message}))
  }
  async function submit(e:FormEvent){
    e.preventDefault();if(busy)return
    setErrors({});setNotice('')
    try{
      const parsed=repoName.safeParse(form.repo)
      if(parsed.success)setForm(f=>({...f,repo:parsed.data}))
      const value=editableRepoSchema.parse({
        repo:parsed.success?parsed.data:form.repo,mode:form.mode,business:form.business||undefined,businessFile:form.businessFile||undefined,
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
  const text=(key:'repo'|'businessFile'|'localRepoPath'|'localRef'|'rulesFile'|'limit'|'fullMax',label:string,hint:string)=>{
    const path=['businessFile','localRepoPath','rulesFile'].includes(key)
    return <div className={'gt-form-field'+(path||key==='repo'?' gt-field-wide':'')}>
      <label htmlFor={fieldId(key)}>{label}</label>
      <Input id={fieldId(key)} className="gt-input" aria-label={label} aria-invalid={invalid(key)||undefined}
        aria-describedby={described(key)} value={form[key]} title={path?form[key]:undefined}
        inputMode={key==='limit'||key==='fullMax'?'numeric':undefined} data-modal-autofocus={key==='repo'?true:undefined}
        disabled={busy||key==='repo'&&!!initial} onBlur={key==='repo'?normalizeRepo:undefined} onChange={e=>field(key,e.target.value)}/>
      <small id={fieldId(key)+'-hint'} className="gt-field-hint">{hint}</small>
      <Errors errors={errors} name={key} id={fieldId(key)+'-error'}/>
      {path&&form[key]&&<code className="gt-path-preview" aria-label={label+'完整值'}>{form[key]}</code>}
    </div>
  }
  return <form onSubmit={e=>void submit(e)} className="gt-form" aria-label={initial?'编辑仓库':'添加仓库'} noValidate>
    <header className="gt-form-head"><h3>{initial?'编辑仓库':'添加仓库'}</h3><button type="button" aria-label="关闭仓库表单" disabled={busy} onClick={onCancel}>关闭</button></header>
    <div className="gt-form-body">
      <fieldset className="gt-form-section" disabled={busy}><legend>仓库</legend><div className="gt-form-grid">
        {text('repo','GitHub 仓库（owner/repo）','可粘贴 https://github.com/owner/repo、子页面或 Git SSH 地址；离开输入框后整理为 owner/repo。')}
        <div className="gt-form-field"><label htmlFor={fieldId('mode')}>分析类型</label><select id={fieldId('mode')} className="gt-input" aria-label="分析类型" aria-invalid={invalid('mode')||undefined} aria-describedby={described('mode')} value={form.mode} onChange={e=>field('mode',e.target.value)}><option value="both">问题与代码改动（两者）</option><option value="issues">仅 issues</option><option value="prs">仅 PR</option></select><small id={fieldId('mode')+'-hint'} className="gt-field-hint">选择要跟踪的待办类型。</small><Errors errors={errors} name="mode" id={fieldId('mode')+'-error'}/></div>
      </div></fieldset>
      <fieldset className="gt-form-section" disabled={busy}><legend>本地代码</legend><div className="gt-form-grid">
        {text('localRepoPath','本地代码路径（可空，绝对路径）','填写本机 Git 仓库根目录；只读取已提交代码，不读取未提交修改。')}
        {text('localRef','本地 ref（可空，默认 HEAD）','分支或提交；需先填写本地代码路径。')}
      </div></fieldset>
      <fieldset className="gt-form-section" disabled={busy}><legend>业务说明</legend><div className="gt-form-grid">
        <div className="gt-form-field gt-field-wide"><label htmlFor={fieldId('business')}>业务说明</label><textarea id={fieldId('business')} className="gt-input gt-textarea" aria-label="业务说明" aria-invalid={invalid('business')||undefined} aria-describedby={described('business')} value={form.business} onChange={e=>field('business',e.target.value)} placeholder="产品做什么、核心用户场景、哪些问题重要、哪些方向暂不需要"/><small id={fieldId('business')+'-hint'} className="gt-field-hint">与业务文件内容一同用于判断，可拖动下边缘调整高度。</small><Errors errors={errors} name="business" id={fieldId('business')+'-error'}/></div>
        {text('businessFile','业务说明文件（仓库相对路径或本机绝对路径）','相对路径读取 GitHub 默认分支；本机文件只读，限 16KB。')}
        {text('rulesFile','只读规则文件（可空，本机绝对路径）','可选本机 UTF-8 文件，限 16KB。')}
      </div></fieldset>
      <fieldset className="gt-form-section" disabled={busy}><legend>定时与上限</legend><div className="gt-form-grid">
        {text('limit','普通分析单次上限（1–100，空为继承）','留空使用插件默认上限。')}{text('fullMax','全量单次上限（1–500，空为继承）','全量分析会增加 GitHub 请求与模型费用。')}
        <div className="gt-form-field"><label htmlFor={fieldId('schedule')}>定时</label><select id={fieldId('schedule')} className="gt-input" aria-label="定时" aria-invalid={invalid('schedule')||undefined} aria-describedby={described('schedule')} value={form.schedule} onChange={e=>field('schedule',e.target.value)}><option value="none">不定时</option><option value="daily">每天 HH:MM</option><option value="every">每 N 小时</option></select>
          <small id={fieldId('schedule')+'-hint'} className="gt-field-hint">按本地时间运行；需要 DSH 持续运行。</small><Errors errors={errors} name="schedule" id={fieldId('schedule')+'-error'}/>
        </div>
        {form.schedule!=='none'&&<div className="gt-form-field"><label htmlFor={fieldId('timing')}>{form.schedule==='daily'?'每天时间':'间隔小时'}</label><Input id={fieldId('timing')} className="gt-input" aria-label={form.schedule==='daily'?'每天时间':'间隔小时'} aria-invalid={invalid('schedule')||undefined} aria-describedby={described('schedule')} value={form.schedule==='daily'?form.time:form.hours} onChange={e=>field(form.schedule==='daily'?'time':'hours',e.target.value)}/></div>}
      </div></fieldset>
      <p className="gt-field-hint">业务文字、规则和选定 ref 的已提交代码片段会交给所选模型。插件不修改 GitHub 或本地代码。</p>
    </div>
    <footer className="gt-form-footer"><Errors errors={errors} name="form"/>{notice&&<p role="alert" className="gt-field-error">{notice}</p>}
      <div className="gt-form-actions"><button type="button" disabled={busy} onClick={onCancel}>取消编辑</button><button type="submit" className="gt-primary" disabled={busy}>{busy?'保存中…':'保存仓库'}</button></div>
    </footer>
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
