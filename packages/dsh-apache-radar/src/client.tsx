import { NetworkSettings, networkHint, type NetworkSettingsProps } from './network-settings.js'
import React, { useEffect, useRef, useState } from 'react'
import { Button, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DashboardData } from './dashboard.js'
import type { Citation, CountRow } from './counts.js'
import type { ProjectSecurity, SecurityReport, SecuritySource } from './security.js'
import type { FeedSource } from './feeds.js'

type Item = NonNullable<DashboardData['items']>[number]
const endpoint = '/api/apache-radar/dashboard'
const projectName = (id: string) => ({ kafka: 'Kafka', hadoop: 'Hadoop', flink: 'Flink' })[id] ?? id
const time = (value?: string | null) => value ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Singapore',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)) : '尚未成功抓取'
const statusName = (value: string) => ({ ok: '已更新', cached: '缓存', stale: '上次成功缓存', failed: '抓取失败', unavailable: '暂无来源' })[value] ?? value
const sourceError = (error?: string) => error && /TLS_KEY_TOO_SMALL|key too (?:small|weak)|fetch failed|NETWORK_ERROR|ECONN|ETIMEDOUT|ENOTFOUND|UND_ERR_|CERT|SIGNATURE|ISSUER|HTTP[ _]\d{3}/i.test(error) ? (error.includes('TLS_KEY_TOO_SMALL') ? '证书密钥过短 · 见网络 / 设置' : '来源不可用 · 见网络 / 设置') : error
const labels = { code: { copyLabel: '复制', copiedLabel: '已复制' }, footnotes: '注释' }

