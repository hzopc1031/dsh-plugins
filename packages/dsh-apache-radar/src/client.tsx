import React, { useEffect, useRef, useState } from 'react'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DashboardData } from './dashboard.js'
import type { Citation, CountRow } from './counts.js'
import type { FeedSource } from './feeds.js'

type Item = NonNullable<DashboardData['items']>[number]
const endpoint = '/api/apache-radar/dashboard'
const projectName = (id: string) => ({ kafka: 'Kafka', hadoop: 'Hadoop', flink: 'Flink' })[id] ?? id
const time = (value?: string | null) => value ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Singapore',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)) : '尚未成功抓取'
const statusName = (value: string) => ({ ok: '已更新', cached: '缓存', stale: '上次成功缓存', failed: '抓取失败', unavailable: '暂无来源' })[value] ?? value
const labels = { code: { copyLabel: '复制', copiedLabel: '已复制' }, footnotes: '注释' }

export function groupIssues(items: Item[]): { label: string; items: Item[] }[] {
  const groups = new Map<string, Item[]>()
  for (const item of items.filter(i => i.kind === 'jira')) {
    const label = item.security ? '安全' : `${item.issueType ?? '其他类型'} · ${item.statusText ?? item.status ?? '状态未知'}`
    groups.set(label, [...(groups.get(label) ?? []), item])
  }
  return [...groups].sort(([a], [b]) => a === '安全' ? -1 : b === '安全' ? 1 : a.localeCompare(b)).map(([label, items]) => ({ label, items }))
}
export function briefSections(markdown: string): string[] {
  return markdown.split(/\n(?=## )/).filter(part => part.trim())
}
function Icon({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 3.5V12l6-6M3.5 12H7M12 17v3.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>
}
function Badge({ children, tone = '' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`ar-badge ${tone}`}>{children}</span>
}
function SourceChip({ source }: { source: Citation }) {
  return <div className="ar-citation"><a href={source.url} target="_blank" rel="noreferrer" title={source.url}>{new URL(source.url).hostname} ↗</a>
    <span title="抓取时间 · Asia/Singapore (UTC+8)">{time(source.fetchedAt)}</span>
    {source.sourceTimestamp && <span>源时间 {source.sourceTimestamp}</span>}
    {source.cacheStatus === 'stale' && <Badge tone="warn">旧缓存</Badge>}
    {source.cacheError && <details className="ar-source-error"><summary>抓取失败 · 查看原因</summary><span className="ar-error-text">{source.cacheError}</span></details>}</div>
}
export function CountCard({ row, title, featured = false }: { row: CountRow; title?: string; featured?: boolean }) {
  return <article className={`ar-card ar-metric ${featured ? 'ar-featured' : ''}`}>
    <div className="ar-eyebrow">{title ?? row.label}</div><strong className="ar-number">{row.status === 'ok' ? row.value : '—'}</strong>
    <p className="ar-note">{row.status === 'error' ? row.error : row.note}</p>
    {row.sources.map((source, i) => <SourceChip key={i} source={source}/>)}</article>
}
export function Overview({ data }: { data: DashboardData }) {
  const counts = data.counts!
  const titles = ['当前列示', '顶级项目 · TLP', '孵化项目 · Podlings', '项目委员会 · PMC', '全部委员会']
  const mismatches = counts.comparisons.filter(c => c.status !== 'match')
  return <>
    <div className="ar-section-heading"><div><h2>从不同口径，看 Apache</h2><p>项目、委员会与孵化项目各有定义，数字保留各自的出处。</p></div><Badge>官方公开来源</Badge></div>
    <div className="ar-metrics">{counts.counts.slice(0, 5).map((row, i) => <CountCard key={row.id} row={row} title={titles[i]} featured={i === 0}/>)}</div>
    <div className="ar-two-col">
      <section className="ar-card ar-section"><div className="ar-card-heading"><h3>退休口径，放在一起看</h3><Badge tone="warn">不合并为总数</Badge></div><p className="ar-muted">退休委员会、Attic 项目与子项目，范围并不相同。</p>
        <div className="ar-retired">{counts.retired.map(row => <div key={row.id} className="ar-retired-cell"><span>{({ 'retired-whimsy': 'Whimsy 委员会', 'retired-projects': 'Projects 委员会', 'attic-pmcs': 'Attic PMC', 'attic-subprojects': 'Attic 子项目' })[row.id] ?? row.label}</span>
          <strong>{row.status === 'ok' ? row.value : '—'}</strong>{row.status === 'error' && <p className="ar-error-text">{row.error}</p>}{row.sources.map((s, i) => <SourceChip key={i} source={s}/>)}</div>)}</div>
        {mismatches.map(c => <details className="ar-difference" key={c.id} open={c.id === 'retired-whimsy-attic'}><summary><span className="ar-dot warn"/>{c.label} · {c.status === 'error' ? '无法核对' : '存在差异'}</summary>
          <p>{c.note}</p>{c.status === 'error' ? <p>{c.error}</p> : <><p>仅左侧：{c.onlyLeft.map(m => `${m.name} (${m.id})`).join('、') || '无'}</p><p>仅右侧：{c.onlyRight.map(m => `${m.name} (${m.id})`).join('、') || '无'}</p></>}
          {c.sources.map((s, i) => <SourceChip key={i} source={s}/>)}</details>)}
      </section>
      <section className="ar-card ar-section"><div className="ar-card-heading"><h3>官方领域标签</h3><Badge>可多选归类</Badge></div><p className="ar-muted">沿用 chooser 的标签，一个项目可以属于多个领域。</p>
        {counts.categories.status === 'error' ? <p className="ar-error-text">{counts.categories.error}</p> : <div className="ar-categories">{counts.categories.rows.map(row => <details key={row.id} className="ar-category"><summary>{row.label}<b>{row.status === 'ok' ? row.value : '—'}</b></summary>
          <p>{row.members?.map(m => m.name).join('、')}</p>{row.sources.map((s, i) => <SourceChip key={i} source={s}/>)}</details>)}</div>}
        {counts.categories.sources.map((s, i) => <SourceChip key={i} source={s}/>)}<p className="ar-footnote">多标签数量不能相加为项目总数。点标签查看成员及来源。</p>
      </section>
    </div>
    <details className="ar-card ar-section"><summary>孵化项目交叉核对与统计说明</summary><p>{counts.explanation}</p>
      <div className="ar-two-col">{counts.counts.slice(5).map(row => <CountCard key={row.id} row={row}/>)}</div>
      {counts.comparisons.filter(c => c.status === 'match').map(c => <p key={c.id}>{c.label}：名单一致。{c.sources.map((s, i) => <SourceChip key={i} source={s}/>)}</p>)}
    </details>
  </>
}
function ItemRow({ item }: { item: Item }) {
  const kind = ({ release: '发布', jira: 'JIRA', proposal: '提案' })[item.kind]
  return <article className={`ar-item ${item.security ? 'ar-security' : ''}`}>
    <div className="ar-item-meta"><Badge tone={item.security ? 'danger' : ''}>{item.security ? `安全 · ${kind}` : kind}</Badge>
      {item.status && <Badge tone={['accepted', 'implemented', 'released'].includes(item.status) ? 'good' : ''}>{item.statusText ?? item.status}</Badge>}
      <span>{item.kind === 'jira' ? item.id : item.version}</span><time>{item.date ? time(item.date).slice(0, 10) : '日期未知 · 参考条目'}</time></div>
    <a className="ar-item-title" href={item.url} target="_blank" rel="noreferrer">{item.title}<span aria-label="打开原文"> ↗</span></a>
    {!!item.fixVersions?.length && <p className="ar-footnote">目标版本 {item.fixVersions.join('、')} · 不代表已经发布</p>}
    <div className="ar-item-links"><a href={item.sourceUrl} target="_blank" rel="noreferrer">采集来源 ↗</a>{item.notesUrl && <a href={item.notesUrl} target="_blank" rel="noreferrer">版本说明 ↗</a>}</div>
  </article>
}
function ItemList({ items, empty }: { items: Item[]; empty: string }) {
  const [expanded, setExpanded] = useState(false)
  return <>{items.length ? (expanded ? items : items.slice(0, 4)).map(item => <ItemRow key={item.url} item={item}/>) : <p className="ar-empty-inline">{empty}</p>}
    {items.length > 4 && <button className="ar-more" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? '收起' : '展开其余条目'}</button>}</>
}
function Sources({ sources }: { sources: FeedSource[] }) {
  return <div className="ar-source-list">{sources.map((s, i) => <div key={i} className="ar-source-row"><Badge tone={s.status === 'failed' ? 'danger' : s.status === 'stale' ? 'warn' : ''}>{statusName(s.status)}</Badge>
    <div>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.project ?? '关注项目'} · {s.kind} ↗</a> : <span>{s.project} · {s.kind}</span>}
      <p className="ar-footnote">{time(s.fetchedAt)}{s.sourceTimestamp ? ` · 源时间 ${s.sourceTimestamp}` : ''}</p>
      {s.error && <p className="ar-error-text">{s.error}</p>}{s.warnings.map((w, n) => <p className="ar-footnote" key={n}>{w}</p>)}</div></div>)}</div>
}
export function Watch({ data, mutate, busy }: { data: DashboardData; mutate: (action: string, project?: string) => void; busy: boolean }) {
  const [selected, setSelected] = useState(data.watchList?.[0] ?? '')
  const [newId, setNewId] = useState('')
  const project = data.watchList?.includes(selected) ? selected : data.watchList?.[0] ?? ''
  const items = data.items?.filter(i => i.project === project) ?? []
  const undated = data.undatedItems?.filter(i => i.project === project) ?? []
  const sources = data.sources?.filter(s => !s.project || s.project === project) ?? []
  return <>
    <div className="ar-section-heading"><div><h2>只关注你在用的项目</h2><p>滚动最近 7 天 · Asia/Singapore（UTC+8）</p></div></div>
    <div className="ar-watch-toolbar"><div className="ar-segment" role="group" aria-label="关注项目">{data.watchList?.map(id => <button aria-pressed={project === id} key={id} onClick={() => setSelected(id)}>{projectName(id)}</button>)}</div>
      <form onSubmit={e => { e.preventDefault(); mutate('add', newId); setNewId('') }}><input aria-label="添加项目 id" placeholder="项目 id，如 spark" pattern="[a-zA-Z][a-zA-Z0-9-]*" required value={newId} onChange={e => setNewId(e.target.value)}/><button disabled={busy}>＋ 关注</button></form>
      {project && <button disabled={busy} onClick={() => mutate('remove', project)} aria-label={`取消关注 ${projectName(project)}`}>取消关注</button>}</div>
    {project ? <><div className="ar-two-col"><section className="ar-card ar-section"><div className="ar-card-heading"><h3>{projectName(project)} · 正式发布</h3><Badge>官方发布目录</Badge></div>
      <ItemList key={project + 'release'} items={items.filter(i => i.kind === 'release')} empty="窗口内无已收录发布；请同时核对下方来源状态。"/>
    </section><section className="ar-card ar-section"><div className="ar-card-heading"><h3>{project === 'kafka' ? 'Kafka · KIP' : project === 'flink' ? 'Flink · FLIP' : projectName(project) + ' · 提案'}</h3><Badge>保留来源状态</Badge></div>
      <ItemList key={project + 'proposal'} items={items.filter(i => i.kind === 'proposal')} empty={project === 'hadoop' ? 'Hadoop 没有已验证的通用 HIP 索引。' : '窗口内暂无已收录提案；日期未知条目在下方单列。'}/>
    </section></div>
    <section className="ar-card ar-section"><div className="ar-card-heading"><h3>JIRA · 按类型与状态整理</h3><Badge>工单 ≠ 已发布功能</Badge></div>
      <p className="ar-muted">仅抓取关注项目的首个响应页；New Feature 和目标版本不证明已经发布。</p>
      {groupIssues(items).length ? groupIssues(items).map(group => <details className="ar-issue-group" key={project + group.label} open={group.label === '安全'}><summary>{group.label}</summary><ItemList items={group.items} empty=""/></details>) : <p className="ar-empty-inline">窗口内暂无已收录 JIRA；来源失败时不能解释为零更新。</p>}
    </section>
    <details className="ar-card ar-section"><summary>日期未知的提案与参考条目 · 不计为本周新增</summary><ItemList key={project + 'undated'} items={undated} empty="暂无日期未知的参考条目。"/></details>
    <details className="ar-card ar-section"><summary>采集窗口与来源状态</summary><p className="ar-muted">{data.window?.label}</p><Sources sources={sources}/></details></> : <div className="ar-card ar-empty"><h3>关注列表是空的</h3><p>添加一个项目 id，开始整理它的动态。</p></div>}
  </>
}
function BriefSection({ part }: { part: string }) {
  if (part.startsWith('## 关注项目动态')) return <><h2 className="ar-brief-title">关注项目动态</h2>{part.split('\n').slice(1).join('\n').trim().split(/\n(?=### )/).map((project, i) => <BriefSection part={project} key={i}/>)}</>
  if (part.startsWith('## ')) return <details className="ar-card ar-section"><summary>{part.split('\n')[0]!.replace(/^## /, '')} · 展开明细</summary><MarkdownText text={part} labels={labels} omitHtml/></details>
  const lines = part.split('\n')
  const preview = part.startsWith('### ') && lines.length > 4
  return <article className="ar-card ar-section"><MarkdownText text={preview ? lines.slice(0, 4).join('\n') : part} labels={labels} omitHtml/>
    {preview && <details className="ar-brief-more"><summary>展开其余周报条目</summary><MarkdownText text={lines.slice(4).join('\n')} labels={labels} omitHtml/></details>}</article>
}
export function Brief({ data, request, busy }: { data: DashboardData; request: (action: string) => void; busy: boolean }) {
  const [notice, setNotice] = useState('')
  const copy = async () => {
    try { await navigator.clipboard.writeText(data.markdown!); setNotice('Markdown 已复制') }
    catch { setNotice('浏览器未允许复制，请打开已保存文件后复制。') }
  }
  const openFile = async () => {
    const tab = window.open('about:blank', '_blank')
    if (!tab) { setNotice('浏览器拦截了新窗口，请允许后重试。'); return }
    tab.opener = null
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ directory: data.directory, action: 'file' }) })
      if (!response.ok) throw new Error((await response.json()).error)
      const url = URL.createObjectURL(await response.blob())
      tab.location.href = url
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) { tab.close(); setNotice(String(error)) }
  }
  return <><div className="ar-section-heading"><div><h2>把这一周，留成一份简报</h2><p>带原文、来源与时间的中文 Markdown · 在本地保存</p></div>
    <div className="ar-actions"><button disabled={busy} onClick={() => request('brief')}>{data.markdown ? '重新生成' : '生成本周周报'}</button>
      {data.markdown && <><button className="ar-primary" onClick={copy}>复制 Markdown</button><button onClick={openFile}>打开已保存文件 ↗</button></>}</div></div>
    <p role="status" className="ar-muted">{notice || '周报无需模型生成。复制和打开操作使用已保存的全文。'}</p>
    {data.markdown ? <div className="ar-brief">{briefSections(data.markdown).map((part, i) => <BriefSection part={part} key={i}/>)}</div> : <div className="ar-card ar-empty"><Icon size={40}/><h3>第一份周报，从这里开始</h3><p>点击「生成本周周报」，采集关注项目并保存到所选目录。</p></div>}</>
}
export function Dashboard() {
  const [data, setData] = useState<DashboardData>({ directories: [] })
  const [directory, setDirectory] = useState(() => {
    try { return localStorage.getItem('apache-radar.directory') ?? '' } catch { return '' }
  })
  const [choosing, setChoosing] = useState(false)
  const [view, setView] = useState('overview')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const generation = useRef(0)
  async function request(action = 'read', project?: string, target = directory) {
    const version = ++generation.current
    setBusy(true); setError('')
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...(target ? { directory: target } : {}), action, ...(project ? { project } : {}) }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? `HTTP ${response.status}`)
      if (generation.current !== version) return
      setData(result); if (result.directory) { setDirectory(result.directory); setChoosing(false); try { localStorage.setItem('apache-radar.directory', result.directory) } catch { /* Directory selection still works without browser storage. */ } }
    } catch (cause) { if (generation.current === version) setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { if (generation.current === version) setBusy(false) }
  }
  useEffect(() => { void request(); return () => { generation.current++ } }, [])
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  const [clock, setClock] = useState(Date.now())
  const countSources = data.counts ? [...data.counts.counts, ...data.counts.retired].flatMap(r => r.sources) : []
  const stale = countSources.some(s => s.cacheStatus === 'stale' || (s.fetchedAt && clock - Date.parse(s.fetchedAt) >= 3_600_000))
    || data.sources?.some(s => s.status === 'stale' || (s.fetchedAt && clock - Date.parse(s.fetchedAt) >= 3_600_000))
  const failed = data.counts && [...data.counts.counts, ...data.counts.retired].some(r => r.status === 'error') || data.sources?.some(s => s.status === 'failed')
  const ready = !!data.counts
  return <div className="ar-root" aria-busy={busy}>
    <style>{css}</style><div className="ar-shell">
    <header className="ar-header"><div className="ar-brand"><span className="ar-brand-icon"><Icon size={27}/></span><div><div className="ar-overline">APACHE / COMMUNITY RADAR</div><h1>Apache 社区雷达</h1></div></div><span className="ar-local"><span className="ar-dot"/>本地工作台 · 无需模型</span></header>
    <div className="ar-intro"><p>在纷繁的社区动态中，找到你关心的变化。</p><span>公开来源 · 原文可追溯 · UTC+8</span></div>
    <div className="ar-projectbar">{data.directory && !choosing ? <div className="ar-directory"><span className="ar-dot"/><span title={data.directory}>本地项目 · {data.directory.split(/[\\/]/).filter(Boolean).at(-1)}</span><button disabled={busy} onClick={() => setChoosing(true)}>切换目录</button></div> : <form onSubmit={e => { e.preventDefault(); void request('read') }}><label htmlFor="ar-directory">项目目录</label>
      <input id="ar-directory" list="ar-directories" value={directory} placeholder="输入本地项目的绝对路径" onChange={e => setDirectory(e.target.value)} required disabled={busy}/><datalist id="ar-directories">{data.directories.map(d => <option value={d} key={d}/>)}</datalist><button disabled={busy}>打开</button></form>}
      <div className="ar-actions"><span className="ar-last">上次采集 {time(data.collectedAt)}</span><button className="ar-primary" disabled={busy || !data.directory} onClick={() => void request('refresh', undefined, data.directory)}><span className={busy ? 'ar-spin' : ''}>↻</span> {busy ? '正在读取…' : '刷新数据'}</button></div></div>
    <nav className="ar-tabs" aria-label="雷达页面">{[['overview', '概览', '01'], ['watch', '关注动态', '02'], ['brief', '每周简报', '03']].map(([id, title, num]) => <button key={id} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id!)}><span>{num}</span>{title}</button>)}</nav>
    {error && <div className="ar-notice danger" role="alert"><strong>操作失败</strong><span>{error} {ready ? '仍保留当前画面中的上次数据。' : ''}</span><button disabled={busy} onClick={() => void request('read')}>重试读取</button></div>}
    {(stale || failed) && <div className="ar-notice warn" role="status"><strong>{stale ? '正在显示上次成功缓存' : '部分来源未能取得数据'}</strong><span>{stale ? '数据已过期或刷新失败；请核对每个来源的时间。' : '失败不代表没有动态。'} 已保留来源错误。</span></div>}
    {busy && <div role="status" className="ar-loading"><span className="ar-spin">◌</span> 正在读取公开来源与本地缓存，请稍候…</div>}
    {ready ? view === 'overview' ? <Overview data={data}/> : view === 'watch' ? <Watch data={data} mutate={(action, project) => void request(action, project, data.directory)} busy={busy}/> : <Brief data={data} request={action => void request(action, undefined, data.directory)} busy={busy}/>
      : view === 'brief' && data.directory ? <Brief data={data} request={action => void request(action, undefined, data.directory)} busy={busy}/> : !busy && <div className="ar-card ar-empty"><Icon size={44}/><h2>{data.directory ? '雷达已就绪，等待第一次采集' : '为你的项目，打开一扇社区窗口'}</h2><p>{data.directory ? '点击「刷新数据」获取官方计数与关注动态。只读取公开来源，无需模型或登录。' : '选择已有目录，或在上方输入一个本地项目路径。不需要创建聊天或配置模型。'}</p></div>}
    <footer className="ar-footer"><span>Apache Radar <span className="ar-divider">/</span> 本地 Apache 社区雷达</span><span>统计口径并列展示 · reporter.apache.org 不使用</span></footer>
    </div></div>
}

