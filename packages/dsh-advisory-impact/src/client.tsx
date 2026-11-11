import * as React from 'react'
import { panelOverview, sourceExpired, type PanelSource } from './panel-model.js'
import type { AdvisoryViewModel } from './view-model.js'
import type { ActionArgs } from './surface.js'
import type { Settings } from './config.js'

export const name = 'advisory-impact'
export const inject = ['slots']
declare const PANEL_CSS: string
const title = (id: string) => ({ kafka: 'Kafka', hadoop: 'Hadoop', flink: 'Flink' })[id] ?? id
const safeUrl = (url: string) => (/^https?:\/\//.test(url) ? url : undefined)
const Link = ({ url, children }: { url: string; children: React.ReactNode }) => (
  <a href={safeUrl(url)} target="_blank" rel="noreferrer">
    {children} ↗
  </a>
)

function Shield({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6Z" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  )
}

function Evidence({
  source,
  ttl,
  now,
  label
}: {
  source: PanelSource | null
  ttl: number
  now: number
  label?: string
}) {
  if (!source) return <span className="ai-muted">{label ?? '来源'}：未获取</span>
  const expired = sourceExpired(source, ttl, now)
  return (
    <div className="ai-evidence">
      <span className="ai-chip">
        <Link url={source.url}>{label ?? new URL(source.url).hostname}</Link>
      </span>
      <span className="ai-chip">{source.fetchedTime ? `抓取 ${source.fetchedTime}` : '未取得成功数据'}</span>
      <span
        className={`ai-chip ${source.state === 'error' ? 'ai-affected' : source.state === 'stale' || expired ? 'ai-unknown' : ''}`}
      >
        {expired && source.state !== 'stale' ? '缓存已过期，待刷新' : source.label}
      </span>
      {source.sourceTimestamp && <span className="ai-chip">页面时间 {source.sourceTimestamp}</span>}
      {(source.error || source.cacheError) && (
        <p className="ai-error">
          {source.error}
          {source.cacheError ? ` · 缓存：${source.cacheError}` : ''}
        </p>
      )}
    </div>
  )
}

function MoreList<T>({ items, render }: { items: T[]; render: (item: T, index: number) => React.ReactNode }) {
  const [limit, setLimit] = React.useState(6)
  return (
    <>
      {items.slice(0, limit).map(render)}
      {limit < items.length && (
        <button className="ai-button ai-more" onClick={() => setLimit(n => n + 12)}>
          显示更多（还有 {items.length - limit} 条）
        </button>
      )}
    </>
  )
}

type Project = AdvisoryViewModel['projects'][number]
function AdvisoryCard({
  item,
  ttl,
  now
}: {
  item: NonNullable<Project['advisories']>[number]
  ttl: number
  now: number
}) {
  return (
    <article className={`ai-card ai-verdict ai-${item.verdict}`}>
      <div className="ai-row">
        <span className={`ai-badge ai-${item.verdict}`}>{item.label}</span>
        <Link url={item.url}>{item.id}</Link>
        {item.announcedAt && <span className="ai-muted">{item.announcedAt}</span>}
      </div>
      <h3>{item.title}</h3>
      <p>{item.reason}</p>
      <div className="ai-evidence">
        <span className="ai-chip">
          <Link url={item.url}>官方原文</Link>
        </span>
        <span className="ai-chip">抓取 {item.fetchedTime}</span>
        {item.sourceTimestamp && <span className="ai-chip">页面时间 {item.sourceTimestamp}</span>}
      </div>
      {item.pins.map((p, i) => (
        <p key={i} className="ai-muted">
          运行 {p.pin.version}
          {p.pin.component ? ` · ${p.pin.component}` : ''} →{' '}
          <span className={`ai-${p.verdict}`}>{p.label}</span> · {p.reason}
        </p>
      ))}
      <dl className="ai-range">
        <div>
          <dt>影响范围原文</dt>
          <dd>{item.affectedText || '官方未明确列出，无法据此推断'}</dd>
        </div>
        <div>
          <dt>官方修复版本</dt>
          <dd>{item.fixedText || item.fixedVersions?.join('、') || '官方未列出'}</dd>
        </div>
      </dl>
      {!!item.notes.length && (
        <details className="ai-notes">
          <summary>适用条件与官方说明</summary>
          {item.notes.map((note, i) => (
            <p key={i}>{note}</p>
          ))}
        </details>
      )}
      {!!item.suppressions.length && (
        <p className="ai-notice">此项还有官方不适用说明，请核对下方独立分组。</p>
      )}
      <div className="ai-osv">
        <div className="ai-row">
          <strong>OSV · 第二来源</strong>
          <span className="ai-chip">{item.osv.lookup.statusLabel}</span>
        </div>
        <p
          className={
            ['different_ranges', 'query_disagreement'].includes(item.osv.comparison)
              ? 'ai-notice'
              : 'ai-muted'
          }
        >
          {item.osv.note}
        </p>
        <Evidence source={item.osv.lookup} ttl={ttl} now={now} label="OSV 记录" />
        {item.osv.queryMatches.map((q, i) => (
          <p key={i} className="ai-muted">
            <Link url={q.url}>Maven 查询命中 {q.id}</Link> · {q.query.maven}@{q.query.version} · 抓取{' '}
            {q.fetchedTime} · {q.state}
          </p>
        ))}
      </div>
    </article>
  )
}

function ProjectView({ project, ttl, now }: { project: Project; ttl: number; now: number }) {
  return (
    <>
      <section className="ai-section">
        <div className="ai-section-head">
          <div>
            <h2>
              {title(project.project)} <span className="ai-muted">官方公告</span>
            </h2>
            <p className="ai-muted">
              {project.pins.length
                ? project.pins.map(p => `${p.component ?? title(project.project)} ${p.version}`).join(' / ')
                : '未填写运行版本，无法判断'}
            </p>
          </div>
        </div>
        <Evidence source={project.source} ttl={ttl} now={now} />
        {project.project === 'kafka' && <p className="ai-muted">Kafka 官方页面不列出其依赖项的安全公告。</p>}
        {project.project === 'flink' && (
          <p className="ai-notice">
            ASF Flink 页面为实验性列表，覆盖 2023 年以来的公告，可能滞后官方 CVE 发布。
          </p>
        )}
        {project.notices.map((note, i) => (
          <p className="ai-notice" key={i}>
            {note}
          </p>
        ))}
        {project.error && (
          <p role="alert" className="ai-error">
            {project.error}
          </p>
        )}
      </section>
      {project.advisories === null ? (
        <div className="ai-card ai-empty">官方清单不可用，无法判断。来源失败不代表没有公告，请重试刷新。</div>
      ) : project.advisories.length === 0 ? (
        <div className="ai-card ai-empty">此来源本次没有可列出的公告；这不是安全保证。</div>
      ) : (
        <div className="ai-list">
          <MoreList
            items={project.advisories}
            render={item => <AdvisoryCard key={item.id} item={item} ttl={ttl} now={now} />}
          />
        </div>
      )}
      <section className="ai-section">
        <h2>仅见 OSV，未见官方公告</h2>
        <p className="ai-muted">按所填 Maven 坐标查询。此处不作官方三态判定。</p>
        {project.queries.map((q, i) => (
          <div className="ai-card" key={i}>
            <strong>
              {q.query.maven}@{q.query.version}
            </strong>
            <Evidence source={q.source} ttl={ttl} now={now} label="OSV Maven 查询" />
          </div>
        ))}
        {!project.osvOnly.inventoryAvailable ? (
          <p className="ai-notice">官方清单不可用，无法完成与 OSV 的对照。</p>
        ) : !project.queries.length ? (
          <p className="ai-muted">未填写 Maven 坐标，未进行 OSV Maven 查询。</p>
        ) : (
          !project.osvOnly.items.length && (
            <p className="ai-muted">
              当前已获取的查询结果中没有可列出的 OSV-only 条目，请同时检查查询来源状态。
            </p>
          )
        )}
        <MoreList
          items={project.osvOnly.items}
          render={(item, i) => (
            <article className="ai-card" key={i}>
              <div className="ai-row">
                <Link url={item.url}>{item.id}</Link>
                <span className="ai-chip">仅第二来源</span>
              </div>
              <p>{item.summary}</p>
              <p className="ai-muted">
                {item.aliases.join(' · ')} · {item.query.maven}@{item.query.version}
              </p>
              <div className="ai-evidence">
                <span className="ai-chip">抓取 {item.fetchedTime}</span>
                <span className="ai-chip">{item.state}</span>
              </div>
            </article>
          )}
        />
      </section>
    </>
  )
}

async function request(directory: string, action: string, args: ActionArgs = {}) {
  const response = await fetch('advisory-impact/api', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ directory, action, args })
  })
  const data = await response.json().catch(() => ({ error: 'DSH 面板服务不可用，请重新连接或检查插件加载' }))
  if (!response.ok) throw new Error(data.error || `请求失败（HTTP ${response.status}）`)
  return data as { view?: AdvisoryViewModel; summary: Settings; text: string }
}