export function securityOverview(report: SecurityReport) {
  const affected = report.projects.filter(p => p.advisories.some(a => a.verdict === 'affected'))
  return { watched: report.projects.length, affected: affected.map(p => p.project), unpinned: report.projects.filter(p => !p.pin).length,
    incomplete: report.projects.filter(p => !p.source?.data || p.source.status === 'stale').length }
}
export function jiraCves(title: string, security: boolean, project?: ProjectSecurity) {
  if (!security) return []
  return [...new Set(title.match(/CVE-\d{4}-\d{4,}/gi)?.map(id => id.toUpperCase()) ?? [])].map(id => {
    const advisory = project?.advisories.find(a => a.id === id)
    return { id, status: advisory ? 'published' : project?.source?.data ? 'not_published' : 'unknown',
      label: advisory ? '官方已公布' : project?.source?.data ? '官方尚未公布' : '官方列表不可用，无法核对',
      url: advisory?.url, fetchedAt: project?.source?.fetchedAt, stale: project?.source?.status === 'stale' }
  })
}

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
  return <details className="ar-citation"><summary><a href={source.url} target="_blank" rel="noreferrer" title={source.url}>{new URL(source.url).hostname} ↗</a> · {source.fetchedAt ? time(source.fetchedAt).slice(5) : '尚未成功抓取'}{source.cacheStatus === 'stale' ? ' · 旧缓存' : ''}</summary>
    <span>抓取 {time(source.fetchedAt)} · UTC+8{source.sourceTimestamp ? ` · 源时间 ${source.sourceTimestamp}` : ''}</span>
    {source.cacheError && <span className="ar-error-text">{sourceError(source.cacheError)}</span>}</details>
}
export function CountCard({ row, title, featured = false }: { row: CountRow; title?: string; featured?: boolean }) {
  return <article className={`ar-card ar-metric ${featured ? 'ar-featured' : ''}`}>
    <h3 className="ar-eyebrow">{title ?? row.label}</h3><strong className="ar-number">{row.status === 'ok' ? row.value : '—'}</strong>
    {row.status === 'error' && <p className="ar-error-text">{sourceError(row.error)}</p>}
    <details className="ar-metric-detail"><summary>口径与来源</summary><p className="ar-note">{row.note}</p>{row.sources.map((source, i) => <SourceChip key={i} source={source}/>)}</details></article>
}
export function Overview({ data, jump }: { data: DashboardData; jump?: (project: string) => void }) {
  const counts = data.counts!
  const titles = ['当前列示', '顶级项目 · TLP', '孵化项目 · Podlings', '项目委员会 · PMC', '全部委员会']
  const mismatches = counts.comparisons.filter(c => c.status !== 'match')
  return <>
    <div className="ar-section-heading"><h2>社区概况</h2><span className="ar-muted">官方公开来源 · 统计口径独立</span></div>
    <div className="ar-metrics">{counts.counts.slice(0, 5).map((row, i) => <CountCard key={row.id} row={row} title={titles[i]} featured={i === 0}/>)}{data.security && <SecurityCard report={data.security} jump={jump}/>}</div>
    <div className="ar-two-col">
      <section className="ar-card ar-section"><div className="ar-card-heading"><h3>退休与 Attic</h3><span className="ar-muted">口径不同，不合计</span></div>
        <div className="ar-retired">{counts.retired.map(row => <div key={row.id} className="ar-retired-cell"><span>{({ 'retired-whimsy': 'Whimsy 委员会', 'retired-projects': 'Projects 委员会', 'attic-pmcs': 'Attic PMC', 'attic-subprojects': 'Attic 子项目' })[row.id] ?? row.label}</span>
          <strong>{row.status === 'ok' ? row.value : '—'}</strong>{row.status === 'error' && <p className="ar-error-text">{sourceError(row.error)}</p>}{row.sources.map((s, i) => <SourceChip key={i} source={s}/>)}</div>)}</div>
        {mismatches.map(c => <details className="ar-difference" key={c.id}><summary><span className="ar-dot warn"/>{c.label} · {c.status === 'error' ? '无法核对' : '存在差异'}</summary>
          <p>{c.note}</p>{c.status === 'error' ? <p>{sourceError(c.error)}</p> : <><p>仅左侧：{c.onlyLeft.map(m => `${m.name} (${m.id})`).join('、') || '无'}</p><p>仅右侧：{c.onlyRight.map(m => `${m.name} (${m.id})`).join('、') || '无'}</p></>}
          {c.sources.map((s, i) => <SourceChip key={i} source={s}/>)}</details>)}
      </section>
      <section className="ar-card ar-section"><div className="ar-card-heading"><h3>领域分布 <span className="ar-heading-count">{counts.categories.status === 'ok' ? counts.categories.rows.length : '—'}</span></h3><span className="ar-muted">官方多标签</span></div>
        {counts.categories.status === 'error' ? <p className="ar-error-text">{sourceError(counts.categories.error)}</p> : <div className="ar-categories">{counts.categories.rows.map(row => <details key={row.id} className="ar-category"><summary>{row.label}<b>{row.status === 'ok' ? row.value : '—'}</b></summary>
          <p>{row.members?.map(m => m.name).join('、')}</p>{row.sources.map((s, i) => <SourceChip key={i} source={s}/>)}</details>)}</div>}
        {counts.categories.sources.map((s, i) => <SourceChip key={i} source={s}/>)}<p className="ar-footnote">多标签归类，数量不合计。</p>
      </section>
    </div>
    <details className="ar-card ar-section"><summary>孵化项目交叉核对与统计说明</summary><p>{counts.explanation}</p>
      <div className="ar-two-col">{counts.counts.slice(5).map(row => <CountCard key={row.id} row={row}/>)}</div>
      {counts.comparisons.filter(c => c.status === 'match').map(c => <p key={c.id}>{c.label}：名单一致。{c.sources.map((s, i) => <SourceChip key={i} source={s}/>)}</p>)}
    </details>
  </>
}
function ItemRow({ item, security }: { item: Item; security?: ProjectSecurity }) {
  const kind = ({ release: '发布', jira: 'JIRA', proposal: '提案' })[item.kind]
  return <article className={`ar-item ${item.security ? 'ar-security' : ''}`}>
    <div className="ar-item-meta"><Badge tone={item.security ? 'danger' : ''}>{item.security ? `安全 · ${kind}` : kind}</Badge>
      {item.status && <Badge tone={['accepted', 'implemented', 'released'].includes(item.status) ? 'good' : ''}>{item.statusText ?? item.status}</Badge>}
      <span>{item.kind === 'jira' ? item.id : item.version}</span><time>{item.date ? time(item.date).slice(0, 10) : '日期未知 · 参考条目'}</time></div>
    <a className="ar-item-title" href={item.url} target="_blank" rel="noreferrer">{item.title}<span aria-label="打开原文"> ↗</span></a>
    {!!item.security && jiraCves(item.title, true, security).map(cve => <div className="ar-cve-chip" key={cve.id} title={`按已抓取官方列表核对 · ${time(cve.fetchedAt)}${cve.stale ? ' · 旧缓存' : ''}`}>
      {cve.status === 'published' ? <button onClick={() => revealAdvisory(`${item.project}-${cve.id}`)}>{cve.id} · {cve.label} ↗</button> : <Badge>{cve.id} · {cve.label}</Badge>}
    </div>)}
    <div className="ar-item-links">{!!item.fixVersions?.length && <span>目标 {item.fixVersions.join('、')} · 不代表已发布</span>}<a href={item.sourceUrl} target="_blank" rel="noreferrer">采集来源 ↗</a>{item.notesUrl && <a href={item.notesUrl} target="_blank" rel="noreferrer">版本说明 ↗</a>}</div>
  </article>
}
function ItemList({ items, empty, security }: { items: Item[]; empty: string; security?: ProjectSecurity }) {
  const [expanded, setExpanded] = useState(false)
  return <>{items.length ? (expanded ? items : items.slice(0, 4)).map(item => <ItemRow key={item.url} item={item} security={security}/>) : <p className="ar-empty-inline">{empty}</p>}
    {items.length > 4 && <button className="ar-more" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? '收起' : '展开其余条目'}</button>}</>
}
function Sources({ sources }: { sources: FeedSource[] }) {
  return <div className="ar-source-list">{sources.map((s, i) => <div key={i} className="ar-source-row"><Badge tone={s.status === 'failed' ? 'danger' : s.status === 'stale' ? 'warn' : ''}>{statusName(s.status)}</Badge>
    <div>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.project ?? '关注项目'} · {s.kind} ↗</a> : <span>{s.project} · {s.kind}</span>}
      <p className="ar-footnote">{time(s.fetchedAt)}{s.sourceTimestamp ? ` · 源时间 ${s.sourceTimestamp}` : ''}</p>
      {s.error && <p className="ar-error-text">{sourceError(s.error)}</p>}{s.warnings.map((w, n) => <p className="ar-footnote" key={n}>{w}</p>)}</div></div>)}</div>
}
type Mutate = (action: string, project?: string, extra?: { version?: string; cve?: string }) => void
export function Watch({ data, mutate, busy, focusProject }: { data: DashboardData; mutate: Mutate; busy: boolean; focusProject?: string }) {
  const [selected, setSelected] = useState(focusProject ?? data.watchList?.[0] ?? '')
  const [newId, setNewId] = useState('')
  const project = data.watchList?.includes(selected) ? selected : data.watchList?.[0] ?? ''
  const security = data.security?.projects.find(p => p.project === project)
  const items = data.items?.filter(i => i.project === project) ?? []
  const undated = data.undatedItems?.filter(i => i.project === project) ?? []
  const sources = data.sources?.filter(s => !s.project || s.project === project) ?? []
  return <>
    <div className="ar-section-heading"><h2>项目动态 <span className="ar-heading-count">{data.watchList?.length ?? 0}</span></h2><span className="ar-muted">最近 7 天 · 滚动窗口 · UTC+8</span></div>
    <div className="ar-watch-toolbar"><div className="ar-segment" role="group" aria-label="关注项目">{data.watchList?.map(id => <button aria-pressed={project === id} key={id} onClick={() => setSelected(id)}>{projectName(id)}</button>)}</div>
      <details className="ar-manage" open={!project || undefined}><summary>管理关注</summary><form onSubmit={e => { e.preventDefault(); mutate('add', newId); setNewId('') }}><input aria-label="添加项目 id" placeholder="项目 id，如 spark" pattern="[a-zA-Z][a-zA-Z0-9-]*" required value={newId} onChange={e => setNewId(e.target.value)}/><button disabled={busy}>＋ 关注</button></form>
      {project && <button disabled={busy} onClick={() => mutate('remove', project)} aria-label={`取消关注 ${projectName(project)}`}>取消关注</button>}</details></div>
    {project ? <><SecurityStrip key={project + (security?.pin ?? "")} project={project} security={security} report={data.security} mutate={mutate} busy={busy} expanded={focusProject === project}/><div className="ar-two-col"><section className="ar-card ar-section"><div className="ar-card-heading"><h3>正式发布 <span className="ar-heading-count">{items.filter(i => i.kind === 'release').length}</span></h3></div>
      <ItemList key={project + 'release'} items={items.filter(i => i.kind === 'release')} empty="近 7 天暂无已收录发布。"/>
    </section><section className="ar-card ar-section"><div className="ar-card-heading"><h3>{project === 'kafka' ? 'KIP' : project === 'flink' ? 'FLIP' : '提案'} <span className="ar-heading-count">{items.filter(i => i.kind === 'proposal').length}</span></h3></div>
      <ItemList key={project + 'proposal'} items={items.filter(i => i.kind === 'proposal')} empty={project === 'hadoop' ? 'Hadoop 没有已验证的通用 HIP 索引。' : '近 7 天暂无已收录提案。'}/>
    </section></div>
    <section className="ar-card ar-section"><div className="ar-card-heading"><h3>JIRA <span className="ar-heading-count">{items.filter(i => i.kind === 'jira').length}</span></h3><span className="ar-muted">首个响应页 · 工单不代表已发布</span></div>
      {groupIssues(items).length ? groupIssues(items).map(group => <details className="ar-issue-group" key={project + group.label} open={group.label === '安全'}><summary>{group.label} <span className="ar-heading-count">{group.items.length}</span></summary><ItemList items={group.items} empty="" security={security}/></details>) : <p className="ar-empty-inline">近 7 天暂无已收录 JIRA；请核对来源状态。</p>}
    </section>
    <details className="ar-card ar-section"><summary>参考提案 · 日期未知，不计入本周</summary><ItemList key={project + 'undated'} items={undated} empty="暂无日期未知的参考条目。"/></details>
    <details className="ar-card ar-section"><summary>采集窗口与来源状态</summary><p className="ar-muted">{data.window?.label}</p><Sources sources={sources}/></details></> : <div className="ar-card ar-empty"><h3>关注列表是空的</h3><p>添加一个项目 id，开始整理它的动态。</p></div>}
  </>
}

