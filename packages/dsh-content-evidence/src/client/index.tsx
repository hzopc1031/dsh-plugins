import React, { useEffect, useRef, useState } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-gateway/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import remote from '../../lib/typert.remote-client.js'
import { exportFormats, platforms } from '../model.js'
import type { DraftBody, DraftInput, EvidenceSheet, ExperimentInput, ExportFormat, MaterialInput, Platform, Topic } from '../model.js'
import { styles } from './styles.js'

export const name = 'content-evidence-client'
export const inject = ['slots', 'remote']
const panelId = 'content-evidence'
const labels: Record<Platform, string> = { x: 'X', xiaohongshu: '小红书', douyin: '抖音', 'weixin-video': '视频号' }

function actions(ctx: Context) {
  return {
    list: () => ctx.remote.contentEvidence.listTopics(),
    create: (idea: string) => ctx.remote.contentEvidence.createTopic(idea),
    read: (id: string) => ctx.remote.contentEvidence.readEvidence(id),
    source: (id: string, url: string, title: string) => ctx.remote.contentEvidence.addSource(id, url, title),
    capture: (id: string, input: MaterialInput) => ctx.remote.contentEvidence.captureMaterial(id, input),
    material: (id: string, materialId: string) => ctx.remote.contentEvidence.readMaterial(id, materialId),
    experiment: (id: string, input: ExperimentInput) => ctx.remote.contentEvidence.logExperiment(id, input),
    claim: (id: string, text: string, sourceId: string | null) => ctx.remote.contentEvidence.saveClaim(id, text, sourceId),
    save: (id: string, target: Platform, input: DraftInput) => ctx.remote.contentEvidence.saveDraft(id, target, input),
    review: (id: string, target: Platform, revision: number) => ctx.remote.contentEvidence.reviewDraft(id, target, revision),
    export: (id: string, target: Platform, format: ExportFormat, directory: string) => ctx.remote.contentEvidence.requestExport(id, target, format, directory),
    backfill: (id: string, target: Platform, url: string) => ctx.remote.contentEvidence.backfillPublishedLink(id, target, url),
  }
}
type Actions = ReturnType<typeof actions>
type Run = (work: () => Promise<void>) => Promise<void>

function value<T>(result: RemoteResult<T>): T {
  if (!result.ok) throw result.error
  return result.value
}

function Reference({ sheet, id }: { sheet: EvidenceSheet; id: string | null }) {
  const source = sheet.sources.find(item => item.id === id)
  if (source) return <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title || source.url}</a>
  const material = sheet.materials.find(item => item.id === id)
  if (material) return <span>材料：{material.name}</span>
  const experiment = sheet.experiments.find(item => item.id === id)
  return <span>{experiment ? `实验：${experiment.command}` : '待核实'}</span>
}

function References({ sheet, name }: { sheet: EvidenceSheet; name: string }) {
  return <label>证据引用<select name={name} defaultValue="">
    <option value="">无引用 · 待核实</option>
    {sheet.sources.map(item => <option key={item.id} value={item.id}>来源：{item.title || item.url}</option>)}
    {sheet.materials.map(item => <option key={item.id} value={item.id}>材料：{item.name}</option>)}
    {sheet.experiments.map(item => <option key={item.id} value={item.id}>实验：{item.command}</option>)}
  </select></label>
}

function Field({ name, label, multiline = false, required = true }: { name: string; label: string; multiline?: boolean; required?: boolean }) {
  return <label>{label}{multiline ? <textarea name={name} required={required} /> : <input name={name} required={required} />}</label>
}

function fields(form: HTMLFormElement) {
  const data = new FormData(form)
  return (key: string) => String(data.get(key) ?? '')
}

export function materialPreview(input: MaterialInput) {
  const bytes = Uint8Array.from(atob(input.base64), char => char.charCodeAt(0))
  const head = Array.from(bytes.subarray(0, 12), byte => byte.toString(16).padStart(2, '0')).join('')
  const raster = (input.mediaType === 'image/png' && head.startsWith('89504e470d0a1a0a'))
    || (input.mediaType === 'image/jpeg' && head.startsWith('ffd8ff'))
    || (input.mediaType === 'image/gif' && (head.startsWith('474946383761') || head.startsWith('474946383961')))
    || (input.mediaType === 'image/webp' && head.startsWith('52494646') && head.slice(16, 24) === '57454250')
  return {
    image: raster ? `data:${input.mediaType};base64,${input.base64}` : null,
    text: raster ? null : new TextDecoder().decode(bytes),
  }
}

