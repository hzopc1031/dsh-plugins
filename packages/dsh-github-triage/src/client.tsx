import type {Context} from '@deepseek-ai/cordis'
export type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
export type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
export type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {PropsRuntime} from '@deepseek-ai/dsh-client-ui-slots'
import {Modal} from '@deepseek-ai/dsh-client-ui-primitives'
import {useState,useEffect,useRef,useMemo,type FormEvent,type ReactNode} from 'react'
import type {Repo,Result} from './types.js'
import type {Snapshot,Job,UiCall,UiResult,UiReport} from './ui-contract.js'
import {commandCall,postCall} from './client-route.js'
import {RepoForm,ScanControl} from './client-forms.js'
import {Branch,Plus,Settings,Search,Clock} from './client-icons.js'
import css from './client.css'
export {RepoForm,commandCall,postCall}
export {UiError} from './client-route.js'

// Official rc.5/rc.1 contracts; these packages are provided by the host.
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'main':{kind:'keyed';scope:'root'}
    'sidebar.panellist':{kind:'list';scope:'root';owner:{size:number;active:boolean}}
  }
  interface LocaleNamespaceMap {'github-triage':'title'}
}
export const inject=['slots']
export const PANEL_ID='dsh-github-triage'
const NS='github-triage'
const labels={adopt:'建议采纳','manual-review':'需人工看','not-recommended':'不推荐'}
const statusLabels={queued:'排队中',running:'进行中',completed:'完成',failed:'失败'}
const message=(e:unknown)=>e instanceof Error?e.message:'操作失败，请重试。'
const date=(at?:number)=>at?new Date(at).toLocaleString('zh-CN',{hour12:false}):'尚未运行'
const activeJob=(job?:Job)=>job?.status==='running'||job?.status==='queued'
function Badge({tone='',children}:{tone?:string;children:ReactNode}){return <span className={'gt-badge gt-'+tone}>{children}</span>}
export function safeLink(raw:string):string|undefined {
  try{const u=new URL(raw);if(u.origin==='https://github.com'&&!u.username&&!u.password&&/^\/[^/]+\/[^/]+\/(?:issues|pull)\/\d+$/.test(u.pathname)&&!u.search&&!u.hash)return u.href}catch{}
}
function Details({result:r,repo,call,onChanged}:{result:Result;repo:string;call:UiCall;onChanged:()=>Promise<void>}) {
  const j=r.judgment,[value,setValue]=useState(j?.recommendation??'manual-review'),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
  async function fix(e:FormEvent){
    e.preventDefault();if(busy)return;setNotice('')
    if(!reason.trim()){setNotice('请填写纠正理由');return}
    setBusy(true)
    try{await call({action:'fix',repo,number:r.number,recommendation:value,reason});setReason('');setNotice('已保存纠正并沉淀规则');await onChanged()}
    catch(e){setNotice(message(e))}finally{setBusy(false)}
  }
  return <div className="gt-detail">
    {!j?<p className="gt-muted">仅规则预筛，未经 AI 研判。{r.modelNote}</p>:<>
      <div className="gt-detail-grid"><section><h4>业务判断</h4><p>{j.businessReason}</p><p>{j.reason}</p>
        <p>{j.kind==='issue'?'真实存在：'+j.exists+' · '+j.worthFixing:j.verdict+' · 符合业务方向：'+j.fitsDirection+' · 风险：'+j.risk}</p>
        {j.kind==='pr'&&<p>测试：{j.testing}</p>}</section>
        <section><h4>本地代码对照</h4><p>{j.localApplicability} · {j.localReason}</p><p>{r.localStatus??'未配置本地仓库对照'}</p></section></div>
    </>}
    <h4>证据与规则命中</h4><p>{r.observation}</p><ul>{[...new Set([...r.evidence,...j?.evidence??[]])].map((e,i)=><li key={i}>{e}</li>)}</ul>
    {j&&<form aria-label={'纠正 #'+r.number} onSubmit={e=>void fix(e)} className="gt-correction">
      <h4>纠正结论 <span className="gt-muted">保存后形成该仓库的参考规则</span></h4>
      <div className="gt-row"><label>纠正结论<select className="gt-input" aria-label={'纠正结论 #'+r.number} value={value} onChange={e=>setValue(e.target.value as typeof value)}>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label className="gt-grow">纠正理由<textarea className="gt-input" maxLength={1200} aria-label={'纠正理由 #'+r.number} value={reason} onChange={e=>setReason(e.target.value)} placeholder="说明适用业务背景和判断依据" required/></label>
      <button type="submit" disabled={busy}>{busy?'提交中…':'提交纠正'}</button></div><p role="status">{notice}</p>
    </form>}
  </div>
}
function DeferredDetails({r,repo,call,onChanged}:{r:UiResult;repo:string;call:UiCall;onChanged:()=>Promise<void>}) {
  const [detail,setDetail]=useState<Result>(),[error,setError]=useState(''),[retry,setRetry]=useState(0)
  useEffect(()=>{
    let alive=true;setDetail(undefined);setError('')
    void call<Result>({action:'detail',repo,number:r.number}).then(value=>{if(alive)setDetail(value)}).catch(e=>{if(alive)setError(message(e))})
    return()=>{alive=false}
  },[call,repo,r,retry])
  if(error)return <div className="gt-error" role="alert">{error}<button onClick={()=>setRetry(v=>v+1)}>重试详情</button></div>
  return detail?<Details result={detail} repo={repo} call={call} onChanged={onChanged}/>:<div className="gt-detail gt-skeleton" role="status" aria-label="加载详情"><b/><i/><i/></div>
}
function ResultCard({r,repo,call,onChanged}:{r:UiResult;repo:string;call:UiCall;onChanged:()=>Promise<void>}) {
  const [open,setOpen]=useState(false),url=safeLink(r.url)
  return <article className={'gt-card gt-result '+(open?'gt-result-open':'')}>
    <div className="gt-row"><Badge tone={r.judgment?.recommendation??'neutral'}>{r.judgment?labels[r.judgment.recommendation]:'仅规则预筛'}</Badge><span className="gt-muted">{r.kind==='issue'?'issue':'PR'}</span><span className="gt-muted">{repo}</span><span className="gt-priority">{r.judgment?.priority??'—'}优先级</span></div>
    <button className="gt-result-title" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>#{r.number} {r.title}<span aria-hidden="true">{open?'−':'+'}</span></button>
    <p className="gt-summary">{r.judgment?.businessReason??r.modelNote??'仅规则预筛，未经 AI 研判'}</p>
    <div className="gt-row gt-result-foot"><span className="gt-muted">{r.source==='correction'?'用户纠正':r.source==='model'?'AI 研判':'规则预筛'}</span><button className="gt-link" onClick={()=>setOpen(v=>!v)}>{open?'收起详情':'查看详情与纠正'}</button>{url&&<a href={url} target="_blank" rel="noopener noreferrer">打开 GitHub 原链接 ↗</a>}</div>
    {open&&('deferred' in r?<DeferredDetails r={r} repo={repo} call={call} onChanged={onChanged}/>:<Details result={r} repo={repo} call={call} onChanged={onChanged}/>)}
  </article>
}
export function Results({reports,selected,call,onChanged,onSelect}:{reports:UiReport[];selected:string;call:UiCall;onChanged:()=>Promise<void>;onSelect?:(repo:string)=>void}) {
  const [kind,setKind]=useState('both'),[tier,setTier]=useState('all'),[search,setSearch]=useState(''),[sort,setSort]=useState('priority'),[count,setCount]=useState(30)
  const sentinel=useRef<HTMLDivElement>(null)
  const rows=useMemo(()=>reports.filter(r=>!selected||r.repo===selected).flatMap(report=>report.results.map(r=>({r,repo:report.repo,at:report.at}))),[reports,selected])
  const filtered=useMemo(()=>rows.filter(({r,repo})=>(kind==='both'||r.kind===kind)&&(tier==='all'||(r.judgment?.recommendation??'unassessed')===tier)&&(!search||[r.title,r.number,repo,r.judgment?.businessReason].join(' ').toLocaleLowerCase().includes(search.toLocaleLowerCase()))).sort((a,b)=>sort==='recent'?b.at-a.at||b.r.number-a.r.number:sort==='number'?b.r.number-a.r.number:['高','中','低'].indexOf(a.r.judgment?.priority??'低')-['高','中','低'].indexOf(b.r.judgment?.priority??'低')||b.at-a.at),[rows,kind,tier,search,sort])
  useEffect(()=>setCount(30),[kind,tier,search,sort,selected])
  useEffect(()=>{
    const node=sentinel.current;if(!node||typeof IntersectionObserver==='undefined')return
    const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))setCount(c=>Math.min(c+30,filtered.length))},{rootMargin:'200px'})
    observer.observe(node);return()=>observer.disconnect()
  },[count,filtered.length])
  return <section aria-label="研判结果" className="gt-results">
    <div className="gt-section-head"><h2><Branch size={18}/>研判结果 <Badge>{filtered.length}</Badge></h2><span className="gt-muted">围绕业务价值决定下一步</span></div>
    <div className="gt-toolbar">
      <div className="gt-segment" role="group" aria-label="结论筛选">{[['all','全部'],...Object.entries(labels),['unassessed','仅规则预筛']].map(([key,label])=><button key={key} aria-pressed={tier===key} className={tier===key?'gt-on':''} onClick={()=>setTier(key)}>{label}（{rows.filter(({r})=>key==='all'||(r.judgment?.recommendation??'unassessed')===key).length}）</button>)}</div>
      <label className="gt-search"><Search size={16}/><input aria-label="搜索结果" placeholder="搜索标题、编号、业务理由…" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button aria-label="清空搜索" onClick={()=>setSearch('')}>×</button>}</label>
      <select className="gt-input" aria-label="结果类型" value={kind} onChange={e=>setKind(e.target.value)}><option value="both">全部类型</option><option value="issue">issue</option><option value="pr">PR</option></select>
      <select className="gt-input" aria-label="结果排序" value={sort} onChange={e=>setSort(e.target.value)}><option value="priority">优先级优先</option><option value="recent">最近分析</option><option value="number">编号倒序</option></select>
    </div>
    {onSelect&&<div className="gt-chips" role="group" aria-label="仓库筛选">{['',...new Set(reports.map(r=>r.repo))].map(repo=><button key={repo} className={selected===repo?'gt-chip gt-chip-on':'gt-chip'} aria-pressed={selected===repo} onClick={()=>onSelect(repo)}>{repo||'全部仓库'}</button>)}</div>}
    {reports.filter(r=>!selected||r.repo===selected).map(r=><details className="gt-report-note" key={r.repo}><summary>{r.repo} · {date(r.at)} · 本轮 {r.analyzed} / 复用 {r.reused}</summary><p>{r.businessStatus} · {r.localStatus} · {r.modelStatus}</p><p>{r.rulesStatus}</p>{r.warnings.map((w,i)=><p key={i} className="gt-warn">{w}</p>)}</details>)}
    {!filtered.length?<div className="gt-empty"><Search size={28}/><h3>{rows.length?'没有匹配结果':'还没有研判结果'}</h3><p>{rows.length?'调整结论、类型或搜索词后重试。':'添加仓库并点击“立即分析”，判断依据会显示在这里。'}</p></div>:filtered.slice(0,count).map(({r,repo})=><ResultCard key={repo+'#'+r.number} r={r} repo={repo} call={call} onChanged={onChanged}/>)}
    {count<filtered.length&&<div ref={sentinel} className="gt-more"><button onClick={()=>setCount(c=>c+30)}>加载更多结果（{count} / {filtered.length}）</button></div>}
  </section>
}
function Skeleton(){return <div aria-label="加载仓库和模型状态" role="status" aria-busy="true"><div className="gt-kpis">{Array.from({length:6},(_,i)=><div className="gt-stat gt-skeleton" key={i}><i/><b/><i/></div>)}</div><div className="gt-repos">{[0,1,2].map(i=><div className="gt-card gt-repo gt-skeleton" key={i}><b/><i/><i/><i/></div>)}</div><div className="gt-card gt-skeleton"><b/><i/><i/></div><span className="gt-sr">加载仓库和模型状态…</span></div>}
function Rules({repo,call,onClose}:{repo:string;call:UiCall;onClose:()=>void}) {
  const [text,setText]=useState<string>(),[draft,setDraft]=useState(''),[path,setPath]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0)
  useEffect(()=>{let alive=true;setNotice('');void call<string>({action:'rules',repo}).then(v=>{if(alive){setText(v);setDraft(v)}}).catch(e=>{if(alive)setNotice(message(e))});return()=>{alive=false}},[call,repo,retry])
  async function action(kind:'copy'|'export'|'import'){
    if(busy||text===undefined)return;setBusy(true);setNotice('')
    try{
      if(kind==='copy'){await navigator.clipboard.writeText(text);setNotice('规则已复制')}
      else if(kind==='export')setNotice(await call<string>({action:'export',repo,path}))
      else {setNotice(await call<string>({action:'import',repo,text:draft}));setText(await call<string>({action:'rules',repo}))}
    }catch(e){setNotice(message(e))}finally{setBusy(false)}
  }
  return <section className="gt-card" aria-label="仓库规则"><div className="gt-section-head"><h2>规则 · {repo}</h2><button onClick={onClose}>收起规则</button></div>
    {text===undefined?(notice?<button onClick={()=>setRetry(v=>v+1)}>重试规则</button>:<p role="status">正在读取规则…</p>):<><pre className="gt-rule-text">{text}</pre><div className="gt-row"><button disabled={busy} onClick={()=>void action('copy')}>复制规则</button><label className="gt-grow">导出为新文件<input className="gt-input" aria-label="导出路径" value={path} onChange={e=>setPath(e.target.value)} placeholder="本机绝对路径，不覆盖已有文件"/></label><button disabled={busy||!path.trim()} onClick={()=>void action('export')}>导出规则</button></div>
    <details className="gt-rule-import"><summary>导入规则</summary><p className="gt-muted">粘贴同一仓库的规则文档（最多 16KB），首行必须为 # GitHub triage rules: {repo}。导入替换手工文档，历史纠正保留。</p><textarea className="gt-input gt-rule-editor" aria-label="导入规则文档" value={draft} onChange={e=>setDraft(e.target.value)}/><button disabled={busy||!draft.trim()} onClick={()=>void action('import')}>确认导入规则</button></details></>}
    <p role="status">{notice}</p></section>
}
export function Dashboard({call,openSettings}:{call:UiCall;openSettings?:()=>boolean}) {
  const [snapshot,setSnapshot]=useState<Snapshot>(),[error,setError]=useState(''),[edit,setEdit]=useState<Repo|null|undefined>(),[selected,setSelected]=useState(''),[models,setModels]=useState(''),[guide,setGuide]=useState(false)
  const [networkInfo,setNetworkInfo]=useState('')
  const [ruleRepo,setRuleRepo]=useState(''),[deleting,setDeleting]=useState(''),[busy,setBusy]=useState(false),[scan,setScan]=useState<{repo:Repo;full:boolean}>()
  const alive=useRef(true),seq=useRef(0)
  async function refresh(){
    const n=++seq.current
    try{const next=await call<Snapshot>({action:'snapshot',compact:true});if(alive.current&&seq.current===n){setSnapshot(next);setError('')}}catch(e){if(alive.current&&seq.current===n)setError(message(e))}
  }
  useEffect(()=>{alive.current=true;setSnapshot(undefined);setError('');void refresh();return()=>{alive.current=false;seq.current++}},[call])
  const active=snapshot?.jobs.some(activeJob)
  useEffect(()=>{
    if(!active)return
    let disposed=false,timer:ReturnType<typeof setTimeout>|undefined
    const poll=async()=>{
      try{const jobs=await call<Job[]>({action:'jobs'});if(disposed)return;setSnapshot(s=>s?{...s,jobs}:s);if(jobs.some(activeJob))timer=setTimeout(()=>void poll(),1500);else await refresh()}
      catch(e){if(!disposed){setError(message(e));timer=setTimeout(()=>void poll(),5000)}}
    }
    timer=setTimeout(()=>void poll(),1500);return()=>{disposed=true;clearTimeout(timer)}
  },[active,call])
  async function all(){
    if(!snapshot||busy)return;setBusy(true)
    try{for(const repo of snapshot.repositories)await call({action:'start',repo:repo.repo,scan:{}});await refresh()}catch(e){await refresh();setError(message(e))}finally{setBusy(false)}
  }
  function settings(){if(!openSettings?.())setGuide(true)}
  const reports=snapshot?.reports??[],results=reports.flatMap(r=>r.results),latest=reports.reduce((n,r)=>Math.max(n,r.at),0),lastJob=snapshot?.jobs.reduce<Job|undefined>((a,b)=>(b.at??0)>=(a?.at??0)?b:a,undefined)
  return <div className="gt-page"><div className="gt-scroll"><div className="gt-content">
    <header className="gt-page-head"><div><div className="gt-eyebrow">GITHUB TRIAGE</div><h1>GitHub 哨兵</h1><p className="gt-muted">从仓库待办到下一步，把判断依据放在一起。</p></div>
      <div className="gt-head-actions"><button className="gt-pill" disabled={busy} onClick={()=>void call<string>({action:'detect-proxy'}).then(setNetworkInfo).catch(e=>setError(message(e)))}>从系统检测代理</button><button className="gt-pill" disabled={busy} onClick={()=>void call<string>({action:'diagnose'}).then(setNetworkInfo).catch(e=>setError(message(e)))}>网络诊断</button><button className="gt-pill" onClick={settings}><Settings size={14}/>插件设置</button>
      {snapshot&&<button className={'gt-pill '+(snapshot.model.available?'':'gt-warn')} onClick={()=>setGuide(v=>!v)}>{snapshot.model.available?snapshot.model.provider+' / '+snapshot.model.model:'模型未配置 · 查看指引'}</button>}
      <button className="gt-primary" disabled={!snapshot?.repositories.length||busy||active} onClick={()=>void all()}>{busy?'提交中…':'全部分析'}</button></div></header>
    {networkInfo&&<section className="gt-card" role="status"><h2>代理与网络诊断</h2><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{networkInfo}</pre><p>需要固定代理时，在插件设置填写 httpsProxy；清空恢复自动检测。</p></section>}
    {error&&<div className="gt-error" role="alert"><span>{error}</span><button onClick={()=>void refresh()}>重试</button></div>}
    {!snapshot?(!error&&<Skeleton/>):<>
      {(guide||!snapshot.model.available)&&<section className="gt-card gt-model" aria-label="模型状态"><div className="gt-section-head"><h2><Settings size={18}/>模型：{snapshot.model.available?'已配置':'尚不可研判'}</h2><button onClick={()=>void call<string>({action:'models'}).then(setModels).catch(e=>setError(message(e)))}>查看可复制的模型 ID</button></div>
        <p>启用：{snapshot.model.enabled?'是':'否'} · provider：{snapshot.model.provider||'未填写'} · model：{snapshot.model.model||'未填写'}</p><p className="gt-muted">{snapshot.model.warning} 在 DSH 插件设置 → GitHub 哨兵，分别填写 provider / model，并启用 modelEnabled。使用 DSH 已注册的模型路由 ID。</p>{models&&<pre className="gt-rule-text">{models}</pre>}</section>}
      <section className="gt-kpis" aria-label="分析概览">
        <div className="gt-stat"><span>跟踪仓库</span><b>{snapshot.repositories.length}</b><small>issues / PR</small></div>
        <div className="gt-stat"><span>待处理条目</span><b>{results.length}</b><small>最新报告中的条目</small></div>
        {Object.entries(labels).map(([key,label])=><div className={'gt-stat gt-'+key} key={key}><span>{label}</span><b>{results.filter(r=>r.judgment?.recommendation===key).length}</b><small>{key==='adopt'?'优先安排复现或审查':key==='manual-review'?'需要补充判断':'暂不建议投入'}</small></div>)}
        <div className="gt-stat gt-run-stat"><span>最近运行 · {lastJob?statusLabels[lastJob.status]:latest?'完成':'未开始'}</span><b>{active?'分析中':latest?'已更新':'—'}</b><small title={date(lastJob?.at??latest)}>{date(lastJob?.at??latest)}</small></div>
      </section>
      <section aria-label="仓库列表"><div className="gt-section-head"><h2><Branch size={18}/>仓库列表（{snapshot.repositories.length}）</h2><div className="gt-row"><button onClick={()=>void refresh()}>刷新</button><button className="gt-primary" onClick={()=>setEdit(null)}><Plus size={14}/>添加仓库</button></div></div>
      {!snapshot.repositories.length?<div className="gt-empty gt-onboarding"><Branch size={32}/><h3>让仓库待办有个先后</h3><p>三步得到第一份判断报告</p><div className="gt-steps"><button onClick={settings}><b>01</b>配置模型<span>选择 provider 与 model</span></button><button onClick={()=>setEdit(null)}><b>02</b>添加仓库<span>填写 owner/repo 与业务</span></button><div><b>03</b>立即分析<span>查看结论、证据与本地对照</span></div></div></div>:<div className="gt-repos">{snapshot.repositories.map(r=>{
        const job=snapshot.jobs.find(j=>j.repo===r.repo),report=reports.find(v=>v.repo===r.repo),running=activeJob(job)
        return <section className="gt-card gt-repo" key={r.repo} aria-label={'仓库 '+r.repo}><div className="gt-row"><Branch size={18}/><h3>{r.repo}</h3><Badge>{r.mode}</Badge></div>
          <p className="gt-schedule"><Clock size={13}/>{r.schedule?.kind==='daily'?'每天 '+r.schedule.time:r.schedule?.kind==='every'?'每 '+r.schedule.hours+' 小时':'不定时'}</p>
          <p className="gt-summary" title={r.business||r.businessFile}>{r.business||r.businessFile||'尚未填写业务说明，按通用标准研判'}</p>
          <div className="gt-local"><span>本地代码</span><code title={r.localRepoPath}>{r.localRepoPath||'未配置本地对照'}</code><small>{r.localRepoPath?'ref: '+(r.localRef||'HEAD'):'添加路径后可对照已提交代码'}</small>{report?.localStatus&&<small>{report.localStatus}</small>}</div>
          <div className="gt-run" role="status"><Badge tone={running?'manual-review':job?.status==='failed'?'error':'neutral'}>{job?statusLabels[job.status]:report?'完成':'尚未运行'}</Badge><span className="gt-muted">{job?.message||date(report?.at)}</span>{running&&<progress aria-label={'分析进度 '+r.repo}/>}</div>
          <div className="gt-repo-actions"><button className="gt-primary" disabled={running||busy} onClick={()=>void(async()=>{try{await call({action:'start',repo:r.repo,scan:{}});await refresh()}catch(e){setError(message(e))}})()}>{running?'分析进行中…':'立即分析'}</button><button disabled={running} onClick={()=>setScan({repo:r,full:true})}>全量扫描</button><button onClick={()=>setScan({repo:r,full:false})}>分析选项</button></div>
          <footer className="gt-repo-footer"><button onClick={()=>setEdit(r)}>编辑</button><button onClick={()=>setRuleRepo(r.repo)}>查看/导出规则</button><button onClick={()=>setSelected(r.repo)}>查看结果</button><button className="gt-danger" onClick={()=>setDeleting(r.repo)}>删除</button></footer>
        </section>
      })}</div>}</section>
      <Results reports={reports} selected={selected} onSelect={setSelected} call={call} onChanged={refresh}/>
      {ruleRepo&&<Rules key={ruleRepo} repo={ruleRepo} call={call} onClose={()=>setRuleRepo('')}/>}
      <p className="gt-footnote">只读取 GitHub 和本地已提交代码 · AI 判断仍需复现与审查 · 定时分析需要 DSH 持续运行</p>
    </>}
    <Modal open={edit!==undefined} onClose={()=>setEdit(undefined)} title={edit?'编辑仓库':'添加仓库'} headless className="gt-repo-modal">{edit!==undefined&&<div className="gt-dialog gt-repo-dialog"><RepoForm key={edit?.repo??'new'} initial={edit??undefined} call={call} onCancel={()=>setEdit(undefined)} onSaved={async()=>{setEdit(undefined);await refresh()}}/></div>}</Modal>
    <Modal open={!!scan} onClose={()=>setScan(undefined)} title="分析选项" closeLabel="关闭分析选项">{scan&&snapshot&&<div className="gt-dialog"><h3>{scan.repo.repo}</h3><ScanControl repo={scan.repo} initialFull={scan.full} job={snapshot.jobs.find(j=>j.repo===scan.repo.repo)} defaults={snapshot.defaults} call={call} onStarted={async()=>{setScan(undefined);await refresh()}}/></div>}</Modal>
    <Modal open={!!deleting} onClose={()=>!busy&&setDeleting('')} title="停止跟踪仓库" closeLabel="取消删除">{!!deleting&&<div className="gt-dialog"><p>停止跟踪 {deleting}？保留历史报告与纠正。</p><div className="gt-row"><button className="gt-danger" disabled={busy} onClick={()=>void(async()=>{setBusy(true);try{await call({action:'remove',repo:deleting});setDeleting('');await refresh()}catch(e){setError(message(e))}finally{setBusy(false)}})()}>确认删除</button><button disabled={busy} onClick={()=>setDeleting('')}>取消删除</button></div></div>}</Modal>
  </div></div></div>
}
export function TriageButton({call,sessionId,openPage}:{call:UiCall;sessionId:string;openPage?:()=>boolean}) {
  const [open,setOpen]=useState(false)
  useEffect(()=>setOpen(false),[sessionId])
  return <><button className="gt-entry" title="打开 GitHub 哨兵，配置仓库、业务与本地代码" onClick={()=>{if(!openPage?.())setOpen(true)}}>GitHub 哨兵</button><Modal open={open} onClose={()=>setOpen(false)} title="GitHub 哨兵" closeLabel="关闭 GitHub 哨兵面板">{open&&<div className="gt-compact"><Dashboard call={call}/></div>}</Modal></>
}
interface LocaleFace {register(ns:string,dicts:Record<string,Record<string,string>>):()=>void;bind(ns:string):(key:string)=>string}
export function apply(ctx:Context):void {
  ctx.effect(()=>{const style=document.createElement('style');style.dataset.githubTriage='';style.textContent=css;document.head.append(style);return()=>style.remove()},'github-triage: styles')
  const locale=ctx.get('locale') as LocaleFace|undefined
  if(locale)ctx.effect(()=>locale.register(NS,{zh:{title:'GitHub 哨兵'},en:{title:'GitHub 哨兵'}}),'github-triage: locale')
  const t=locale?.bind(NS)??(()=> 'GitHub 哨兵')
  const call=postCall()
  const openSettings=()=>{const navigation=ctx.get('pluginNavigation') as {openBundle?:(name:string)=>void}|undefined;if(!navigation?.openBundle)return false;navigation.openBundle(PANEL_ID);return true}
  const openPage=()=>{const layout=ctx.get('layout') as {selectPanel?:(id:string)=>void}|undefined;if(!layout?.selectPanel)return false;layout.selectPanel(PANEL_ID);return true}
  const Page=()=> <Dashboard call={call} openSettings={openSettings}/>
  ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:PANEL_ID,locale:NS},Page))
  ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:PANEL_ID,order:25,label:()=>t('title'),locale:NS},props=><Branch size={props.size}/>))
  const Button=(props:PropsRuntime<'conversation.session.header.actions'>)=>{
    const ref=useRef<{session:string;call:UiCall}>()
    if(!ref.current||ref.current.session!==props.sessionId)ref.current={session:props.sessionId,call:postCall(undefined,commandCall((...args)=>ctx.remote.commands.execute(...args),props.sessionId))}
    return <TriageButton sessionId={props.sessionId} call={ref.current.call} openPage={openPage}/>
  }
  ctx.slots.inject('conversation.session.header.actions',()=>ctx.slots.register({name:'conversation.session.header.actions',id:PANEL_ID,order:160},Button))
}