interface ClientContext {
  slots: {
    inject(name: string, setup: () => unknown): unknown
    register(options: Record<string, unknown>, component: React.ComponentType<{ size?: number }>): unknown
  }
}
export const inject = ['slots']
export function apply(ctx: ClientContext) {
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'apache-radar' }, Dashboard))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'apache-radar', order: 25, label: () => 'Apache 雷达' }, Icon))
}

const css = `
.ar-root {
  --ar-bg:var(--dsw-alias-bg-module-platform);
  --ar-card:var(--dsw-alias-bg-layer-1);
  --ar-text:var(--dsw-alias-label-primary);
  --ar-muted:var(--dsw-alias-label-secondary);
  --ar-faint:var(--dsw-alias-label-tertiary);
  --ar-line:var(--dsw-alias-border-l2);
  --ar-accent:var(--dsw-alias-state-business-primary);
  --ar-warn:var(--dsw-alias-state-warn-label);
  --ar-error:var(--dsw-alias-state-error-primary);
  --ar-success:var(--dsw-alias-state-success-primary);
  height:100%;
  overflow:auto;
  background:var(--ar-bg);
  color:var(--ar-text);
  font-family:inherit;
  font-size:14px;
  line-height:1.6;
  container-type:inline-size
}
.ar-root * {
  box-sizing:border-box
}
.ar-shell {
  max-width:1440px;
  margin:auto;
  padding:40px 42px 24px;
  padding-top:max(40px,var(--dsh-frame-leading-clearance,0px))
}
.ar-root h1,.ar-root h2,.ar-root h3,.ar-root h4,.ar-root p {
  margin:0
}
.ar-root h1 {
  font-size:25px;
  letter-spacing:-.7px;
  font-weight:650
}
.ar-root h2 {
  font-size:19px;
  font-weight:600;
  letter-spacing:-.4px
}
.ar-root h3 {
  font-size:15px;
  font-weight:600
}
.ar-root h4 {
  font-size:12px;
  color:var(--ar-faint);
  font-weight:500;
  margin:15px 0 4px
}
.ar-root a {
  color:inherit;
  text-decoration:none
}
.ar-root a:hover {
  color:var(--ar-accent);
  text-decoration:underline
}
.ar-root button {
  font:inherit;
  cursor:pointer;
  background:var(--ar-card);
  color:var(--ar-text);
  border:1px solid var(--ar-line);
  border-radius:8px;
  padding:7px 13px;
  white-space:nowrap;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:6px
}
.ar-root button:hover {
  background:var(--dsw-alias-interactive-bg-hover)
}
.ar-root button:disabled {
  opacity:.5;
  cursor:wait
}
.ar-root :is(button,a,input,summary):focus-visible {
  outline:2px solid var(--ar-accent);
  outline-offset:3px
}
.ar-root .ar-primary {
  background:var(--ar-accent);
  color:var(--dsw-static-neutral-bluish-00);
  border-color:transparent
}
.ar-root .ar-primary:hover {
  filter:brightness(1.1);
  background:var(--ar-accent)
}
.ar-root input {
  font:inherit;
  color:inherit;
  background:transparent;
  border:1px solid var(--ar-line);
  border-radius:8px;
  padding:7px 10px;
  min-width:0
}
.ar-header,.ar-brand,.ar-intro,.ar-projectbar,.ar-actions,.ar-card-heading,.ar-section-heading,.ar-watch-toolbar,.ar-footer {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px
}
.ar-brand {
  justify-content:flex-start;
  gap:14px
}
.ar-brand-icon {
  display:grid;
  place-items:center;
  width:50px;
  height:50px;
  background:color-mix(in srgb,var(--ar-accent) 9%,transparent);
  color:var(--ar-accent);
  border:1px solid color-mix(in srgb,var(--ar-accent) 18%,transparent);
  border-radius:14px
}
.ar-overline {
  font-size:10px;
  font-weight:600;
  letter-spacing:1.8px;
  color:var(--ar-faint);
  margin-bottom:3px
}
.ar-local {
  font-size:12px;
  color:var(--ar-muted);
  display:flex;
  align-items:center;
  gap:7px
}
.ar-dot {
  display:inline-block;
  width:6px;
  height:6px;
  border-radius:50%;
  background:var(--ar-success);
  flex-shrink:0
}
.ar-dot.warn {
  background:var(--ar-warn)
}
.ar-intro {
  margin:19px 0 24px;
  color:var(--ar-muted)
}
.ar-intro>span {
  font-size:12px;
  color:var(--ar-faint)
}
.ar-projectbar {
  border:1px solid var(--ar-line);
  border-radius:12px;
  padding:12px 14px;
  background:var(--ar-card);
  flex-wrap:wrap
}
.ar-directory {
  display:flex;
  align-items:center;
  gap:10px;
  font-size:12px;
  color:var(--ar-muted)
}
.ar-directory>span {
  overflow-wrap:anywhere
}
.ar-projectbar form,.ar-watch-toolbar form {
  display:flex;
  align-items:center;
  gap:9px;
  flex:1;
  min-width:200px
}
.ar-projectbar label {
  font-size:12px;
  color:var(--ar-muted);
  white-space:nowrap
}
.ar-projectbar input {
  width:100%;
  max-width:450px;
  font-size:12px;
  font-family:inherit
}
.ar-last {
  font-size:11px;
  color:var(--ar-faint)
}
.ar-tabs {
  display:flex;
  gap:26px;
  border-bottom:1px solid var(--ar-line);
  margin:23px 0 28px
}
.ar-tabs button {
  background:transparent;
  border:0;
  border-radius:0;
  padding:12px 2px 15px;
  color:var(--ar-faint);
  gap:9px;
  font-weight:500;
  position:relative
}
.ar-tabs button span {
  font-size:10px;
  font-variant-numeric:tabular-nums;
  opacity:.65
}
.ar-tabs button[aria-current] {
  color:var(--ar-text)
}
.ar-tabs button[aria-current]:after {
  content:'';
  height:2px;
  background:var(--ar-accent);
  position:absolute;
  bottom:-1px;
  left:0;
  right:0
}
.ar-section-heading {
  margin-bottom:20px;
  align-items:flex-start;
  flex-wrap:wrap
}
.ar-section-heading p {
  font-size:12px;
  color:var(--ar-faint);
  margin-top:5px
}
.ar-card {
  border:1px solid var(--ar-line);
  border-radius:13px;
  background:var(--ar-card);
  box-shadow:0 2px 5px #00000003;
  min-width:0
}
.ar-metrics {
  display:grid;
  grid-template-columns:1.2fr repeat(4,1fr);
  gap:12px;
  margin-bottom:22px
}
.ar-metric {
  padding:19px 18px 16px;
  display:flex;
  flex-direction:column;
  gap:8px
}
.ar-featured {
  border-color:color-mix(in srgb,var(--ar-accent) 32%,var(--ar-line));
  background:linear-gradient(125deg,color-mix(in srgb,var(--ar-accent) 6%,var(--ar-card)),var(--ar-card))
}
.ar-eyebrow {
  font-size:12px;
  font-weight:500;
  color:var(--ar-muted)
}
.ar-number {
  font-size:39px;
  line-height:1.2;
  font-weight:600;
  letter-spacing:-1.7px;
  font-variant-numeric:tabular-nums
}
.ar-featured .ar-number {
  color:var(--ar-accent)
}
.ar-note {
  font-size:11px;
  line-height:1.65;
  color:var(--ar-faint);
  flex:1
}
.ar-citation {
  font-size:10px;
  line-height:1.7;
  color:var(--ar-faint);
  display:flex;
  gap:0 7px;
  flex-wrap:wrap;
  overflow-wrap:anywhere;
  font-variant-numeric:tabular-nums
}
.ar-source-error {
  width:100%;
  margin-top:3px
}
.ar-source-error summary {
  font-size:10px;
  color:var(--ar-error)
}
.ar-citation a {
  color:var(--ar-muted)
}
.ar-citation>span {
  display:block
}
.ar-citation>span:not(.ar-badge) {
  width:100%
}
.ar-two-col {
  display:grid;
  grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);
  gap:20px;
  margin-bottom:20px;
  align-items:start
}
.ar-section {
  padding:23px;
  margin-bottom:20px
}
.ar-two-col>.ar-section {
  margin:0
}
.ar-card-heading {
  margin-bottom:9px;
  align-items:flex-start;
  flex-wrap:wrap
}
.ar-muted {
  color:var(--ar-faint);
  font-size:12px
}
.ar-badge {
  display:inline-flex;
  align-items:center;
  width:fit-content;
  border:1px solid var(--ar-line);
  border-radius:5px;
  padding:1px 6px;
  font-size:10px;
  line-height:1.6;
  color:var(--ar-muted);
  font-weight:500;
  white-space:nowrap
}
.ar-badge.warn {
  color:var(--ar-warn);
  border-color:color-mix(in srgb,var(--ar-warn) 25%,transparent);
  background:color-mix(in srgb,var(--ar-warn) 7%,transparent)
}
.ar-badge.danger {
  color:var(--ar-error);
  background:color-mix(in srgb,var(--ar-error) 8%,transparent);
  border-color:color-mix(in srgb,var(--ar-error) 25%,transparent)
}
.ar-badge.good {
  color:var(--ar-success);
  border-color:color-mix(in srgb,var(--ar-success) 25%,transparent)
}
.ar-retired {
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:10px;
  margin:22px 0
}
.ar-retired-cell {
  padding-right:8px;
  border-right:1px solid var(--ar-line);
  font-size:11px;
  color:var(--ar-muted)
}
.ar-retired-cell:last-child {
  border:0
}
.ar-retired-cell strong {
  display:block;
  color:var(--ar-text);
  font-size:27px;
  font-weight:550;
  margin:5px 0 10px;
  font-variant-numeric:tabular-nums
}
.ar-difference {
  border-top:1px solid var(--ar-line);
  padding:12px 0;
  font-size:11px;
  color:var(--ar-muted)
}
.ar-root summary {
  cursor:pointer;
  font-size:12px;
  color:var(--ar-muted)
}
.ar-difference summary .ar-dot {
  margin-right:6px
}
.ar-difference p {
  margin-top:7px;
  overflow-wrap:anywhere
}
.ar-difference .ar-citation {
  margin-top:7px
}
.ar-categories {
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:8px;
  margin:20px 0
}
.ar-category {
  background:var(--ar-bg);
  border:1px solid var(--ar-line);
  border-radius:7px;
  min-width:0
}
.ar-category summary {
  list-style:none;
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:8px 10px;
  gap:8px;
  font-size:11px
}
.ar-category b {
  font-variant-numeric:tabular-nums;
  font-weight:500;
  color:var(--ar-text)
}
.ar-category p,.ar-category .ar-citation {
  padding:0 10px 10px;
  font-size:11px;
  color:var(--ar-faint)
}
.ar-footnote {
  font-size:11px;
  color:var(--ar-faint);
  line-height:1.7
}
.ar-notice {
  display:flex;
  align-items:center;
  gap:12px;
  border:1px solid var(--ar-line);
  border-radius:9px;
  padding:12px 16px;
  margin-bottom:20px;
  font-size:12px;
  flex-wrap:wrap
}
.ar-notice.warn {
  color:var(--ar-warn);
  background:color-mix(in srgb,var(--ar-warn) 5%,var(--ar-card));
  border-color:color-mix(in srgb,var(--ar-warn) 25%,transparent)
}
.ar-notice.danger {
  color:var(--ar-error);
  background:color-mix(in srgb,var(--ar-error) 5%,var(--ar-card))
}
.ar-notice span {
  flex:1;
  min-width:180px
}
.ar-notice strong {
  font-weight:550
}
.ar-error-text {
  color:var(--ar-error);
  font-size:11px;
  overflow-wrap:anywhere
}
.ar-loading {
  display:flex;
  align-items:center;
  gap:8px;
  color:var(--ar-faint);
  font-size:12px;
  padding:0 0 16px
}
.ar-spin {
  display:inline-block;
  animation:ar-spin 1.4s linear infinite
}
@keyframes ar-spin {
  to {
    transform:rotate(360deg)
  }
}
.ar-empty {
  padding:70px 25px;
  text-align:center;
  color:var(--ar-faint)
}
.ar-empty svg {
  margin:0 auto 18px;
  color:var(--ar-accent)
}
.ar-empty h2,.ar-empty h3 {
  color:var(--ar-text);
  margin-bottom:10px
}
.ar-empty p {
  max-width:500px;
  margin:auto;
  font-size:13px
}
.ar-watch-toolbar {
  margin-bottom:24px;
  flex-wrap:wrap;
  justify-content:flex-start
}
.ar-watch-toolbar form {
  flex:0 1 auto;
  margin-left:auto
}
.ar-watch-toolbar input {
  width:175px;
  font-size:12px
}
.ar-watch-toolbar button {
  font-size:12px
}
.ar-segment {
  display:flex;
  gap:3px;
  padding:4px;
  background:color-mix(in srgb,var(--ar-text) 4%,transparent);
  border:1px solid var(--ar-line);
  border-radius:10px;
  flex-wrap:wrap
}
.ar-segment button {
  border:0;
  background:transparent;
  color:var(--ar-faint);
  padding:7px 18px;
  min-width:85px
}
.ar-segment button[aria-pressed=true] {
  background:var(--ar-card);
  color:var(--ar-text);
  box-shadow:0 1px 4px #0000000b
}
.ar-item {
  padding:17px 0;
  border-bottom:1px solid var(--ar-line)
}
.ar-item:last-child {
  border-bottom:0
}
.ar-item-meta {
  display:flex;
  align-items:center;
  flex-wrap:wrap;
  gap:7px;
  margin-bottom:8px;
  font-size:10px;
  color:var(--ar-faint)
}
.ar-item-meta .ar-badge {
  white-space:normal;
  overflow-wrap:anywhere;
  max-width:100%
}
.ar-item-meta time {
  margin-left:auto;
  font-variant-numeric:tabular-nums
}
.ar-item-title {
  display:block;
  font-weight:500;
  line-height:1.7;
  font-size:13px;
  overflow-wrap:anywhere
}
.ar-item-title>span {
  color:var(--ar-faint);
  font-size:12px
}
.ar-item-links {
  display:flex;
  gap:12px;
  font-size:10px;
  color:var(--ar-faint);
  margin-top:7px
}
.ar-security {
  border-left:2px solid var(--ar-error);
  padding-left:14px;
  background:linear-gradient(90deg,color-mix(in srgb,var(--ar-error) 4%,transparent),transparent);
  margin-top:9px
}
.ar-item .ar-footnote {
  margin-top:6px
}
.ar-empty-inline {
  color:var(--ar-faint);
  font-size:12px;
  padding:25px 0 15px;
  line-height:1.9
}
.ar-issue-group {
  padding:12px 0 0
}
.ar-issue-group summary {
  font-size:12px;
  font-weight:500
}
.ar-issue-group+.ar-issue-group {
  border-top:1px solid var(--ar-line);
  margin-top:14px
}
.ar-root .ar-more {
  width:100%;
  font-size:11px;
  color:var(--ar-faint);
  background:transparent;
  border-style:dashed;
  margin-top:12px
}
.ar-source-list {
  margin-top:15px
}
.ar-source-row {
  display:flex;
  gap:10px;
  padding:12px 0;
  border-bottom:1px solid var(--ar-line);
  align-items:flex-start;
  font-size:12px
}
.ar-source-row>div {
  min-width:0;
  overflow-wrap:anywhere
}
.ar-brief {
  max-width:980px;
  margin:20px auto
}
.ar-brief .ar-section {
  padding:30px 34px
}
.ar-brief-title {
  margin:28px 0 18px!important
}
.ar-brief-more {
  margin-top:16px;
  padding-top:12px;
  border-top:1px solid var(--ar-line)
}
.ar-brief h1 {
  font-size:23px
}
.ar-brief h2 {
  font-size:18px
}
.ar-brief h3 {
  margin-top:24px
}
.ar-footer {
  margin-top:35px;
  padding-top:20px;
  border-top:1px solid var(--ar-line);
  font-size:10px;
  color:var(--ar-faint);
  flex-wrap:wrap
}
.ar-divider {
  padding:0 8px;
  opacity:.5
}
@container (max-width:1000px) {
  .ar-shell {
    padding:28px 24px 20px
  }
  .ar-metrics {
    grid-template-columns:repeat(3,1fr)
  }
  .ar-two-col {
    grid-template-columns:1fr
  }
  .ar-last,.ar-intro>span {
    display:none
  }
  .ar-retired {
    gap:15px
  }
  .ar-retired-cell {
    font-size:12px
  }
  .ar-brief .ar-section {
    padding:24px
  }
  .ar-local {
    font-size:11px
  }
}
@container (max-width:600px) {
  .ar-shell {
    padding:24px 16px
  }
  .ar-header h1 {
    font-size:21px
  }
  .ar-local {
    display:none
  }
  .ar-metrics {
    grid-template-columns:1fr 1fr
  }
  .ar-metrics .ar-featured {
    grid-column:1/-1
  }
  .ar-metric {
    padding:16px
  }
  .ar-retired {
    grid-template-columns:1fr 1fr;
    gap:18px
  }
  .ar-watch-toolbar form {
    margin-left:0
  }
  .ar-tabs {
    gap:20px
  }
  .ar-section {
    padding:18px
  }
  .ar-projectbar form {
    width:100%;
    flex-basis:100%
  }
  .ar-actions {
    flex-wrap:wrap
  }
  .ar-root h2 {
    font-size:17px
  }
  .ar-intro {
    font-size:12px
  }
  .ar-brief .ar-section {
    padding:20px
  }
  .ar-number {
    font-size:34px
  }
}
@media(prefers-reduced-motion:reduce) {
  .ar-spin {
    animation:none
  }
}
`