function Materials({ api, sheet, run, reload }: { api: Actions; sheet: EvidenceSheet; run: Run; reload: () => Promise<void> }) {
  const [preview, setPreview] = useState<{ name: string; image: string | null; text: string | null } | null>(null)
  return <>
    <h2>材料与实验记录</h2>
    <form onSubmit={event => {
      event.preventDefault(); const form = event.currentTarget; const get = fields(form)
      void run(async () => { value(await api.source(sheet.id, get('url'), get('title'))); form.reset(); await reload() })
    }}>
      <Field name="url" label="来源链接（HTTP/HTTPS，不自动访问）" /><Field name="title" label="来源标题（可选）" required={false} />
      <button type="submit">保存来源</button>
    </form>
    <ul>{sheet.sources.map(source => <li key={source.id}><Reference sheet={sheet} id={source.id} /></li>)}</ul>
    <form onSubmit={event => {
      event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const file = data.get('file') as File
      void run(async () => {
        if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('请选择非空文件，最大 10 MiB。')
        const bytes = new Uint8Array(await file.arrayBuffer())
        let binary = ''
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
        value(await api.capture(sheet.id, { name: file.name, mediaType: file.type || 'application/octet-stream', base64: btoa(binary), sourceId: String(data.get('sourceId') || '') || null }))
        form.reset(); await reload()
      })
    }}>
      <label>截图或材料文件（最大 10 MiB）<input name="file" type="file" required /></label>
      <label>材料的来源<select name="sourceId"><option value="">无来源</option>{sheet.sources.map(item => <option value={item.id} key={item.id}>{item.title || item.url}</option>)}</select></label>
      <button type="submit">复制材料到本地库</button>
    </form>
    <ul>{sheet.materials.map(item => <li key={item.id}>
      <button type="button" onClick={() => void run(async () => { const input = value(await api.material(sheet.id, item.id)); setPreview({ name: input.name, ...materialPreview(input) }) })}>查看 {item.name}</button>
      <small> · {item.mediaType} · {item.bytes} bytes · <Reference sheet={sheet} id={item.sourceId} /></small>
    </li>)}</ul>
    {preview && <div aria-label="材料预览"><h3>{preview.name}</h3>
      {preview.image ? <img src={preview.image} alt={preview.name} /> : <><p className="ce-muted">按纯文本查看；二进制文件可导出后在本机打开。HTML、SVG 与脚本不执行。</p><pre>{preview.text}</pre></>}
      <button type="button" onClick={() => setPreview(null)}>关闭预览</button>
    </div>}
    <form onSubmit={event => {
      event.preventDefault(); const form = event.currentTarget; const get = fields(form)
      void run(async () => { value(await api.experiment(sheet.id, { command: get('command'), output: get('output'), versions: get('versions'), conditions: get('conditions') })); form.reset(); await reload() })
    }}>
      <h3>记录一次实验（仅记录，不执行命令）</h3>
      <Field name="command" label="命令" multiline /><Field name="output" label="终端输出" multiline />
      <Field name="versions" label="版本号" /><Field name="conditions" label="测试条件" multiline />
      <button type="submit">保存实验</button>
    </form>
    {sheet.experiments.map(item => <details key={item.id}><summary>{item.command}</summary><pre>{`${item.command}\n${item.output}\n版本：${item.versions}\n条件：${item.conditions}`}</pre></details>)}
  </>
}

function Evidence({ api, sheet, run, reload }: { api: Actions; sheet: EvidenceSheet; run: Run; reload: () => Promise<void> }) {
  return <>
    <h2>共享证据表</h2><p className="ce-muted">四平台共用事实。每个关键数字与比较应关联来源；有引用仍需人工核实。</p>
    <form onSubmit={event => {
      event.preventDefault(); const form = event.currentTarget; const get = fields(form)
      void run(async () => { value(await api.claim(sheet.id, get('claim'), get('reference') || null)); form.reset(); await reload() })
    }}>
      <Field name="claim" label="事实或待核实的陈述" multiline /><References sheet={sheet} name="reference" /><button type="submit">加入证据表</button>
    </form>
    {sheet.claims.length ? <table><thead><tr><th scope="col">事实</th><th scope="col">状态</th><th scope="col">引用</th></tr></thead>
      <tbody>{sheet.claims.map(claim => <tr key={claim.id}><td>{claim.text}</td><td>{claim.status}</td><td><Reference sheet={sheet} id={claim.sourceId} /></td></tr>)}</tbody></table> : <p>还没有事实；未关联来源的陈述会保留为「待核实」。</p>}
  </>
}