const verdictName = { affected: '受影响', not_affected: '不受影响', unknown: '无法判断' }
const verdictTone = { affected: 'danger', not_affected: 'good', unknown: '' }
function revealAdvisory(id: string) {
  const row = document.getElementById(id)
  for (let node = row; node; node = node.parentElement) if (node instanceof HTMLDetailsElement) node.open = true
  row?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  row?.focus({ preventScroll: true })
}
function SecurityCitation({ source }: { source?: SecuritySource<unknown> }) {
  if (!source) return null
  return <SourceChip source={{ url: source.url, fetchedAt: source.fetchedAt ?? null, fetchedAtDisplay: time(source.fetchedAt), sourceTimestamp: source.sourceTimestamp, cacheStatus: source.status === 'stale' ? 'stale' : undefined, cacheError: source.error }}/>
}
export function SecurityCard({ report, jump }: { report: SecurityReport; jump?: (project: string) => void }) {
  const summary = securityOverview(report)
  return <article className="ar-card ar-metric ar-security-card"><h3 className="ar-eyebrow">版本与安全</h3>
    <strong className="ar-number">{summary.incomplete ? summary.affected.length ? `≥${summary.affected.length}` : '—' : summary.affected.length}<small> / {summary.watched} 受影响</small></strong>
    <p className="ar-note">{summary.unpinned} 个未填运行版本{summary.incomplete ? ` · ${summary.incomplete} 个来源待核对` : ''}</p>
    <div className="ar-security-projects">{report.projects.map(p => <div className="ar-security-scope" key={p.project}><button className="ar-project-jump" onClick={() => jump?.(p.project)}>{projectName(p.project)}{summary.affected.includes(p.project) ? ' · 受影响' : ''} ↗</button></div>)}</div>
    <details className="ar-metric-detail"><summary>官方来源</summary>{report.projects.map(p => <div key={p.project}><SecurityCitation source={p.source}/>{p.error && <p className="ar-error-text">{sourceError(p.error)}</p>}</div>)}</details>
  </article>
}
export function SecurityStrip({ project, security, report, mutate, busy, expanded = false }: {
  project: string; security?: ProjectSecurity; report?: SecurityReport; mutate: Mutate; busy: boolean; expanded?: boolean
}) {
  const [version, setVersion] = useState(security?.pin ?? '')
  const affected = security?.advisories.filter(a => a.verdict === 'affected').length ?? 0
  const unknown = security?.advisories.filter(a => a.verdict === 'unknown').length ?? 0
  const supported = ['kafka', 'hadoop', 'flink'].includes(project)
  return <section className="ar-card ar-section ar-security-strip">
    <div className="ar-card-heading"><h3>版本与安全</h3><span className="ar-muted">{security?.pin ? security.source?.data ? <><Badge tone={affected ? 'danger' : ''}>{affected} 项受影响</Badge> · {unknown} 项无法判断</> : '官方列表不可用，无法判断' : '未填版本 · 无法判断'}{security?.source?.status === 'stale' ? ' · 上次成功缓存' : ''}</span></div>
    {supported && <form className="ar-pin-form" onSubmit={e => { e.preventDefault(); mutate('pin', project, { version }) }}><label htmlFor={`ar-pin-${project}`}>运行版本</label><input id={`ar-pin-${project}`} aria-label={`${projectName(project)} 运行版本`} placeholder="输入实际版本，如 3.9.0" value={version} maxLength={200} onChange={e => setVersion(e.target.value)}/><button disabled={busy} className="ar-primary">保存并核对</button>{security?.pin && <button type="button" disabled={busy} onClick={() => mutate('pin', project, { version: '' })}>清除</button>}</form>}
    <SecurityCitation source={security?.source}/>
    {security?.error && <p className="ar-error-text">{sourceError(security.error)}</p>}
    {!!security?.notices.length && <details className="ar-limits"><summary>来源覆盖说明</summary>{security.notices.map(n => <p className="ar-footnote" key={n}>{n}</p>)}</details>}
    {project === 'flink' && <SecurityCitation source={report?.flinkPointer}/>}
    <details className="ar-advisories" open={expanded || undefined}><summary>官方安全公告 <span className="ar-heading-count">{security?.advisories.length ?? '—'}</span></summary>
      {security?.advisories.map(a => <details className="ar-advisory" id={`${project}-${a.id}`} key={a.id} tabIndex={-1} onToggle={e => {
        if (e.currentTarget.open && a.osv.status === 'unqueried') mutate('osv', project, { cve: a.id })
      }}><summary><Badge tone={verdictTone[a.verdict]}>{verdictName[a.verdict]}</Badge><b>{a.id}</b><span>{a.title}</span><a className="ar-advisory-link" href={a.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>官方原文 ↗</a></summary>
        <div className="ar-advisory-body"><p>{a.reason}</p><dl><dt>官方受影响范围</dt><dd>{a.affectedText}</dd><dt>官方修复版本</dt><dd>{a.fixedText ?? '官方未明确列出'}</dd></dl>
        <SecurityCitation source={{ url: a.url, fetchedAt: a.fetchedAt, sourceTimestamp: a.sourceTimestamp, status: security.source!.status, data: null }}/>
        <details className="ar-limits"><summary>官方说明与适用条件</summary><p>按组件、配置逐项核对；判定不构成生产安全或升级结论。</p>{a.notes.map((note, i) => <p key={i}>{note}</p>)}</details>
        <div className="ar-osv"><h4>OSV · 第二来源</h4><p>{a.osv.data?.label ?? (a.osv.status === 'unqueried' ? '展开后按需查询，不用于官方判定。' : '查询失败，不影响官方判定。')}</p>{a.osvDifference && <p className="ar-error-text">OSV 与官方范围表述不同；官方判定保持不变，请分别核对组件和范围。</p>}<SecurityCitation source={a.osv}/>{a.osv.status === 'failed' && <button disabled={busy} onClick={() => mutate('osv', project, { cve: a.id })}>重试 OSV</button>}{a.osv.data?.record && <details><summary>OSV 范围原文</summary><pre>{JSON.stringify(a.osv.data.record.affected, null, 2)}</pre></details>}</div>
        </div></details>)}
      {!security?.advisories.length && <p className="ar-empty-inline">{sourceError(security?.error) ?? '尚未采集官方列表，请刷新；不能据此认定没有公告。'}</p>}
      {project === 'kafka' && <details className="ar-suppressions"><summary>官方不适用说明 · suppressions</summary><p className="ar-footnote">官方 suppressions 不计为影响 Kafka 的公告。</p><SecurityCitation source={report?.suppressions}/>{report?.suppressions?.data?.suppressions.map(a => <article key={a.id}><b>{a.id}</b><p>{a.notes}</p><SecurityCitation source={{ ...report.suppressions!, url: a.url, fetchedAt: a.fetchedAt }}/></article>)}
        <p><a href="https://security.apache.org/report-dependency/" target="_blank" rel="noreferrer">ASF：如何报告依赖库安全问题 ↗</a></p><SecurityCitation source={report?.guidance}/></details>}
    </details>
  </section>
}

function BriefSection({ part }: { part: string }) {
  if (part.startsWith('# ')) return <details className="ar-card ar-section"><summary>周报信息与统计口径</summary><MarkdownText text={part} labels={labels} omitHtml/></details>
  if (part.startsWith('## 关注项目动态')) return <><h2 className="ar-brief-title">关注项目动态</h2>{part.split('\n').slice(1).join('\n').trim().split(/\n(?=### )/).map((project, i) => <BriefSection part={project} key={i}/>)}</>
  if (part.startsWith('## 本周新公告')) return <article className="ar-card ar-section"><MarkdownText text={part.split('\n').slice(0, 8).join('\n')} labels={labels} omitHtml/>{part.split('\n').length > 8 && <details className="ar-brief-more"><summary>全部新公告与判定</summary><MarkdownText text={part.split('\n').slice(8).join('\n')} labels={labels} omitHtml/></details>}</article>
  if (part.startsWith('## ')) return <details className="ar-card ar-section"><summary>{part.split('\n')[0]!.replace(/^## /, '')}</summary><MarkdownText text={part} labels={labels} omitHtml/></details>
  const lines = part.replace(/^### (kafka|hadoop|flink)\b/, (_, id: string) => `### ${projectName(id)}`).split('\n')
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
  return <><div className="ar-section-heading"><div><h2>每周简报</h2><p>最近 7 天 · 已保存的 Markdown</p></div>
    <div className="ar-actions"><button disabled={busy} onClick={() => request('brief')}>{data.markdown ? '重新生成' : '生成本周周报'}</button>
      {data.markdown && <><button className="ar-primary" onClick={copy}>复制 Markdown</button><button onClick={openFile}>打开已保存文件 ↗</button></>}</div></div>
    {notice && <p role="status" className="ar-muted">{notice}</p>}
    {data.markdown ? <div className="ar-brief">{briefSections(data.markdown).map((part, i) => <BriefSection part={part} key={i}/>)}</div> : <div className="ar-card ar-empty"><Icon size={40}/><h3>第一份周报，从这里开始</h3><p>点击「生成本周周报」，采集关注项目并保存到所选目录。</p></div>}</>
}
export function Dashboard() {
  const [data, setData] = useState<DashboardData>({ directories: [] })
  const [directory, setDirectory] = useState(() => {
    try { return localStorage.getItem('apache-radar.directory') ?? '' } catch { return '' }
  })
  const [choosing, setChoosing] = useState(false)
  const [networkOpen, setNetworkOpen] = useState(false)
  const [networkRevision, setNetworkRevision] = useState(0)
  const [view, setView] = useState('overview')
  const [focusProject, setFocusProject] = useState<string>()
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [diagnosis, setDiagnosis] = useState<unknown>()
  const [proxyDetection, setProxyDetection] = useState<{ source?: string; pacUrl?: string; proxy?: string; warning?: string; detectedAt?: string; ttlSeconds?: number; timeoutSeconds?: number; note?: string }>()
  const generation = useRef(0)
  async function request(action = 'read', project?: string, target = directory, extra?: { version?: string; cve?: string; snapshot?: string }) {
    const version = ++generation.current
    setBusy(true); setError('')
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...(target ? { directory: target } : {}), action, ...extra, ...(project ? { project } : {}) }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? `HTTP ${response.status}`)
      if (generation.current !== version) return
      if (['detect-proxy', 'redetect-proxy', 'apply-proxy', 'clear-proxy'].includes(action)) { setProxyDetection(result); if (action === 'apply-proxy' || action === 'clear-proxy') setNetworkRevision(revision => revision + 1); return }
      if (action === 'diagnose') { setDiagnosis(result); return }
      setData(result); if (result.directory) { setDirectory(result.directory); setChoosing(false); try { localStorage.setItem('apache-radar.directory', result.directory) } catch { /* Directory selection still works without browser storage. */ } }
    } catch (cause) { if (generation.current === version) setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { if (generation.current === version) setBusy(false) }
  }
  async function exportSnapshot() {
    setError('')
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ directory: data.directory, action: 'export' }) })
      if (!response.ok) throw new Error((await response.json()).error)
      const url = URL.createObjectURL(await response.blob()), anchor = document.createElement('a')
      anchor.href = url; anchor.download = 'apache-radar-snapshot.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) { setError(error instanceof Error ? error.message : '快照导出失败') }
  }
  useEffect(() => { void request(); return () => { generation.current++ } }, [])
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  const [clock, setClock] = useState(Date.now())
  const countSources = data.counts ? [...data.counts.counts, ...data.counts.retired].flatMap(r => r.sources) : []
  const securitySources = data.security ? [...data.security.projects.map(p => p.source), data.security.suppressions, data.security.guidance, data.security.flinkPointer].filter(Boolean) : []
  const stale = securitySources.some(s => s?.status === 'stale' || s?.fetchedAt && clock - Date.parse(s.fetchedAt) >= 3_600_000) || countSources.some(s => s.cacheStatus === 'stale' || (s.fetchedAt && clock - Date.parse(s.fetchedAt) >= 3_600_000))
    || data.sources?.some(s => s.status === 'stale' || (s.fetchedAt && clock - Date.parse(s.fetchedAt) >= 3_600_000))
  const failed = securitySources.some(s => s?.status === 'failed') || data.counts && [...data.counts.counts, ...data.counts.retired].some(r => r.status === 'error') || data.sources?.some(s => s.status === 'failed')
  const ready = !!data.counts
  return <div className="ar-root" aria-busy={busy}>
    <style>{css}</style><div className="ar-shell">
    <header className="ar-header"><div className="ar-brand"><span className="ar-brand-icon"><Icon size={27}/></span><div><div className="ar-overline">APACHE / COMMUNITY RADAR</div><h1>Apache 社区雷达</h1></div></div><span className="ar-local"><span className="ar-dot"/>本地工作台 · 无需模型</span></header>
    <div className="ar-projectbar" aria-label="日常操作">{data.directory ? <div className="ar-directory"><span className="ar-dot"/><span title={data.directory}>{data.directory.split(/[\\/]/).filter(Boolean).at(-1)}</span><span className="ar-last">更新 {time(data.collectedAt)}</span></div> : <form onSubmit={e => { e.preventDefault(); void request('read') }}><label htmlFor="ar-directory">项目目录</label><input id="ar-directory" list="ar-directories" value={directory} placeholder="本地项目的绝对路径" onChange={e => setDirectory(e.target.value)} required disabled={busy}/><datalist id="ar-directories">{data.directories.map(d => <option value={d} key={d}/>)}</datalist><button disabled={busy}>打开</button></form>}
      <Button variant="primary" className="ar-primary" disabled={busy || !data.directory} onClick={() => void request('refresh', undefined, data.directory)}><span className={busy ? 'ar-spin' : ''}>↻</span> {busy ? '正在读取…' : '刷新数据'}</Button></div>
    <details className="ar-network" onToggle={e => setNetworkOpen(e.currentTarget.open)}><summary>网络 / 设置</summary><div className="ar-card ar-section ar-network-body">
      <div><h3>连接设置</h3>{networkOpen && <NetworkSettings key={networkRevision} endpoint="/api/apache-radar/network-settings"/>}</div>
      <div><h3>代理与诊断</h3><div className="ar-actions"><button disabled={busy} onClick={() => void request(proxyDetection ? 'redetect-proxy' : 'detect-proxy')}>{proxyDetection ? '重新检测' : '从系统检测代理'}</button><button disabled={busy || !data.directory} onClick={() => void request('diagnose')}>网络诊断</button></div>
        {data.proxyNote && <p className="ar-muted">{data.proxyNote}</p>}
        {proxyDetection && <div className="ar-proxy-result" role="status"><p>{proxyDetection.source ?? '插件设置'} · 超时 {proxyDetection.timeoutSeconds ?? 30} 秒</p>{proxyDetection.pacUrl && <p>PAC：{proxyDetection.pacUrl}</p>}<p>示例代理：{proxyDetection.proxy ?? 'DIRECT / 沿用原访问路径'}</p><p>检测 {proxyDetection.detectedAt ?? '—'} · 缓存 {(proxyDetection.ttlSeconds ?? 1800) / 60} 分钟</p>{proxyDetection.warning && <p>{proxyDetection.warning}</p>}{proxyDetection.note && <p>{proxyDetection.note}</p>}<div className="ar-actions"><button disabled={busy || !proxyDetection.proxy} onClick={() => void request('apply-proxy')}>应用到插件设置</button><button disabled={busy} onClick={() => void request('clear-proxy')}>清空插件代理</button></div></div>}
        {(diagnosis !== undefined || !!data.diagnostics?.length) && <details className="ar-diagnostics"><summary>诊断详情</summary>{data.diagnostics?.map(d => <p key={d.code}>{d.code} · {d.count} 个来源 · {d.hintZh}</p>)}{diagnosis !== undefined && <pre>{JSON.stringify(diagnosis, null, 2)}</pre>}</details>}
        <h3>本地数据</h3><div className="ar-actions"><button disabled={busy || !data.directory} onClick={() => void exportSnapshot()}>导出快照</button><label className="ar-import">导入快照 <input aria-label="导入快照" type="file" accept="application/json,.json" disabled={busy || !data.directory} onChange={async e => {
          const file = e.target.files?.[0]; e.target.value = ''
          if (!file) return
          if (file.size > 32 * 1024 * 1024) { setError('快照超过 32 MiB'); return }
          try { await request('import', undefined, data.directory, { snapshot: await file.text() }) }
          catch { setError('无法读取快照文件') }
        }}/></label></div>
        {data.directory && <><button className="ar-quiet" disabled={busy} onClick={() => setChoosing(!choosing)} aria-expanded={choosing}>切换目录</button>{choosing && <form className="ar-directory-form" onSubmit={e => { e.preventDefault(); void request('read') }}><label htmlFor="ar-change-directory">项目绝对路径</label><input id="ar-change-directory" value={directory} onChange={e => setDirectory(e.target.value)} required disabled={busy}/><button disabled={busy}>打开目录</button></form>}</>}
      </div></div></details>
    <nav className="ar-tabs" aria-label="雷达页面">{[['overview', '总览'], ['watch', '关注动态'], ['brief', '每周简报']].map(([id, title]) => <button key={id} aria-current={view === id ? 'page' : undefined} onClick={() => { setView(id!); setFocusProject(undefined) }}>{title}</button>)}</nav>
    {error && <div className="ar-notice danger" role="alert"><span>{sourceError(error)}{ready ? ' · 保留上次数据' : ''}</span><button disabled={busy} onClick={() => void request('read')}>重试</button></div>}
    {data.localSnapshot && <p className="ar-notice warn" role="status">本地快照 · 非实时数据，请核对来源时间。</p>}
    {!!data.diagnostics?.length ? <p className="ar-notice warn" role="status">{networkHint(data.diagnostics.find(d => d.code === 'TLS_KEY_TOO_SMALL')?.code ?? data.diagnostics[0]!.code)}{stale ? ' · 保留上次数据' : ''}</p> : (stale || failed) && <p className="ar-notice warn" role="status">{stale ? '正在显示上次成功缓存，请刷新后核对。' : '部分来源获取失败，请刷新或查看来源状态。'}</p>}
    {busy && <div role="status" className="ar-loading"><span className="ar-spin">◌</span> 正在读取…</div>}
    {ready ? view === 'overview' ? <Overview data={data} jump={project => { setFocusProject(project); setView("watch") }}/> : view === 'watch' ? <Watch data={data} focusProject={focusProject} mutate={(action, project, extra) => void request(action, project, data.directory, extra)} busy={busy}/> : <Brief data={data} request={action => void request(action, undefined, data.directory)} busy={busy}/>
      : view === 'brief' && data.directory ? <Brief data={data} request={action => void request(action, undefined, data.directory)} busy={busy}/> : !busy && <div className="ar-card ar-empty"><Icon size={44}/><h2>{data.directory ? '开始关注社区变化' : '打开你的项目'}</h2><p>{data.directory ? '点击「刷新数据」获取社区概况与项目动态。' : '填写本地项目目录，开始使用社区雷达。'}</p></div>}
    <footer className="ar-footer"><span>Apache Radar <span className="ar-divider">/</span> 本地 Apache 社区雷达</span><span>公开来源 · UTC+8</span></footer>
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
  ctx.slots.inject('plugins.row.config', () => ctx.slots.register({ name: 'plugins.row.config', key: 'dsh-apache-radar#apache-radar' }, props => <NetworkSettings {...props as NetworkSettingsProps} endpoint="/api/apache-radar/network-settings"/>))
}

const css = `
.ar-security-projects{display:flex;flex-wrap:wrap;gap:3px 12px}
.ar-security-scope{min-width:0}
.ar-security-card .ar-number small{font-size:14px;letter-spacing:0;color:var(--ar-faint)}
.ar-root .ar-project-jump{border:0;padding:0;background:transparent;font-size:11px;justify-content:flex-start;white-space:normal;color:var(--ar-accent)}
.ar-security-strip{border-top:2px solid color-mix(in srgb,var(--ar-accent) 45%,var(--ar-line))}
.ar-pin-form{display:flex;align-items:center;flex-wrap:wrap;gap:9px;margin:16px 0;font-size:12px}
.ar-pin-form input{width:190px;max-width:100%}
.ar-advisories{margin-top:16px;border-top:1px solid var(--ar-line);padding-top:12px}
.ar-advisory{padding:13px 0;border-top:1px solid var(--ar-line);scroll-margin-top:20px}
.ar-advisory:first-of-type{margin-top:12px}
.ar-advisory>summary{position:relative;padding-right:22px;display:flex;align-items:flex-start;gap:10px;list-style:none;flex-wrap:wrap}
.ar-advisory>summary:after{content:'＋';position:absolute;right:0;top:0;color:var(--ar-faint)}
.ar-advisory[open]>summary:after{content:'−'}
.ar-advisory>summary b{font-size:12px;color:var(--ar-text)}
.ar-advisory>summary>span:nth-of-type(2){flex:1;min-width:140px}
.ar-advisory-link{font-size:11px;color:var(--ar-faint);margin-left:auto}
.ar-advisory>summary>span:nth-of-type(2){line-height:1.6}
.ar-limits{margin-top:8px}
.ar-osv{border-top:1px solid var(--ar-line);margin-top:16px;padding-top:4px}
.ar-advisory-body{padding:12px 0 4px;font-size:12px;overflow-wrap:anywhere}
.ar-advisory-body dl{display:grid;grid-template-columns:105px minmax(0,1fr);gap:8px;padding:14px;background:var(--ar-bg);border-radius:8px}
.ar-advisory-body dt{color:var(--ar-faint)}
.ar-advisory-body dd{margin:0;white-space:pre-line}
.ar-advisory-body pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;max-height:200px;overflow:auto}
.ar-advisory-body .ar-citation{margin:10px 0}
.ar-limits p,.ar-suppressions p{margin:10px 0}
.ar-suppressions{border-top:1px solid var(--ar-line);margin-top:15px;padding-top:15px}
.ar-suppressions article{padding:14px 0;border-bottom:1px solid var(--ar-line);font-size:12px;overflow-wrap:anywhere}
.ar-cve-chip{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:8px 0}
.ar-root .ar-cve-chip button{padding:2px 6px;font-size:11px;color:var(--ar-accent)}

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
  max-width:1360px;
  margin:auto;
  padding:36px 40px 24px;
  padding-top:max(40px,var(--dsh-frame-leading-clearance,0px))
}
.ar-root h1,.ar-root h2,.ar-root h3,.ar-root h4,.ar-root p {
  margin:0
}
.ar-root h1 {
  font-size:26px;
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
  color:var(--dsw-alias-label-primary-foreground);
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
  padding:12px 16px;
  margin-top:24px;
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
  margin:8px 0 28px
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
  align-items:baseline;
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
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:12px;
  margin-bottom:22px
}
.ar-metric {
  padding:19px 18px 16px;
  display:flex;
  flex-direction:column;
  gap:9px;
  min-height:175px
}
.ar-featured {
  border-color:color-mix(in srgb,var(--ar-accent) 32%,var(--ar-line));
  background:linear-gradient(125deg,color-mix(in srgb,var(--ar-accent) 6%,var(--ar-card)),var(--ar-card))
}
.ar-root h3.ar-eyebrow {
  font-size:12px;
  font-weight:500;
  color:var(--ar-muted)
}
.ar-number {
  font-size:36px;
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
  font-size:11px;
  line-height:1.7;
  color:var(--ar-faint);
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
.ar-citation>summary{font-size:11px;overflow-wrap:anywhere}
.ar-citation[open]>span{margin-top:5px}
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
  align-items:baseline;
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
  padding:2px 7px;
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
  margin:20px 0
}
.ar-retired-cell {
  padding-right:8px;
  border-right:1px solid var(--ar-line);
  min-width:0;
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
  color:var(--ar-muted);
  line-height:1.7
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
  margin-bottom:16px;
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
  margin-bottom:20px;
  flex-wrap:wrap;
  justify-content:flex-start
}
.ar-watch-toolbar form {
  flex:0 1 auto;
  margin:12px 0
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
  min-width:70px
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
  font-size:11px;
  color:var(--ar-faint);
  flex-wrap:wrap;
  margin-top:7px
}
.ar-security {
  border-left:2px solid var(--ar-error);
  padding-left:14px;
  background:color-mix(in srgb,var(--ar-error) 2%,transparent);
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
  border-color:transparent;
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
  padding:24px 28px
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
.ar-heading-count{font-size:12px;font-weight:500;color:var(--ar-faint);margin-left:8px;letter-spacing:0;font-variant-numeric:tabular-nums}
.ar-metric-detail{margin-top:auto;font-size:11px}
.ar-metric-detail>summary{font-size:11px}
.ar-metric-detail[open] .ar-note{margin:8px 0}
.ar-metric-detail .ar-citation{margin-top:6px}
.ar-network{margin-top:8px}
.ar-network>summary{width:fit-content;margin-left:auto;padding:4px 0;font-size:12px}
.ar-network-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:30px;margin:12px 0 20px}
.ar-network-body>div{min-width:0}
.ar-network-body h3{margin-bottom:12px}
.ar-network-body h3:not(:first-child){margin-top:24px}
.ar-network-body .ar-actions{justify-content:flex-start;flex-wrap:wrap;margin:12px 0;font-size:12px}
.ar-proxy-result,.ar-diagnostics{font-size:12px;overflow-wrap:anywhere;margin:14px 0}
.ar-proxy-result p,.ar-diagnostics p{margin:6px 0}
.ar-diagnostics pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto;font-size:11px}
.ar-import{display:flex;flex-direction:column;gap:6px;max-width:100%;color:var(--ar-muted)}
.ar-import input{max-width:100%;width:245px;font-size:11px}
.ar-directory-form{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px;font-size:12px}
.ar-directory-form input{width:100%}
.ar-root .ar-quiet{background:transparent;border-color:transparent;padding-left:0;font-size:12px;color:var(--ar-muted)}
.ar-manage{margin-left:auto;font-size:12px}
.ar-manage[open]{padding:12px;border:1px solid var(--ar-line);border-radius:10px;background:var(--ar-card)}
.ar-brief{line-height:1.85}
.ar-brief li{margin:8px 0}
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
  .ar-network-body{grid-template-columns:minmax(0,1fr);gap:24px}
  .ar-advisory>summary{gap:7px}
  .ar-advisory>summary>span:nth-of-type(2){flex-basis:100%}
  .ar-advisory-body dl{grid-template-columns:1fr;gap:5px}
  .ar-advisory-body dd+dt{margin-top:8px}
  .ar-categories{grid-template-columns:1fr}
  .ar-directory{flex-wrap:wrap;min-width:0}
  .ar-manage{max-width:100%}
  .ar-watch-toolbar form{flex-wrap:wrap;min-width:0}
  .ar-tabs button{font-size:13px}
  .ar-brand{gap:10px}
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