export function Panel() {
  const [directory, setDirectory] = React.useState(''),
    [activeDirectory, setActiveDirectory] = React.useState('')
  const [settings, setSettings] = React.useState<Settings | null>(null),
    [view, setView] = React.useState<AdvisoryViewModel | null>(null)
  const [busy, setBusy] = React.useState(''),
    [error, setError] = React.useState(''),
    [message, setMessage] = React.useState('')
  const [selected, setSelected] = React.useState(''),
    [report, setReport] = React.useState(''),
    [now, setNow] = React.useState(Date.now())
  const [watch, setWatch] = React.useState(''),
    [pinProject, setPinProject] = React.useState('kafka'),
    [version, setVersion] = React.useState('')
  const [component, setComponent] = React.useState(''),
    [maven, setMaven] = React.useState('')
  const locked = React.useRef(false),
    mounted = React.useRef(true)
  React.useEffect(() => {
    mounted.current = true
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => {
      mounted.current = false
      clearInterval(timer)
    }
  }, [])
  const run = async (label: string, task: () => Promise<void>) => {
    if (locked.current) return
    locked.current = true
    setBusy(label)
    setError('')
    setMessage('')
    try {
      await task()
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : '操作失败')
    } finally {
      locked.current = false
      if (mounted.current) setBusy('')
    }
  }
  const loadView = async (dir: string, action = 'view') => {
    const result = await request(dir, action)
    if (!mounted.current) return
    if (!result.view) throw new Error('未收到可用的核对结果')
    setView(result.view)
    setSettings(result.view.settings)
    setWatch(result.view.settings.watch.join(','))
    setNow(Date.now())
    setSelected(current =>
      result.view!.projects.some(p => p.project === current)
        ? current
        : (result.view!.projects[0]?.project ?? '')
    )
  }
  const connect = (event: React.FormEvent) => {
    event.preventDefault()
    void run('正在读取项目配置…', async () => {
      const dir = directory.trim(),
        result = await request(dir, 'pin')
      if (!mounted.current) return
      setActiveDirectory(dir)
      setSettings(result.summary)
      setWatch(result.summary.watch.join(','))
      setView(null)
      setReport('')
      setSelected('')
    })
  }
  const edit = (action: 'pin' | 'watch', args: ActionArgs) =>
    run('正在保存配置…', async () => {
      const result = await request(activeDirectory, action, args)
      if (!mounted.current) return
      setSettings(result.summary)
      setWatch(result.summary.watch.join(','))
      setView(null)
      setReport('')
      setMessage('配置已保存，请点击「核对 / 刷新」重新判断。')
    })
  const overview = view ? panelOverview(view, now) : null
  const project = view?.projects.find(p => p.project === selected)
  const ttl = view?.settings.cacheTtlMs ?? 0
  return (
    <div className="ai-root" aria-busy={!!busy}>
      <div className="ai-content">
        <header className="ai-header">
          <div className="ai-brand">
            <span className="ai-logo">
              <Shield size={26} />
            </span>
            <div>
              <span className="ai-eyebrow">ADVISORY IMPACT</span>
              <h1>公告影响</h1>
            </div>
          </div>
          <div className="ai-actions">
            <span className="ai-chip">本地核对 · 无需模型</span>
            <button
              className="ai-button ai-primary"
              disabled={!!busy || !activeDirectory}
              onClick={() =>
                void run('正在抓取官方来源与 OSV，保留上次结果…', () => loadView(activeDirectory, 'refresh'))
              }
            >
              {busy ? '处理中…' : view ? '刷新来源' : '核对 / 刷新'}
            </button>
          </div>
        </header>
        <p className="ai-lead">用你实际运行的版本，核对官方安全公告。官方优先，OSV 仅作第二来源。</p>
        <details className="ai-card ai-setup" open={!settings || undefined}>
          <summary>
            项目与运行版本{' '}
            <span className="ai-muted">{activeDirectory || '先选择本地项目，没有默认版本'}</span>
          </summary>
          <form className="ai-form" onSubmit={connect}>
            <label className="ai-wide">
              本地项目绝对路径
              <input
                value={directory}
                onChange={e => setDirectory(e.target.value)}
                placeholder="填写本机已有项目目录"
                required
                disabled={!!busy}
              />
            </label>
            <button className="ai-button" disabled={!!busy}>
              读取项目
            </button>
          </form>
          {settings && (
            <>
              <p className="ai-muted">
                当前项目：{activeDirectory} · 配置保存在 .advisory-impact.json。切换目录请点击「读取项目」。
              </p>
              <form
                className="ai-form"
                onSubmit={e => {
                  e.preventDefault()
                  void edit('watch', { watch: watch.trim() ? watch.split(',').map(id => id.trim()) : [] })
                }}
              >
                <label className="ai-wide">
                  关注项目（英文 id，逗号分隔）
                  <input value={watch} onChange={e => setWatch(e.target.value)} disabled={!!busy} />
                </label>
                <button className="ai-button" disabled={!!busy}>
                  保存关注
                </button>
              </form>
              <form
                className="ai-form"
                onSubmit={e => {
                  e.preventDefault()
                  void edit('pin', {
                    project: pinProject,
                    version,
                    ...(component ? { component } : {}),
                    ...(maven ? { maven } : {})
                  })
                }}
              >
                <label>
                  项目 id
                  <input
                    value={pinProject}
                    onChange={e => setPinProject(e.target.value)}
                    required
                    disabled={!!busy}
                  />
                </label>
                <label>
                  实际运行版本
                  <input
                    value={version}
                    onChange={e => setVersion(e.target.value)}
                    placeholder="自行填写"
                    required
                    disabled={!!busy}
                  />
                </label>
                <label>
                  组件（可选）
                  <input value={component} onChange={e => setComponent(e.target.value)} disabled={!!busy} />
                </label>
                <label>
                  Maven 坐标（可选）
                  <input
                    value={maven}
                    onChange={e => setMaven(e.target.value)}
                    placeholder="groupId:artifactId"
                    disabled={!!busy}
                  />
                </label>
                <button className="ai-button" disabled={!!busy}>
                  保存版本
                </button>
              </form>
              {settings.pins.length ? (
                settings.pins.map((p, i) => (
                  <div className="ai-row ai-pin" key={i}>
                    <code>
                      {p.project} {p.version}
                      {p.component ? ` · ${p.component}` : ''}
                      {p.maven ? ` · ${p.maven}` : ''}
                    </code>
                    <button
                      className="ai-button"
                      disabled={!!busy}
                      onClick={() => void edit('pin', { project: p.project, remove: true })}
                    >
                      移除 {p.project} 版本
                    </button>
                  </div>
                ))
              ) : (
                <p className="ai-notice">未填写运行版本，无法判断。没有默认运行版本。</p>
              )}
            </>
          )}
        </details>
        <div role="status" aria-live="polite">
          {busy && <p className="ai-loading">{busy}</p>}
          {message && <p className="ai-notice">{message}</p>}
        </div>
        {error && (
          <div role="alert" className="ai-banner ai-affected">
            {error}{' '}
            {view ? '下方保留上次结果及其原始时间，未刷新成功。' : '尚无可用核对结果，请检查项目目录或重试。'}
          </div>
        )}
        {!view && (
          <div className="ai-card ai-empty">
            <Shield size={32} />
            <h2>{settings ? '运行版本准备好后，开始核对' : '从你的运行版本开始'}</h2>
            <p>默认关注 Kafka / Hadoop / Flink。读取项目和保存配置不会访问公告来源。</p>
            <p>点击「核对 / 刷新」后获取公开来源；没有 pin 的公告会标为「无法判断」。</p>
            {settings && (
              <button
                className="ai-button"
                disabled={!!busy}
                onClick={() => void run('正在读取来源（优先使用有效缓存）…', () => loadView(activeDirectory))}
              >
                使用缓存核对
              </button>
            )}
          </div>
        )}
        {view && overview && (
          <>
            {overview.stale && (
              <p className="ai-banner ai-unknown">
                含陈旧或已过期数据。下方保留各来源最后成功抓取时间；请刷新后再核对。
              </p>
            )}
            {overview.failed && (
              <p role="alert" className="ai-banner ai-affected">
                部分来源或缓存失败。可用的最后成功数据继续显示；失败不代表没有公告或不受影响。
              </p>
            )}
            <section aria-label="核对总览">
              <div className="ai-section-head">
                <h2>核对总览</h2>
                <span className="ai-muted">按公告 × 项目计数 · 当前关注列表</span>
              </div>
              <div className="ai-metrics">
                {overview.cards.map(card => (
                  <article className={`ai-card ai-metric ai-${card.key}`} key={card.key}>
                    <span>{card.label}</span>
                    <strong>{card.value ?? '—'}</strong>
                    <small>
                      {card.value === null
                        ? '尚无可用数据 / 未查询'
                        : card.partial
                          ? '仅已获取部分'
                          : '已获取数据中的条目'}
                    </small>
                    <div className="ai-evidence">
                      {[...new Set(card.sources.map(s => s.url))].map(url => (
                        <span className="ai-chip" key={url}>
                          <Link url={url}>{new URL(url).hostname}</Link>
                        </span>
                      ))}
                      {card.oldestFetchTime && (
                        <span className="ai-chip">最早抓取 {card.oldestFetchTime}</span>
                      )}
                    </div>
                    <details>
                      <summary>各来源状态与时间</summary>
                      {card.sources.length ? (
                        card.sources.map((s, i) => <Evidence key={i} source={s} ttl={ttl} now={now} />)
                      ) : (
                        <p>未取得来源</p>
                      )}
                    </details>
                  </article>
                ))}
              </div>
            </section>
            <nav className="ai-tabs" aria-label="选择项目">
              {view.projects.map(p => (
                <button
                  className="ai-button"
                  aria-pressed={selected === p.project}
                  key={p.project}
                  onClick={() => setSelected(p.project)}
                >
                  {title(p.project)}
                </button>
              ))}
            </nav>
            {project ? (
              <ProjectView key={project.project} project={project} ttl={ttl} now={now} />
            ) : (
              <p className="ai-card ai-empty">关注列表为空。可在「项目与运行版本」中添加项目。</p>
            )}
            {view.settings.watch.includes('kafka') && (
              <section className="ai-section ai-suppression">
                <div className="ai-section-head">
                  <h2>扫描器报了，但官方说明不适用</h2>
                  <span className="ai-chip">官方说明 · 独立列出</span>
                </div>
                <p className="ai-muted">
                  Kafka 官方 suppressions 文件；不将这些条目标为官方受影响。Hadoop / Flink 未配置官方
                  suppressions 文件。
                </p>
                <Evidence source={view.suppressions.source} ttl={ttl} now={now} label="Kafka suppressions" />
                <Evidence source={view.guidance} ttl={ttl} now={now} label="ASF 依赖漏洞说明" />
                {view.suppressions.items === null ? (
                  <p className="ai-error">官方不适用说明不可用，不能据此排除扫描器结果。</p>
                ) : (
                  <MoreList
                    items={view.suppressions.items}
                    render={(item, i) => (
                      <article className="ai-card" key={i}>
                        <div className="ai-row">
                          <Link url={item.url}>{item.id}</Link>
                          <span className="ai-chip">官方说明不适用</span>
                        </div>
                        <p>{item.notes}</p>
                        <span className="ai-chip">抓取 {item.fetchedTime}</span>
                      </article>
                    )}
                  />
                )}
              </section>
            )}
            {view.settings.watch.includes('flink') && (
              <section className="ai-section">
                <h2>Flink 官方入口</h2>
                <p className="ai-muted">
                  项目 security 页仅作指针，不计为第二份公告清单。ASF 列表为实验性，覆盖 2023
                  年以来，可能滞后官方 CVE 发布。
                </p>
                <Evidence source={view.flinkPointer} ttl={ttl} now={now} label="Flink security 指针" />
              </section>
            )}
            <section className="ai-card">
              <div className="ai-section-head">
                <div>
                  <h2>中文 Markdown 报告</h2>
                  <p className="ai-muted">官方判定、来源、时间及独立分组均保留。</p>
                </div>
                <button
                  className="ai-button"
                  disabled={!!busy}
                  onClick={() =>
                    void run('正在生成报告…', async () => {
                      const result = await request(activeDirectory, 'report')
                      if (mounted.current) setReport(result.text)
                    })
                  }
                >
                  查看报告
                </button>
              </div>
              {report && (
                <>
                  <textarea
                    className="ai-report"
                    aria-label="中文 Markdown 报告"
                    readOnly
                    value={report}
                    onFocus={e => e.target.select()}
                  />
                  <button
                    className="ai-button"
                    onClick={() =>
                      void run('正在复制…', async () => {
                        await navigator.clipboard.writeText(report)
                        setMessage('已复制 Markdown 报告。')
                      })
                    }
                  >
                    复制报告
                  </button>
                  <p className="ai-muted">剪贴板不可用时可选中上方全文复制。报告中的抓取时间独立保留。</p>
                </>
              )}
            </section>
          </>
        )}
        <footer className="ai-footer">
          判定来自官方公告与填写的版本。未解析范围、缺少版本或组件不匹配时保留「无法判断」。
        </footer>
      </div>
    </div>
  )
}

interface ClientContext {
  effect(effect: () => () => void): unknown
  slots: {
    inject(name: string, effect: () => () => void): unknown
    register(
      options: Record<string, unknown>,
      component: (props: { size?: number }) => React.ReactNode
    ): () => void
  }
}

export function apply(ctx: ClientContext) {
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = 'advisory-impact'
    style.textContent = PANEL_CSS
    document.head.appendChild(style)
    return () => style.remove()
  })
  ctx.slots.inject('main', () =>
    ctx.slots.register({ name: 'main', key: 'advisory-impact' }, () => <Panel />)
  )
  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register(
      { name: 'sidebar.panellist', id: 'advisory-impact', order: 35, label: '公告影响' },
      props => <Shield size={props.size} />
    )
  )
}