function emptyBody(platform: Platform): DraftBody {
  if (platform === 'x') return { kind: 'x-single', post: '' }
  if (platform === 'xiaohongshu') return { kind: platform, title: '', body: '', cards: [''] }
  return { kind: platform, voiceover: '', shots: [''] }
}

function DraftEditor({ api, sheet, platform, run, update, dirty, setDirty }: {
  api: Actions; sheet: EvidenceSheet; platform: Platform; run: Run; update: (sheet: EvidenceSheet) => void; dirty: boolean; setDirty: (dirty: boolean) => void
}) {
  const draft = sheet.drafts[platform]
  const [body, setBody] = useState<DraftBody>(() => draft?.body ?? emptyBody(platform))
  const [claimIds, setClaims] = useState(() => draft?.claimIds ?? [])
  const change = (next: DraftBody) => { setBody(next); setDirty(true) }
  const text = (label: string, content: string, onChange: (text: string) => void) => <label>{label}<textarea required value={content} onChange={event => onChange(event.target.value)} /></label>
  const list = (label: string, entries: string[], onChange: (entries: string[]) => void) => <fieldset><legend>{label}</legend>
    {entries.map((entry, index) => <div key={index} className="ce-row">{text(`${label} · ${index + 1}`, entry, content => onChange(entries.map((old, i) => i === index ? content : old)))}
      <button type="button" disabled={entries.length <= 1} onClick={() => onChange(entries.filter((_, i) => i !== index))} aria-label={`移除${label} ${index + 1}`}>移除</button></div>)}
    <button type="button" disabled={entries.length >= 100} onClick={() => onChange([...entries, ''])}>添加{label}</button>
  </fieldset>
  return <>
    <p>已保存版本：{draft?.revision ?? 0} · 复核：{dirty ? '待重新复核（有未保存编辑）' : ({ pending: '待复核', passed: '通过（仍需人工核实）', failed: '需修改' }[draft?.review.status ?? 'pending'])}</p>
    {!draft?.body && draft && <details><summary>原始旧版草稿（请转换后保存）</summary><pre>{draft.content}</pre></details>}
    <form onSubmit={event => {
      event.preventDefault()
      void run(async () => {
        const saved = value(await api.save(sheet.id, platform, { body, claimIds, expectedRevision: draft?.revision ?? 0, evidenceHash: sheet.evidenceHash }))
        update({ ...sheet, drafts: { ...sheet.drafts, [platform]: saved } }); setDirty(false)
      })
    }}>
      {platform === 'x' && <label>X 格式<select value={body.kind} onChange={event => change(event.target.value === 'x-thread' ? { kind: 'x-thread', posts: body.kind === 'x-single' ? [body.post] : [''] } : { kind: 'x-single', post: body.kind === 'x-thread' ? body.posts.join('\n\n') : '' })}>
        <option value="x-single">单条</option><option value="x-thread">Thread</option>
      </select></label>}
      {body.kind === 'x-single' && text('单条正文', body.post, post => change({ ...body, post }))}
      {body.kind === 'x-thread' && list('帖子', body.posts, posts => change({ ...body, posts }))}
      {body.kind === 'xiaohongshu' && <>{text('标题', body.title, title => change({ ...body, title }))}{text('正文', body.body, content => change({ ...body, body: content }))}{list('卡片文案', body.cards, cards => change({ ...body, cards }))}</>}
      {(body.kind === 'douyin' || body.kind === 'weixin-video') && <>{text('口播脚本', body.voiceover, voiceover => change({ ...body, voiceover }))}{list('镜头', body.shots, shots => change({ ...body, shots }))}</>}
      <fieldset><legend>本稿使用的共享事实</legend>{sheet.claims.map(claim => <label className="ce-check" key={claim.id}><input type="checkbox" checked={claimIds.includes(claim.id)} onChange={event => { setClaims(event.target.checked ? [...claimIds, claim.id] : claimIds.filter(id => id !== claim.id)); setDirty(true) }} />{claim.text} · {claim.status}</label>)}</fieldset>
      <p className="ce-muted">数字须先录入选中的事实，网址须来自其引用。请明确标注「AI 生成」或「AI-generated」。</p>
      <button type="submit">保存草稿</button>
    </form>
    <button type="button" disabled={!draft || dirty} onClick={() => void run(async () => {
      const reviewed = value(await api.review(sheet.id, platform, draft!.revision))
      update({ ...sheet, drafts: { ...sheet.drafts, [platform]: reviewed } })
    })}>检查已保存草稿</button>
    <ul>{draft?.review.findings.map((finding, index) => <li key={index}>{typeof finding === 'string' ? finding : <><strong>{finding.code}</strong> · {finding.location}<pre>{finding.excerpt}</pre>{finding.fix}</>}</li>)}</ul>
    {draft && <details><summary>已保存的纯文本</summary><pre>{draft.content}</pre></details>}
  </>
}

