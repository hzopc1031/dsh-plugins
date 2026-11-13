import { NetworkSettings, networkHint, type NetworkSettingsProps } from './network-settings.js'
import React, { useEffect, useRef, useState } from 'react'
import { Button, Input, MarkdownText, SegmentedControl, SegmentedTabs, Tag, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
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

const issueTypeName = (type?: string) => ({ bug: '缺陷', improvement: '改进', 'new feature': '新功能', task: '任务', 'sub-task': '子任务', subtask: '子任务', epic: '史诗', wish: '建议', test: '测试', documentation: '文档', 'technical debt': '技术债', security: '安全' })[type?.trim().toLowerCase() ?? ''] ?? (type?.trim() || '其他')
const issueStatusName = (status?: string) => ({ Open: '待处理', 'In Progress': '进行中', Reopened: '重新打开', Resolved: '已解决', Closed: '已关闭', 'Patch Available': '补丁可用', 'In Review': '评审中', 'To Do': '待处理', Done: '已完成' })[status ?? ''] ?? status ?? '状态未知'
const typeTone = (label: string) => label === '安全' ? 'danger' : label === '缺陷' ? 'warn' : label === '改进' || label === '新功能' ? 'accent' : 'neutral'
export function groupIssues(items: Item[]): { label: string; items: Item[] }[] {
  const groups = new Map<string, Item[]>()
  for (const item of items.filter(i => i.kind === 'jira')) {
    const label = item.security ? '安全' : issueTypeName(item.issueType)
    groups.set(label, [...(groups.get(label) ?? []), item])
  }
  const order = ['安全', '缺陷', '改进', '新功能', '任务', '子任务']
  return [...groups].sort(([a], [b]) => (order.includes(a) ? order.indexOf(a) : order.length) - (order.includes(b) ? order.indexOf(b) : order.length) || a.localeCompare(b)).map(([label, items]) => ({ label, items }))
}
export function briefSections(markdown: string): string[] {
  return markdown.split(/\n(?=## )/).filter(part => part.trim())
}
function Icon({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 3.5V12l6-6M3.5 12H7M12 17v3.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>
}
function Badge({ children, tone = '' }: { children: React.ReactNode; tone?: string }) {
  return <Tag className="ar-badge" tone={tone === 'good' ? 'success' : tone === 'warn' ? 'warning' : tone === 'danger' ? 'danger' : tone === 'accent' ? 'info' : 'neutral'}>{children}</Tag>
}
const sourceLabel = (source: Citation) => `${new URL(source.url).hostname} · ${source.cacheStatus === 'stale' ? '旧缓存 · ' : ''}${source.fetchedAt ? time(source.fetchedAt) : '尚未成功抓取'}`
function SourceChip({ source }: { source: Citation }) {
  return <Tooltip label={`${sourceLabel(source)}${source.cacheError ? ` · ${sourceError(source.cacheError)}` : ''}`} portal side="top">
    <a className="ar-source-info" href={source.url} target="_blank" rel="noreferrer" aria-label={`来源 ${new URL(source.url).hostname}`}>ⓘ</a>
  </Tooltip>
}
const metricNote = (row: CountRow) => ({ 'currently-listed': 'TLP 与当前孵化项目', 'chooser-tlps': 'Chooser 顶级项目', 'chooser-podlings': 'Chooser 当前孵化项目', pmcs: '标记为 PMC 的委员会', 'all-committees': '全部委员会，含非 PMC' })[row.id] ?? '独立统计，不合计'
export function CountCard({ row, title, featured = false }: { row: CountRow; title?: string; featured?: boolean }) {
  return <Tooltip label={`${metricNote(row)} · ${row.sources.map(sourceLabel).join(' / ')}`} portal side="top" openOnClick>
    <article tabIndex={0} className={`ar-card ar-metric ${featured ? 'ar-featured' : ''}`} aria-label={`${title ?? row.label} ${row.status === 'ok' ? row.value : '暂无数据'}`}>
      <h3 className="ar-eyebrow">{title ?? row.label}</h3><strong className="ar-number">{row.status === 'ok' ? row.value : '—'}</strong>
      {row.status === 'error' && <p className="ar-error-text">{sourceError(row.error)}</p>}
    </article></Tooltip>
}
const categoryNames: Record<string, string> = { 'Big data & analytics': '大数据与分析', 'Databases & storage': '数据库与存储', 'Streaming & messaging': '流处理与消息', 'Machine learning & AI': '机器学习与 AI', 'Web, HTTP & APIs': 'Web 与 API', 'Cloud & infrastructure': '云与基础设施', 'Build, testing & dev tools': '构建与开发工具', 'Content, search & documents': '内容与搜索', 'IoT & edge': '物联网与边缘', 'Security & identity': '安全与身份', 'Geospatial & science': '地理与科学计算', 'Integration & workflow': '集成与工作流' }
function CategoryChart({ rows }: { rows: (CountRow & { members?: { id: string; name: string }[] })[] }) {
  const sorted = [...rows].sort((a, b) => (b.status === 'ok' ? b.value : 0) - (a.status === 'ok' ? a.value : 0))
  const max = Math.max(1, ...sorted.map(row => row.status === 'ok' ? row.value : 0))
  return <div className="ar-category-chart" role="group" aria-label="领域分布横条图">{sorted.map(row => {
    const preview = row.members?.slice(0, 3).map(m => m.name).join('、')
    const label = categoryNames[row.label] ?? row.label
    return <Tooltip key={row.id} label={`${label} · ${row.status === 'ok' ? row.value : '—'}：${preview || '暂无成员'}${(row.members?.length ?? 0) > 3 ? ` 等 ${row.members!.length} 个` : ''} · 多标签不合计 · ${row.sources.map(s => new URL(s.url).hostname).join(' / ')}`} portal side="top" openOnClick>
      <Button size="sm" variant="ghost" className="ar-category-bar" aria-label={`${label} ${row.status === 'ok' ? row.value : '暂无数据'}`}><span>{label}</span><strong>{row.status === 'ok' ? row.value : '—'}</strong><span className="ar-bar-track" aria-hidden="true"><i style={{ width: `${(row.status === 'ok' ? row.value : 0) / max * 100}%` }}/></span></Button>
    </Tooltip>
  })}</div>
}
export function Overview({ data, jump }: { data: DashboardData; jump?: (project: string) => void }) {
  const counts = data.counts!
  const titles = ['当前列示', '顶级项目 · TLP', '孵化项目 · Podlings', '项目委员会 · PMC', '全部委员会']
  const mismatches = counts.comparisons.filter(c => c.status !== 'match')
  return <>
    <div className="ar-section-heading"><h2>社区概况</h2></div>
    <div className="ar-metrics">{counts.counts.slice(0, 5).map((row, i) => <CountCard key={row.id} row={row} title={titles[i]} featured={i === 0}/>)}</div>
    <div className="ar-overview-grid">
      <section className="ar-card ar-section ar-domain"><div className="ar-card-heading"><h3>领域分布</h3><span className="ar-heading-count">{counts.categories.status === 'ok' ? counts.categories.rows.length : '—'} 个领域</span></div>
        {counts.categories.status === 'error' ? <p className="ar-error-text">{sourceError(counts.categories.error)}</p> : <CategoryChart rows={counts.categories.rows}/>}
      </section>
      <div className="ar-overview-side">{data.security && <SecurityCard report={data.security} jump={jump}/>}
      <section className="ar-card ar-section"><div className="ar-card-heading"><h3>退休与 Attic</h3><Tooltip label="独立统计，不合计" portal openOnClick><Button size="sm" variant="ghost" aria-label="退休统计说明">ⓘ</Button></Tooltip></div>
        <div className="ar-retired">{counts.retired.map(row => <Tooltip key={row.id} label={`独立统计，不合计 · ${row.sources.map(sourceLabel).join(' / ')}`} portal side="top" openOnClick><div tabIndex={0} className="ar-retired-cell"><span>{({ 'retired-whimsy': 'Whimsy 委员会', 'retired-projects': 'Projects 委员会', 'attic-pmcs': 'Attic PMC', 'attic-subprojects': 'Attic 子项目' })[row.id] ?? row.label}</span>
          <strong>{row.status === 'ok' ? row.value : '—'}</strong>{row.status === 'error' && <p className="ar-error-text">{sourceError(row.error)}</p>}</div></Tooltip>)}</div>
        <details className="ar-comparisons"><summary>交叉核对 <Badge tone={mismatches.length ? 'warn' : 'good'}>{mismatches.length ? `${mismatches.length} 项差异` : '一致'}</Badge></summary>{mismatches.map(c => <details className="ar-difference" key={c.id}><summary>{c.label} · {c.status === 'error' ? '无法核对' : '存在差异'}</summary>
          <p>{c.note}</p>{c.status === 'error' ? <p>{sourceError(c.error)}</p> : <><p>仅左侧：{c.onlyLeft.map(m => `${m.name} (${m.id})`).join('、') || '无'}</p><p>仅右侧：{c.onlyRight.map(m => `${m.name} (${m.id})`).join('、') || '无'}</p></>}
          {c.sources.map((s, i) => <SourceChip key={i} source={s}/>)}</details>)}</details>
      </section></div>
    </div>
    <details className="ar-card ar-section ar-methodology"><summary>孵化项目交叉核对与统计说明</summary><p>{counts.explanation}</p>
      <div className="ar-two-col">{counts.counts.slice(5).map(row => <CountCard key={row.id} row={row}/>)}</div>
      {counts.comparisons.filter(c => c.status === 'match').map(c => <p key={c.id}>{c.label}：名单一致。{c.sources.map((s, i) => <SourceChip key={i} source={s}/>)}</p>)}
    </details>
  </>
}
function ItemRow({ item, security }: { item: Item; security?: ProjectSecurity }) {
  const kind = ({ release: '发布', jira: 'JIRA', proposal: '提案' })[item.kind]
  return <article className={`ar-item ${item.security ? 'ar-security' : ''}`}>
    <div className="ar-item-meta"><Badge tone={item.security ? 'danger' : ''}>{item.security ? `安全 · ${kind}` : item.kind === 'jira' ? issueTypeName(item.issueType) : kind}</Badge>
      {item.status && <Badge tone={['accepted', 'implemented', 'released'].includes(item.status) ? 'good' : ''}>{item.kind === 'jira' ? issueStatusName(item.statusText ?? item.status) : item.statusText ?? item.status}</Badge>}
      <span>{item.kind === 'jira' ? item.id : item.version}</span><time>{item.date ? time(item.date).slice(0, 10) : '日期未知 · 参考条目'}</time></div>
    <a className="ar-item-title" href={item.url} target="_blank" rel="noreferrer">{item.title}<span aria-label="打开原文"> ↗</span></a>
    {!!item.security && jiraCves(item.title, true, security).map(cve => <div className="ar-cve-chip" key={cve.id} title={`按已抓取官方列表核对 · ${time(cve.fetchedAt)}${cve.stale ? ' · 旧缓存' : ''}`}>
      {cve.status === 'published' ? <Button size="sm" variant="outline" onClick={() => revealAdvisory(`${item.project}-${cve.id}`)}>{cve.id} · {cve.label} ↗</Button> : <Badge>{cve.id} · {cve.label}</Badge>}
    </div>)}
    <div className="ar-item-links">{!!item.fixVersions?.length && <Tooltip label="目标版本，不代表已发布" portal openOnClick><span tabIndex={0}>目标 {item.fixVersions.join('、')}</span></Tooltip>}<a href={item.sourceUrl} target="_blank" rel="noreferrer">采集来源 ↗</a>{item.notesUrl && <a href={item.notesUrl} target="_blank" rel="noreferrer">版本说明 ↗</a>}</div>
  </article>
}
function ItemList({ items, empty, security }: { items: Item[]; empty: string; security?: ProjectSecurity }) {
  const [expanded, setExpanded] = useState(false)
  return <>{items.length ? (expanded ? items : items.slice(0, 4)).map(item => <ItemRow key={item.url} item={item} security={security}/>) : <p className="ar-empty-inline">{empty}</p>}
    {items.length > 4 && <Button size="sm" variant="outline" className="ar-more" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? '收起' : '展开其余条目'}</Button>}</>
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
    <div className="ar-section-heading"><h2>项目动态 <span className="ar-heading-count">{data.watchList?.length ?? 0}</span></h2><span className="ar-muted">最近 7 天</span></div>
    <div className="ar-watch-toolbar"><SegmentedControl id="ar-project" label="关注项目" value={project} options={(data.watchList ?? []).map(id => ({ value: id, label: projectName(id) }))} onChange={setSelected}/>

      <details className="ar-manage" open={!project || undefined}><summary>管理关注</summary><form onSubmit={e => { e.preventDefault(); mutate('add', newId); setNewId('') }}><Input aria-label="添加项目 id" placeholder="项目 id，如 spark" pattern="[a-zA-Z][a-zA-Z0-9-]*" required value={newId} onChange={e => setNewId(e.target.value)}/><Button type="submit" size="sm" variant="outline" disabled={busy}>＋ 关注</Button></form>
      {project && <Button size="sm" variant="outline" disabled={busy} onClick={() => mutate('remove', project)} aria-label={`取消关注 ${projectName(project)}`}>取消关注</Button>}</details></div>
    {project ? <div role="tabpanel" id={`ar-project-${project}-panel`} aria-labelledby={`ar-project-${project}`}><SecurityStrip key={project + (security?.pin ?? "")} project={project} security={security} report={data.security} mutate={mutate} busy={busy} expanded={focusProject === project}/><div className="ar-two-col"><section className="ar-card ar-section"><div className="ar-card-heading"><h3>正式发布 <span className="ar-heading-count">{items.filter(i => i.kind === 'release').length}</span></h3></div>
      <ItemList key={project + 'release'} items={items.filter(i => i.kind === 'release')} empty="近 7 天暂无已收录发布。"/>
    </section><section className="ar-card ar-section"><div className="ar-card-heading"><h3>{project === 'kafka' ? 'KIP' : project === 'flink' ? 'FLIP' : '提案'} <span className="ar-heading-count">{items.filter(i => i.kind === 'proposal').length}</span></h3></div>
      <ItemList key={project + 'proposal'} items={items.filter(i => i.kind === 'proposal')} empty={project === 'hadoop' ? 'Hadoop 没有已验证的通用 HIP 索引。' : '近 7 天暂无已收录提案。'}/>
    </section></div>
    <section className="ar-card ar-section"><div className="ar-card-heading"><h3>JIRA <span className="ar-heading-count">{items.filter(i => i.kind === 'jira').length}</span></h3><Tooltip label="首个响应页；工单不代表已发布" portal openOnClick><Button size="sm" variant="ghost" aria-label="JIRA 采集说明">ⓘ</Button></Tooltip></div>
      <IssueDistribution items={items}/>
      <div className="ar-issue-board">{groupIssues(items).length ? groupIssues(items).map(group => <details data-issue-type={group.label} className={`ar-issue-group ar-tone-${typeTone(group.label)}`} key={project + group.label} open={group.label === '安全'}><summary><i className="ar-type-dot"/>{group.label} <span className="ar-heading-count">{group.items.length}</span></summary><ItemList items={group.items} empty="" security={security}/></details>) : <p className="ar-empty-inline">近 7 天暂无已收录 JIRA；请核对来源状态。</p>}</div>
    </section>
    <details className="ar-card ar-section"><summary>参考提案 · 日期未知，不计入本周</summary><ItemList key={project + 'undated'} items={undated} empty="暂无日期未知的参考条目。"/></details>
    <details className="ar-card ar-section"><summary>采集窗口与来源状态</summary><p className="ar-muted">{data.window?.label}</p><Sources sources={sources}/></details></div> : <div className="ar-card ar-empty"><h3>关注列表是空的</h3><p>添加一个项目 id，开始整理它的动态。</p></div>}
  </>
}

function IssueDistribution({ items }: { items: Item[] }) {
  const groups = groupIssues(items)
  const total = groups.reduce((n, group) => n + group.items.length, 0)
  return <div className="ar-type-distribution" aria-label="JIRA 类型分布">
    <div className="ar-stacked" aria-hidden="true">{groups.map(group => <span key={group.label} className={`ar-tone-${typeTone(group.label)}`} style={{ flex: group.items.length }}/>)}</div>
    <div className="ar-type-legend">{groups.map(group => <Tooltip key={group.label} label={`${group.label} ${group.items.length} · ${Math.round(group.items.length / total * 100)}%`} portal><Button size="sm" variant="outline" className={`ar-type-pill ar-tone-${typeTone(group.label)}`} onClick={e => {
      const rows = e.currentTarget.closest('section')?.querySelectorAll<HTMLDetailsElement>('.ar-issue-group')
      const target = Array.from(rows ?? []).find(row => row.dataset.issueType === group.label)
      if (target) {
        target.open = true
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        target.querySelector('summary')?.focus()
      }
    }}><i className="ar-type-dot"/>{group.label}<strong>{group.items.length}</strong></Button></Tooltip>)}</div>
  </div>
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
  const withPin = report.projects.filter(p => p.pin).length
  return <article className="ar-card ar-section ar-security-card"><div className="ar-card-heading"><h3>版本与安全</h3><Badge tone={summary.affected.length ? 'danger' : ''}>{summary.incomplete ? `${summary.affected.length ? `≥${summary.affected.length} 受影响` : '—'} · 来源待核对` : `${summary.affected.length} 个项目受影响`}</Badge></div>
    <div className="ar-security-overview"><Tooltip label={`已填版本 ${withPin} / ${summary.watched}；未填版本或来源不完整时无法判断`} portal openOnClick><div tabIndex={0} className="ar-donut" role="img" aria-label={`运行版本覆盖 ${withPin} / ${summary.watched}`} style={{ '--ar-ring': `${summary.watched ? withPin / summary.watched * 100 : 0}%` } as React.CSSProperties}><span><strong>{withPin}<small> / {summary.watched}</small></strong><small>已填版本</small></span></div></Tooltip>
    <div className="ar-security-projects">{report.projects.map(p => <Button key={p.project} size="sm" variant="ghost" className="ar-project-jump" onClick={() => jump?.(p.project)}><span>{projectName(p.project)}</span><Badge tone={summary.affected.includes(p.project) ? 'danger' : ''}>{summary.affected.includes(p.project) ? '受影响' : !p.pin ? '未填版本' : !p.source?.data ? '待核对' : '已核对'}</Badge><span>↗</span></Button>)}</div></div>
    <p className="ar-note">{summary.unpinned} 个未填运行版本{summary.incomplete ? ` · ${summary.incomplete} 个来源待核对` : ''}</p>
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
    {supported && <form className="ar-pin-form" onSubmit={e => { e.preventDefault(); mutate('pin', project, { version }) }}><label htmlFor={`ar-pin-${project}`}>运行版本</label><Input id={`ar-pin-${project}`} aria-label={`${projectName(project)} 运行版本`} placeholder="输入实际版本，如 3.9.0" value={version} maxLength={200} onChange={e => setVersion(e.target.value)}/><Button type="submit" size="sm" variant="primary" disabled={busy} className="ar-primary">保存并核对</Button>{security?.pin && <Button size="sm" variant="outline" type="button" disabled={busy} onClick={() => mutate('pin', project, { version: '' })}>清除</Button>}</form>}
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
        <div className="ar-osv"><h4>OSV · 第二来源</h4><p>{a.osv.data?.label ?? (a.osv.status === 'unqueried' ? '展开后按需查询，不用于官方判定。' : '查询失败，不影响官方判定。')}</p>{a.osvDifference && <p className="ar-error-text">OSV 与官方范围表述不同；官方判定保持不变，请分别核对组件和范围。</p>}<SecurityCitation source={a.osv}/>{a.osv.status === 'failed' && <Button size="sm" variant="outline" disabled={busy} onClick={() => mutate('osv', project, { cve: a.id })}>重试 OSV</Button>}{a.osv.data?.record && <details><summary>OSV 范围原文</summary><pre>{JSON.stringify(a.osv.data.record.affected, null, 2)}</pre></details>}</div>
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
  if (part.startsWith('## 本周新公告')) return <details className="ar-card ar-section"><summary>本周新公告 <Badge>{part.split('\n').filter(line => /^- (kafka|hadoop|flink) \/ CVE-/.test(line)).length}</Badge></summary><MarkdownText text={part} labels={labels} omitHtml/></details>
  if (part.startsWith('## ')) return <details className="ar-card ar-section"><summary>{part.split('\n')[0]!.replace(/^## /, '')}</summary><MarkdownText text={part} labels={labels} omitHtml/></details>
  const lines = part.split('\n')
  // shortcut: generated brief bullets only; use a Markdown AST if the saved format changes.
  const entries = lines.filter(line => line.startsWith('- **'))
  if (!part.startsWith('### ') || !entries.length) return <article className="ar-card ar-section"><MarkdownText text={part} labels={labels} omitHtml/></article>
  return <article className="ar-card ar-section"><div className="ar-card-heading"><h3>{projectName(lines[0]!.replace(/^### /, ''))}</h3><Badge>{entries.length}</Badge></div>
    {entries.slice(0, 2).map((line, i) => {
      const split = line.indexOf('；[原文](')
      const title = (split < 0 ? line : line.slice(0, split)).replace(/^- \*\*[^*]+\*\* /, '')
      const link = line.match(/\[原文\]\([^)]+\)/)?.[0] ?? ''
      const type = line.match(/类型：([^；]+)/)?.[1]
      const status = line.match(/状态：([^；]+)/)?.[1]
      const security = line.startsWith('- **安全')
      return <div className="ar-item" key={i}><div className="ar-item-meta"><Badge tone={security ? 'danger' : 'accent'}>{security ? '安全' : type ? issueTypeName(type) : line.match(/^- \*\*([^*]+)\*\*/)?.[1]}</Badge>{status && <Badge>{issueStatusName(status)}</Badge>}<time>{line.match(/日期：(\d{4}-\d{2}-\d{2})/)?.[1]}</time></div><MarkdownText text={`${title} ${link}`} labels={labels} omitHtml/></div>
    })}
    <details className="ar-brief-more"><summary>展开其余周报条目</summary><MarkdownText text={lines.slice(1).join('\n')} labels={labels} omitHtml/></details>
  </article>
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
    <div className="ar-actions"><Button size="sm" variant="outline" disabled={busy} onClick={() => request('brief')}>{data.markdown ? '重新生成' : '生成本周周报'}</Button>
      {data.markdown && <><Button size="sm" variant="outline" className="ar-primary" onClick={copy}>复制 Markdown</Button><Button size="sm" variant="outline" onClick={openFile}>打开已保存文件 ↗</Button></>}</div></div>
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
    <header className="ar-header"><div className="ar-brand"><span className="ar-brand-icon"><Icon size={27}/></span><div><div className="ar-overline">APACHE / COMMUNITY RADAR</div><h1>Apache 社区雷达</h1></div></div><Tag tone="quiet">v0.1.5</Tag></header>
    <div className="ar-projectbar" aria-label="日常操作">{data.directory ? <div className="ar-directory"><span className="ar-dot"/><span title={data.directory}>{data.directory.split(/[\\/]/).filter(Boolean).at(-1)}</span><span className="ar-last">更新 {time(data.collectedAt)}</span></div> : <form onSubmit={e => { e.preventDefault(); void request('read') }}><label htmlFor="ar-directory">项目目录</label><Input id="ar-directory" list="ar-directories" value={directory} placeholder="本地项目的绝对路径" onChange={e => setDirectory(e.target.value)} required disabled={busy}/><datalist id="ar-directories">{data.directories.map(d => <option value={d} key={d}/>)}</datalist><Button type="submit" size="sm" variant="outline" disabled={busy}>打开</Button></form>}
      <Button variant="primary" className="ar-primary" disabled={busy || !data.directory} onClick={() => void request('refresh', undefined, data.directory)}><span className={busy ? 'ar-spin' : ''}>↻</span> {busy ? '正在读取…' : '刷新数据'}</Button></div>
    <details className="ar-network" onToggle={e => setNetworkOpen(e.currentTarget.open)}><summary>网络 / 设置</summary><div className="ar-card ar-section ar-network-body">
      <div><div className="ar-card-heading"><h3>连接设置</h3><Tooltip label="跳过校验会降低连接安全性；限定开关仅用于 api.osv.dev / api.github.com" portal openOnClick><Button size="sm" variant="ghost" aria-label="证书校验说明">ⓘ</Button></Tooltip></div>{networkOpen && <NetworkSettings key={networkRevision} endpoint="/api/apache-radar/network-settings"/>}</div>
      <div><h3>代理与诊断</h3><div className="ar-actions"><Button size="sm" variant="outline" disabled={busy} onClick={() => void request(proxyDetection ? 'redetect-proxy' : 'detect-proxy')}>{proxyDetection ? '重新检测' : '从系统检测代理'}</Button><Button size="sm" variant="outline" disabled={busy || !data.directory} onClick={() => void request('diagnose')}>网络诊断</Button></div>
        {data.proxyNote && !proxyDetection && <Tooltip label={data.proxyNote} portal openOnClick><Button size="sm" variant="ghost" aria-label="代理状态说明">自动代理 ⓘ</Button></Tooltip>}
        {proxyDetection && <div className="ar-proxy-result" role="status"><Tooltip label={data.proxyNote ?? '当前系统代理检测结果'} portal openOnClick><p tabIndex={0}>{proxyDetection.source ?? '插件设置'} · {proxyDetection.proxy ? '检测到代理' : '直连'} · {proxyDetection.timeoutSeconds ?? 30}s ⓘ</p></Tooltip><details><summary>详情</summary>{proxyDetection.pacUrl && <p>PAC：{proxyDetection.pacUrl}</p>}<p>代理：{proxyDetection.proxy ?? 'DIRECT'}</p><p>检测 {proxyDetection.detectedAt ?? '—'} · 缓存 {(proxyDetection.ttlSeconds ?? 1800) / 60} 分钟</p>{proxyDetection.warning && <p>{proxyDetection.warning}</p>}{proxyDetection.note && <p>{proxyDetection.note}</p>}</details><div className="ar-actions"><Button size="sm" variant="outline" disabled={busy || !proxyDetection.proxy} onClick={() => void request('apply-proxy')}>应用到插件设置</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void request('clear-proxy')}>清空插件代理</Button></div></div>}
        {(diagnosis !== undefined || !!data.diagnostics?.length) && <details className="ar-diagnostics"><summary>诊断详情</summary>{data.diagnostics?.map(d => <p key={d.code}>{d.code} · {d.count} 个来源 · {d.hintZh}</p>)}{diagnosis !== undefined && <pre>{JSON.stringify(diagnosis, null, 2)}</pre>}</details>}
        <h3>本地数据</h3><div className="ar-actions"><Button size="sm" variant="outline" disabled={busy || !data.directory} onClick={() => void exportSnapshot()}>导出快照</Button><label className="ar-import">导入快照 <input aria-label="导入快照" type="file" accept="application/json,.json" disabled={busy || !data.directory} onChange={async e => {
          const file = e.target.files?.[0]; e.target.value = ''
          if (!file) return
          if (file.size > 32 * 1024 * 1024) { setError('快照超过 32 MiB'); return }
          try { await request('import', undefined, data.directory, { snapshot: await file.text() }) }
          catch { setError('无法读取快照文件') }
        }}/></label></div>
        {data.directory && <><Button size="sm" variant="outline" className="ar-quiet" disabled={busy} onClick={() => setChoosing(!choosing)} aria-expanded={choosing}>切换目录</Button>{choosing && <form className="ar-directory-form" onSubmit={e => { e.preventDefault(); void request('read') }}><label htmlFor="ar-change-directory">项目绝对路径</label><Input id="ar-change-directory" value={directory} onChange={e => setDirectory(e.target.value)} required disabled={busy}/><Button type="submit" size="sm" variant="outline" disabled={busy}>打开目录</Button></form>}</>}
      </div></div></details>
    <nav className="ar-tabs" aria-label="雷达页面"><SegmentedTabs size="sm" label="雷达页面" value={view} onChange={id => { setView(id); setFocusProject(undefined) }} items={[
      { value: 'overview', label: '总览', id: 'ar-overview-tab', panelId: 'ar-overview-panel' },
      { value: 'watch', label: '关注动态', id: 'ar-watch-tab', panelId: 'ar-watch-panel' },
      { value: 'brief', label: '每周简报', id: 'ar-brief-tab', panelId: 'ar-brief-panel' },
    ]}/></nav>
    {error && <div className="ar-notice danger" role="alert"><span>{sourceError(error)}{ready ? ' · 保留上次数据' : ''}</span><Button size="sm" variant="outline" disabled={busy} onClick={() => void request('read')}>重试</Button></div>}
    {data.localSnapshot && <p className="ar-notice warn" role="status">本地快照 · 非实时数据，请核对来源时间。</p>}
    {!!data.diagnostics?.length ? <p className="ar-notice warn" role="status">{networkHint(data.diagnostics.find(d => d.code === 'TLS_KEY_TOO_SMALL')?.code ?? data.diagnostics[0]!.code)}{stale ? ' · 保留上次数据' : ''}</p> : (stale || failed) && <p className="ar-notice warn" role="status">{stale ? '正在显示上次成功缓存，请刷新后核对。' : '部分来源获取失败，请刷新或查看来源状态。'}</p>}
    {busy && !ready && <div role="status" aria-label="正在读取" className="ar-loading"><span className="ar-spin">◌</span></div>}
    <div role="tabpanel" id={`ar-${view}-panel`} aria-labelledby={`ar-${view}-tab`}>{ready ? view === 'overview' ? <Overview data={data} jump={project => { setFocusProject(project); setView("watch") }}/> : view === 'watch' ? <Watch data={data} focusProject={focusProject} mutate={(action, project, extra) => void request(action, project, data.directory, extra)} busy={busy}/> : <Brief data={data} request={action => void request(action, undefined, data.directory)} busy={busy}/>
      : view === 'brief' && data.directory ? <Brief data={data} request={action => void request(action, undefined, data.directory)} busy={busy}/> : !busy && <div className="ar-card ar-empty"><Icon size={44}/><h2>{data.directory ? '开始关注社区变化' : '打开你的项目'}</h2><p>{data.directory ? '点击「刷新数据」获取社区概况与项目动态。' : '填写本地项目目录，开始使用社区雷达。'}</p></div>}
    </div><footer className="ar-footer"><span>Apache Radar · 0.1.5</span></footer>
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
.ar-root{--ar-bg:var(--dsw-alias-bg-module-platform);--ar-card:var(--dsw-alias-bg-layer-1);--ar-text:var(--dsw-alias-label-primary);--ar-muted:var(--dsw-alias-label-secondary);--ar-faint:var(--dsw-alias-label-secondary);--ar-line:var(--dsw-alias-border-l2);--ar-accent:var(--dsw-alias-state-business-primary);--ar-warn:var(--dsw-alias-state-warn-primary);--ar-error:var(--dsw-alias-state-error-primary);--ar-success:var(--dsw-alias-state-success-primary);height:100%;overflow:auto;background:var(--ar-bg);color:var(--ar-text);font-family:inherit;font-size:13px;line-height:1.6;container-type:inline-size}
.ar-root *{box-sizing:border-box}
.ar-shell{max-width:1400px;margin:auto;padding:24px 28px;padding-top:max(24px,var(--dsh-frame-leading-clearance,0px))}
.ar-root :is(h1,h2,h3,h4,p){margin:0}
.ar-root h1{font-size:23px;letter-spacing:-.6px;font-weight:500}
.ar-root h2{font-size:17px;font-weight:500}
.ar-root h3{font-size:14px;font-weight:500}
.ar-root h4{font-size:12px;font-weight:500;margin:12px 0 4px;color:var(--ar-muted)}
.ar-root strong,.ar-root b{font-weight:500;font-variant-numeric:tabular-nums}
.ar-root a{color:inherit;text-decoration:none;overflow-wrap:anywhere}
.ar-root a:focus-visible{text-decoration:underline}
.ar-root :is(button,a,input,summary,[tabindex]):focus-visible{outline:2px solid var(--ar-accent);outline-offset:3px}
.ar-root button{font-family:inherit;flex-shrink:0}
.ar-root input{min-width:0}
.ar-root form>span:has(input){min-width:0;max-width:100%}
.ar-root :is(.ar-error-text,.ar-diagnostics,.ar-difference,.ar-notice){overflow-wrap:anywhere}
.ar-header,.ar-brand,.ar-projectbar,.ar-actions,.ar-card-heading,.ar-section-heading,.ar-watch-toolbar,.ar-footer{display:flex;align-items:center;justify-content:space-between;gap:12px}
.ar-brand{justify-content:flex-start;gap:12px}
.ar-brand-icon{width:40px;height:40px;display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--ar-accent) 24%,var(--ar-line));border-radius:var(--dsw-radius-md,12px);color:var(--ar-accent);background:color-mix(in srgb,var(--ar-accent) 8%,var(--ar-card))}
.ar-overline{font-size:10px;letter-spacing:1.5px;color:var(--ar-muted)}
.ar-projectbar{flex-wrap:wrap;margin-top:16px;padding:10px 12px;border:1px solid var(--ar-line);border-radius:var(--dsw-radius-md,12px);background:var(--ar-card);font-size:12px}
.ar-directory{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-width:0;color:var(--ar-muted)}
.ar-directory>span{overflow-wrap:anywhere}
.ar-last{font-size:11px;color:var(--ar-muted)}
.ar-dot{width:5px;height:5px;border-radius:50%;display:inline-block;flex:none;background:var(--ar-success)}
.ar-projectbar form,.ar-directory-form,.ar-watch-toolbar form{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-width:0}
.ar-projectbar form{flex:1}.ar-projectbar form>span:has(input){flex:1;max-width:450px}
.ar-tabs{display:flex;margin:8px 0 18px;border-bottom:1px solid var(--ar-line);padding-bottom:10px}.ar-tabs>[role=tablist]{width:300px;max-width:100%}
.ar-section-heading{margin:0 0 12px;flex-wrap:wrap}
.ar-section-heading p{font-size:12px;color:var(--ar-muted)}
.ar-card{min-width:0;border:1px solid var(--ar-line);border-radius:var(--dsw-radius-md,12px);background:var(--ar-card);box-shadow:0 2px 6px color-mix(in srgb,var(--ar-text) 3%,transparent)}
.ar-section{padding:16px;margin-bottom:12px}
.ar-card-heading{margin-bottom:12px;flex-wrap:wrap;min-height:24px}
.ar-card-heading>h3{display:flex;align-items:center}
.ar-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:12px}
.ar-metric{padding:13px 16px;display:flex;flex-direction:column;gap:5px;position:relative}
.ar-metric:after{content:'';position:absolute;left:16px;right:16px;bottom:0;height:2px;background:color-mix(in srgb,var(--ar-accent) 18%,transparent)}
.ar-featured{border-color:color-mix(in srgb,var(--ar-accent) 40%,var(--ar-line));background:linear-gradient(120deg,color-mix(in srgb,var(--ar-accent) 9%,var(--ar-card)),var(--ar-card))}
.ar-featured .ar-number{color:var(--ar-accent)}
.ar-root h3.ar-eyebrow{font-size:12px;color:var(--ar-muted);font-weight:400}
.ar-number{font-size:32px;line-height:1.25;letter-spacing:-1px}
.ar-overview-grid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:12px;align-items:stretch;margin-bottom:12px}
.ar-overview-grid>.ar-section,.ar-overview-side>.ar-section{margin:0}
.ar-overview-side{display:grid;gap:12px;align-content:start;min-width:0}
.ar-domain{display:flex;flex-direction:column}
.ar-category-chart{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 18px;align-content:space-between;flex:1}
.ar-root .ar-category-bar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px 12px;height:auto;padding:8px 0;border-radius:0;text-align:left;background:transparent;width:100%;font-size:12px;white-space:normal;line-height:1.5}
.ar-category-bar>span:first-child{color:var(--ar-muted)}
.ar-category-bar strong{color:var(--ar-text)}
.ar-bar-track{grid-column:1/-1;display:block;height:7px;border-radius:3px;overflow:hidden;background:color-mix(in srgb,var(--ar-accent) 9%,var(--ar-card))}
.ar-bar-track i{display:block;height:100%;border-radius:3px;background:var(--ar-accent)}
.ar-category-bar:nth-child(even) .ar-bar-track i{opacity:.65}
.ar-security-overview{display:flex;align-items:center;gap:20px;margin:12px 0}
.ar-donut{corner-shape:round;width:112px;height:112px;flex:none;border-radius:50%;background:conic-gradient(var(--ar-accent) var(--ar-ring),color-mix(in srgb,var(--ar-accent) 12%,var(--ar-card)) 0);display:grid;place-items:center}
.ar-donut>span{corner-shape:round;display:flex;align-items:center;justify-content:center;flex-direction:column;width:90px;height:90px;border-radius:50%;background:var(--ar-card)}
.ar-donut strong{font-size:28px;line-height:1.2}.ar-donut small{font-size:11px;color:var(--ar-muted);margin-top:3px}
.ar-security-projects{display:grid;gap:4px;flex:1;min-width:0}
.ar-root .ar-project-jump{width:100%;justify-content:space-between;padding:3px 0;height:auto;min-height:28px;gap:6px;white-space:normal;font-size:12px}
.ar-note,.ar-footnote{font-size:11px;color:var(--ar-muted)}
.ar-retired{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:10px 0 12px}
.ar-retired-cell{font-size:11px;color:var(--ar-muted);min-width:0;overflow-wrap:anywhere}
.ar-retired-cell strong{font-size:25px;display:block;line-height:1.4;color:var(--ar-text)}
.ar-comparisons{border-top:1px solid var(--ar-line);padding-top:9px}
.ar-root summary{cursor:pointer;font-size:12px;color:var(--ar-muted);line-height:1.7}
.ar-root summary::marker{font-size:10px}
.ar-comparisons summary .ar-badge{margin-left:8px}
.ar-difference{border-top:1px solid var(--ar-line);padding:10px 0;font-size:12px}
.ar-difference p,.ar-methodology[open]>p{margin:10px 0}
.ar-heading-count{font-size:12px;font-weight:400;color:var(--ar-muted);margin-left:8px;font-variant-numeric:tabular-nums}
.ar-muted{font-size:12px;color:var(--ar-muted)}
.ar-error-text{font-size:12px;color:var(--ar-error)}
.ar-notice{font-size:12px;padding:9px 12px;border:1px solid var(--ar-line);border-radius:8px;margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.ar-notice.warn{color:var(--ar-warn);background:color-mix(in srgb,var(--ar-warn) 5%,var(--ar-card));border-color:color-mix(in srgb,var(--ar-warn) 25%,var(--ar-line))}
.ar-notice.danger{color:var(--ar-error)}
.ar-loading{min-height:180px;display:grid;place-items:center;font-size:28px;color:var(--ar-muted)}
.ar-spin{display:inline-block;animation:ar-spin 1.4s linear infinite}@keyframes ar-spin{to{transform:rotate(360deg)}}
.ar-empty{padding:48px 20px;text-align:center;color:var(--ar-muted)}
.ar-empty svg{color:var(--ar-accent);margin-bottom:12px}.ar-empty h2,.ar-empty h3{color:var(--ar-text);margin-bottom:8px}.ar-empty p{font-size:13px}
.ar-empty-inline{font-size:12px;color:var(--ar-muted);padding:10px 0}
.ar-watch-toolbar{margin-bottom:12px;flex-wrap:wrap;justify-content:flex-start}
.ar-manage{margin-left:auto;max-width:100%}.ar-manage[open]{padding:10px;border:1px solid var(--ar-line);border-radius:8px;background:var(--ar-card)}
.ar-manage form{margin:8px 0}
.ar-security-strip{border-top:2px solid color-mix(in srgb,var(--ar-accent) 50%,var(--ar-line))}
.ar-pin-form{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:8px 0;font-size:12px}.ar-pin-form>span:has(input){width:190px}
.ar-security-strip>.ar-source-info{float:right}.ar-root .ar-source-info{display:inline-flex;align-items:center;justify-content:center;width:24px;min-width:24px;height:24px;padding:0;color:var(--ar-muted)}
.ar-limits{margin:6px 0}.ar-limits p{margin:8px 0}
.ar-advisories{margin-top:10px;padding-top:10px;border-top:1px solid var(--ar-line)}
.ar-advisory{padding:10px 0;border-top:1px solid var(--ar-line);scroll-margin-top:20px}.ar-advisory:first-of-type{margin-top:10px}
.ar-advisory>summary{position:relative;display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap;list-style:none;padding-right:20px}
.ar-advisory>summary:after{content:'＋';position:absolute;right:0;top:0}.ar-advisory[open]>summary:after{content:'−'}
.ar-advisory>summary>span:nth-of-type(2){flex:1;min-width:140px;line-height:1.6}.ar-advisory-link{font-size:11px;margin-left:auto}
.ar-advisory-body{font-size:13px;padding:12px 0 4px;overflow-wrap:anywhere}
.ar-advisory-body dl{display:grid;grid-template-columns:105px minmax(0,1fr);gap:8px;padding:12px;background:var(--ar-bg);border-radius:8px}.ar-advisory-body dd{margin:0;white-space:pre-line}.ar-advisory-body dt{color:var(--ar-muted)}
.ar-advisory-body pre,.ar-diagnostics pre{font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto}
.ar-osv,.ar-suppressions{border-top:1px solid var(--ar-line);padding-top:10px;margin-top:12px}.ar-suppressions article{padding:12px 0;border-bottom:1px solid var(--ar-line);font-size:12px;overflow-wrap:anywhere}
.ar-cve-chip{margin:6px 0;display:flex;flex-wrap:wrap;gap:8px}.ar-root .ar-cve-chip button{color:var(--ar-accent);font-size:11px}
.ar-two-col{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:12px;align-items:start}.ar-two-col>.ar-section{margin:0}
.ar-item{padding:10px 0;border-bottom:1px solid var(--ar-line);min-width:0}.ar-item:last-child{border-bottom:0}
.ar-item-meta{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:11px;color:var(--ar-muted);margin-bottom:5px}.ar-item-meta time{margin-left:auto;font-variant-numeric:tabular-nums}
.ar-item-title{display:block;font-size:13px;font-weight:500;line-height:1.6;overflow-wrap:anywhere}.ar-item-title>span{color:var(--ar-muted);font-size:11px}
.ar-item-links{display:flex;flex-wrap:wrap;gap:10px;margin-top:5px;font-size:11px;color:var(--ar-muted)}
.ar-tone-danger{--ar-type:var(--ar-error)}.ar-tone-warn{--ar-type:var(--ar-warn)}.ar-tone-accent{--ar-type:var(--ar-accent)}.ar-tone-neutral{--ar-type:var(--dsw-alias-label-secondary)}
.ar-stacked{display:flex;gap:2px;height:9px;border-radius:4px;overflow:hidden;background:var(--ar-bg);margin:4px 0 10px}.ar-stacked>span{background:var(--ar-type)}
.ar-type-legend{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.ar-root .ar-type-pill{font-size:12px;gap:6px;height:28px;padding:3px 8px;background:color-mix(in srgb,var(--ar-type) 5%,var(--ar-card));color:var(--ar-text)}
.ar-type-dot{width:6px;height:6px;display:inline-block;flex:none;border-radius:2px;background:var(--ar-type)}
.ar-issue-board{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-items:start}
.ar-issue-group{border:1px solid var(--ar-line);border-radius:8px;min-width:0;padding:9px 12px;background:var(--ar-card)}
.ar-issue-group>summary{list-style:none;display:flex;align-items:center;gap:7px;color:var(--ar-text);min-height:24px}.ar-issue-group>summary:after{content:'＋';margin-left:auto;color:var(--ar-muted)}.ar-issue-group[open]>summary:after{content:'−'}
.ar-issue-group.ar-tone-danger{grid-column:1/-1;border-color:color-mix(in srgb,var(--ar-error) 24%,var(--ar-line));background:color-mix(in srgb,var(--ar-error) 2%,var(--ar-card))}
.ar-issue-group[open]{grid-column:1/-1}.ar-issue-group[open]>.ar-item{display:inline-block;vertical-align:top;width:calc(50% - 8px);margin-right:16px}.ar-issue-group[open]>.ar-item:nth-of-type(even){margin-right:0}
.ar-root .ar-more{width:100%;font-size:12px;color:var(--ar-muted);margin-top:8px;background:transparent;border:0}
.ar-source-list{margin-top:12px}.ar-source-row{display:flex;align-items:flex-start;gap:10px;padding:10px 0;font-size:12px;border-bottom:1px solid var(--ar-line)}.ar-source-row>div{min-width:0;overflow-wrap:anywhere}
.ar-brief{line-height:1.8;max-width:1100px;margin:16px auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ar-brief>.ar-card{margin:0}.ar-brief>details,.ar-brief-title{grid-column:1/-1}.ar-brief-title{margin:6px 0!important}.ar-brief p,.ar-brief li{font-size:13px}.ar-brief li{margin:6px 0}.ar-brief ul{padding-left:18px}.ar-brief h3{margin-bottom:10px}.ar-brief-more{margin-top:10px;padding-top:8px;border-top:1px solid var(--ar-line)}
.ar-network{margin-top:4px}.ar-network>summary{width:fit-content;margin-left:auto;font-size:12px;padding:3px 0}
.ar-network-body{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;margin:8px 0 12px}.ar-network-body>div{min-width:0}.ar-network-body h3:not(:first-child){margin-top:16px}.ar-network-body .ar-card-heading h3{margin-top:0}
.ar-network-body .ar-actions{justify-content:flex-start;flex-wrap:wrap;margin:10px 0;font-size:12px}
/* The shared form keeps its text; Radar exposes its safety explanation through the heading tooltip. */
.ar-network-body .ns-settings>small{display:none}
.ar-proxy-result,.ar-diagnostics{font-size:12px;margin:10px 0}.ar-proxy-result p{margin:6px 0}.ar-proxy-result details{margin-top:6px}
.ar-import{display:flex;align-items:center;flex-wrap:wrap;gap:6px;max-width:100%;font-size:12px;color:var(--ar-muted)}.ar-import input{max-width:100%;width:220px;font-size:11px}
.ar-directory-form{margin-top:8px;font-size:12px}.ar-root .ar-quiet{padding-left:0;color:var(--ar-muted)}
.ar-footer{font-size:10px;color:var(--ar-muted);padding-top:12px;margin-top:18px;border-top:1px solid var(--ar-line)}
@media(hover:hover){.ar-root a:hover{color:var(--ar-accent);text-decoration:underline}.ar-category-bar:hover .ar-bar-track i{opacity:1}.ar-metric:hover{border-color:var(--ar-accent)}}
@container(max-width:1000px){.ar-shell{padding:20px}.ar-overview-grid{grid-template-columns:1fr}.ar-overview-side{grid-template-columns:1fr 1fr}.ar-category-chart{gap:4px 20px}.ar-metrics{gap:6px}.ar-metric{padding:12px}.ar-retired{grid-template-columns:1fr 1fr}.ar-number{font-size:28px}}
@container(max-width:600px){.ar-shell{padding:16px 12px}.ar-header h1{font-size:20px}.ar-overline{font-size:9px;letter-spacing:1px}.ar-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.ar-metrics .ar-featured{grid-column:1/-1;flex-direction:row;align-items:center;justify-content:space-between}.ar-overview-side,.ar-two-col,.ar-network-body,.ar-issue-board,.ar-brief{grid-template-columns:minmax(0,1fr)}.ar-category-chart{column-gap:12px}.ar-section{padding:13px}.ar-security-overview{gap:14px}.ar-retired{grid-template-columns:repeat(4,minmax(0,1fr))}.ar-issue-group[open]>.ar-item{display:block;width:100%;margin-right:0}.ar-advisory-body dl{grid-template-columns:1fr;gap:5px}.ar-advisory-body dd+dt{margin-top:6px}.ar-projectbar{gap:8px}.ar-projectbar form{flex-basis:100%}.ar-directory-form>span:has(input){width:100%}.ar-section-heading .ar-actions{flex-wrap:wrap}.ar-item-meta time{margin-left:0}.ar-watch-toolbar>[role=tablist]{max-width:100%}.ar-root .ar-watch-toolbar [role=tab]{min-width:0;padding-inline:10px}.ar-last{flex-basis:100%;margin-left:13px}}
@container(max-width:400px){.ar-category-chart{grid-template-columns:1fr}.ar-retired{grid-template-columns:1fr 1fr}.ar-header>.ar-badge{display:none}}
@media(pointer:coarse){.ar-root input,.ar-root .ns-settings input{font-size:16px}}
@media(prefers-reduced-motion:reduce){.ar-spin{animation:none}}
`