function Exports({ api, sheet, platform, run, reload, dirty }: { api: Actions; sheet: EvidenceSheet; platform: Platform; run: Run; reload: () => Promise<void>; dirty: boolean }) {
  return <>
    <h2>本地导出与链接回填 · {labels[platform]}</h2>
    <p>导出已保存的草稿。待复核或未通过的内容会如实标注；自动检查不代表平台合规认证。</p>
    <form onSubmit={event => {
      event.preventDefault(); const get = fields(event.currentTarget)
      void run(async () => { value(await api.export(sheet.id, platform, get('format') as ExportFormat, get('directory'))); await reload() })
    }}>
      <Field name="directory" label="DSH 主机上已存在的绝对目录" />
      <p>支持 Linux / macOS 本机目录导出；Windows 暂不支持。缺少安全目录 I/O 支持时会拒绝，不写入导出文件。</p>
      <label>导出格式<select name="format" defaultValue="all">{exportFormats.map((format, i) => <option key={format} value={format}>{['Markdown', '纯文本', '引用列表', '材料文件夹', '全部'][i]}</option>)}</select></label>
      <button type="submit" disabled={!sheet.drafts[platform] || dirty}>导出到本机目录</button>
    </form>
    <h3>导出记录</h3>
    <ul>{sheet.exports.filter(item => item.platform === platform).map(item => <li key={item.id}>{item.createdAt} · {item.format} · {item.status} · {item.reviewPassed ? '当时复核通过' : '未标记通过'}<pre>{item.directory ?? '旧版待处理记录'}{item.files ? `\n${item.files.join('\n')}` : ''}</pre></li>)}</ul>
    <form onSubmit={event => {
      event.preventDefault(); const form = event.currentTarget; const get = fields(form)
      void run(async () => { value(await api.backfill(sheet.id, platform, get('publishedUrl'))); form.reset(); await reload() })
    }}><h3>在插件外手动发布后记录链接</h3><Field name="publishedUrl" label="已发布链接（仅保存，不访问）" /><button type="submit" disabled={dirty}>保存发布链接</button></form>
    <ul>{sheet.publishedLinks.filter(item => item.platform === platform).map((item, i) => <li key={i}>{item.url} · {item.recordedAt}</li>)}</ul>
  </>
}

function Workbench(api: Actions) {
  const [topics, setTopics] = useState<Topic[]>([])
  const [sheet, setSheet] = useState<EvidenceSheet | null>(null)
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [editorVersion, setEditorVersion] = useState(0)
  const [platform, setPlatform] = useState<Platform>('x')
  const [tab, setTab] = useState('materials')
  const run: Run = async work => {
    if (locked.current) return
    locked.current = true; setBusy(true); setError(''); setNotice('')
    try { await work(); setNotice('操作完成，数据已从本地主机读取或保存。') }
    catch (failure) {
      const code = typeof failure === 'object' && failure && 'code' in failure ? String(failure.code) : ''
      setError(code === 'content-evidence/conflict' ? '草稿或证据已在其他地方更新；本次未覆盖。请先复制当前编辑内容，再放弃编辑并刷新，核对后重新保存。' : `${code ? `${code}：` : ''}${failure instanceof Error ? failure.message : String(failure)}`)
    } finally { locked.current = false; setBusy(false) }
  }
  const reload = async () => { if (sheet) setSheet(value(await api.read(sheet.id))) }
  const loadList = async () => { setTopics(value(await api.list())) }
  useEffect(() => { void run(loadList) }, [])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  return <div className="ce-workbench"><style>{styles}</style><div className="ce-wrap">
    <header><h1>内容证据工作台</h1><p className="ce-muted">材料 → 共享证据 → 四平台草稿 → 复核 → 本地导出</p>
      <p>数据保存在此 DSH 主机；插件不会自动发布。</p>
    </header>
    <div aria-live="polite" role="status">{busy ? '正在处理…' : notice}</div>
    {error && <p role="alert" className="ce-notice">{error}</p>}
    {dirty && <p className="ce-notice">有未保存的草稿。保存后可切换主题、平台或更新证据。
      <button type="button" disabled={busy} onClick={() => void run(async () => { await reload(); setEditorVersion(version => version + 1); setDirty(false) })}>放弃草稿编辑并刷新</button>
    </p>}
    <fieldset disabled={busy}><legend>主题</legend>
      <div className="ce-row"><label>浏览主题<select value={sheet?.id ?? ''} disabled={dirty} onChange={event => {
        const id = event.target.value
        if (!id) { setSheet(null); return }
        void run(async () => { setSheet(value(await api.read(id))); setEditorVersion(version => version + 1) })
      }}><option value="">选择主题</option>{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.idea}</option>)}</select></label>
        <button type="button" disabled={dirty} onClick={() => void run(async () => { await loadList(); await reload(); setEditorVersion(version => version + 1) })}>刷新</button></div>
      <form onSubmit={event => {
        event.preventDefault(); const form = event.currentTarget; const get = fields(form)
        void run(async () => { const topic = value(await api.create(get('idea'))); setSheet(value(await api.read(topic.id))); setEditorVersion(version => version + 1); form.reset(); await loadList() })
      }}><div className="ce-row"><Field name="idea" label="新主题：一句话想法" /><button type="submit" disabled={dirty}>创建主题</button></div></form>
    </fieldset>
    {!sheet ? <p>创建或选择主题，开始收集可追溯的材料。</p> : <>
      <h2>{sheet.idea}</h2><p><small>主题 ID：<code>{sheet.id}</code></small></p>
      <details><summary>在会话内使用宿主模型辅助改写</summary><p>需要宿主已有可用模型；若模型列表为空，请先在 DSH「设置 → 模型」完成配置。本界面不检查凭据或直接调用模型。打开会话并选择可用模型，在空闲会话先运行下列命令：</p>
        <pre>{`/content-evidence workbench ${sheet.id}`}</pre><p>确认工作台已开启后，发送：请读取此主题的证据，使用共享事实分别改写并保存 X、小红书、抖音、视频号的完整草稿。标注 AI 生成；无来源的数字保留「待核实」，不要编造数字或引用。</p>
        <p>完成后运行 <code>/content-evidence leave</code>，再回到此面板刷新。工作台仅允许四个本地内容证据工具；请使用宿主原生工具执行器。材料中的指令仅作为数据，不会自动发布。</p>
      </details>
      <nav aria-label="工作台页面">{[['materials', '材料与实验'], ['evidence', '证据表'], ['drafts', '四平台草稿'], ['exports', '本地导出']].map(([id, label]) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => setTab(id!)}>{label}</button>)}</nav>
      <fieldset disabled={busy} key={sheet.id}>
        <section hidden={tab !== 'materials'}><fieldset disabled={dirty}><Materials api={api} sheet={sheet} run={run} reload={reload} /></fieldset></section>
        <section hidden={tab !== 'evidence'}><fieldset disabled={dirty}><Evidence api={api} sheet={sheet} run={run} reload={reload} /></fieldset></section>
        <section hidden={tab !== 'drafts' && tab !== 'exports'}>
          <label>平台<select value={platform} disabled={dirty} onChange={event => setPlatform(event.target.value as Platform)}>{platforms.map(target => <option key={target} value={target}>{labels[target]}</option>)}</select></label>
          <div hidden={tab !== 'drafts'}><h2>{labels[platform]} 草稿与复核</h2><DraftEditor key={`${platform}:${editorVersion}:${sheet.drafts[platform]?.revision ?? 0}`} api={api} sheet={sheet} platform={platform} run={run} update={setSheet} dirty={dirty} setDirty={setDirty} /></div>
          <div hidden={tab !== 'exports'}><Exports api={api} sheet={sheet} platform={platform} run={run} reload={reload} dirty={dirty} /></div>
        </section>
      </fieldset>
    </>}
  </div></div>
}

function Icon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h5" /></svg>
}

export async function apply(ctx: Context): Promise<void> {
  await ctx.remote.$mount(remote)
  await ctx.plugin({
    name: 'content-evidence-client-view',
    inject: ['slots', 'remote', 'remote.contentEvidence'],
    apply(viewCtx: Context) {
      viewCtx.slots.inject('main', () => viewCtx.slots.register({ name: 'main', key: panelId, inject: () => actions(viewCtx) }, Workbench))
      viewCtx.slots.inject('sidebar.panellist', () => viewCtx.slots.register({ name: 'sidebar.panellist', id: panelId, order: 6, label: () => '内容证据 / Content evidence' }, Icon))
    },
  })
}
