import type { Context } from '@deepseek-ai/cordis'
export type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
export type {} from '@deepseek-ai/dsh-client-ui-session/client'
export type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    title: string | null
    workingDirectory: string | null
  }
}
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { useEffect, useMemo, useRef, useState } from 'react'
import { copyText, listDrafts, prepareAppend, requireCapabilities, type Draft } from './core.js'

export const inject = ['slots']
type Props = PropsRuntime<'conversation.session.header.actions'>

/** Only durable title and recorded cwd; never displayTitle (it falls back to id/basename). */
type SessionRow = { title?: string; cwd?: string }
function formatMeta(meta: { title?: string; workspace?: string }): string {
  return '标题：' + (meta.title ?? '未知') + '；工作区：' + (meta.workspace ?? '未知')
}

export function DraftRescue(props: Props) {
  if (typeof props.useInput !== 'function') return <span role="status">宿主缺少 useInput 输入接口，已拒绝读取草稿。</span>
  return <DraftRescueReady {...props} />
}

function DraftRescueReady({ sessionId, useInput, inputActions, useSessions, useProjection }: Props) {
  const input = useInput(value => value)
  const sessionsById = (useSessions ?? ((select: (state: { byId: Record<string, SessionRow | undefined> }) => unknown) => select({ byId: {} })))(state => state.byId) as Record<string, SessionRow | undefined>
  const projectedTitle = (useProjection ?? ((_key: 'title' | 'workingDirectory') => null))('title')
  const projectedCwd = (useProjection ?? ((_key: 'title' | 'workingDirectory') => null))('workingDirectory')
  function sessionMeta(id: string): { title?: string; workspace?: string } {
    const row = sessionsById?.[id]
    let title: string | undefined
    let workspace: string | undefined
    if (row && typeof row.title === 'string' && row.title.trim()) title = row.title
    if (row && typeof row.cwd === 'string' && row.cwd.trim()) workspace = row.cwd
    if (id === sessionId) {
      if (typeof projectedTitle === 'string' && projectedTitle.trim()) title = projectedTitle
      if (typeof projectedCwd === 'string' && projectedCwd.trim()) workspace = projectedCwd
    }
    return { title, workspace }
  }
  const [open, setOpen] = useState(false)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [preview, setPreview] = useState<string | null>(null)
  const live = useRef(input)
  live.current = input
  const generation = useRef(0)
  const close = () => { generation.current++; setOpen(false); setDrafts([]); setNotice(''); setQuery(''); setPage(0); setPreview(null) }
  useEffect(() => { close(); return () => { generation.current++ } }, [sessionId])
  const filtered = useMemo(() => {
    const needle = query.toLocaleLowerCase()
    return drafts.filter(d => {
      const meta = sessionMeta(d.sessionId)
      return [d.sessionId, d.text, meta.title ?? '', meta.workspace ?? ''].join('\n').toLocaleLowerCase().includes(needle)
    })
  }, [drafts, query, sessionId, sessionsById, projectedTitle, projectedCwd])
  const pages = Math.max(1, Math.ceil(filtered.length / 20))
  const currentPage = Math.min(page, pages - 1)
  const targetMeta = sessionMeta(sessionId)
  function refresh() {
    generation.current++
    setPage(0); setPreview(null)
    try {
      requireCapabilities(live.current, inputActions) // Check the public input face before obtaining localStorage.
      setDrafts(listDrafts(window.localStorage))
      setNotice('')
    } catch (error) {
      setDrafts([])
      setNotice(error instanceof Error ? error.message : '无法访问本机草稿存储。')
    }
  }
  async function copy(draft: Draft) {
    const revision = generation.current
    try {
      requireCapabilities(live.current, inputActions)
      await navigator.clipboard.writeText(copyText(draft))
      if (generation.current === revision) setNotice('已复制原文。')
    } catch { if (generation.current === revision) setNotice('复制失败；请刷新并检查输入接口、剪贴板权限，或从预览手动复制。') }
  }
  function append(draft: Draft) {
    try {
      requireCapabilities(live.current, inputActions)
      let currentSnapshot: unknown
      if (typeof inputActions.persistDraft === 'function') {
        inputActions.persistDraft()
        const raw = window.localStorage.getItem('dsh.conversation.' + sessionId)
        const snapshot = raw ? JSON.parse(raw).draft : undefined
        if (live.current.draft && snapshot === undefined) throw new Error('无法核对当前引用块位置，请复制原文后粘贴。')
        if (snapshot && typeof snapshot === 'object') currentSnapshot = snapshot
        else if (snapshot !== undefined && snapshot !== live.current.draft) throw new Error('当前草稿快照与输入框不一致，请复制原文后粘贴。')
      }
      const prepared = prepareAppend(draft, live.current, currentSnapshot)
      if (!inputActions.insertText(prepared.text, prepared.span)) throw new Error('输入框已变化、含无法定位的引用块或暂不可编辑；请复制原文后手动粘贴。')
      setNotice('已追加到当前输入框，尚未发送。')
    } catch (error) { setNotice(error instanceof Error ? error.message : '追加失败。') }
  }
  return <>
    <button type="button" title="找回本机未发送的文字草稿" onClick={() => { refresh(); setOpen(true) }}>未发送草稿</button>
    <Modal open={open} onClose={close} title="未发送草稿" closeLabel="关闭">
      <div style={{ width: 'min(640px, 75vw)', maxHeight: '65vh', overflowY: 'auto' }}>
        <p>只恢复文字；引用胶囊显示为文字，附件不恢复。按会话 ID 排序。标题和工作区仅在能从官方会话列表或投影可靠读到时显示，否则为未知；不编造更新时间。</p>
        <p>追加目标：当前会话 {sessionId}；{formatMeta(targetMeta)}</p>
        <button type="button" data-modal-autofocus onClick={refresh}>刷新草稿</button>
        <label>筛选会话、标题、工作区或正文 <input value={query} onChange={event => { setQuery(event.target.value); setPage(0); setPreview(null) }} /></label>
        <p>{filtered.length} 条 · 第 {currentPage + 1}/{pages} 页</p>
        <button type="button" disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1); setPreview(null) }}>上一页</button>{' '}
        <button type="button" disabled={currentPage + 1 >= pages} onClick={() => { setPage(currentPage + 1); setPreview(null) }}>下一页</button>
        <p role="status" aria-live="polite">{notice}</p>
        {!drafts.length && !notice && <p>本机没有非空文字草稿。</p>}
        {filtered.slice(currentPage * 20, (currentPage + 1) * 20).map(draft => {
          const meta = sessionMeta(draft.sessionId)
          const current = draft.sessionId === sessionId
          return <section key={draft.sessionId} style={{ marginTop: 16 }}>
            <div>会话 {draft.sessionId} · {draft.text.length} 字符{current ? ' · 当前会话草稿' : ''} · {formatMeta(meta)}</div>
            <button type="button" onClick={() => setPreview(preview === draft.sessionId ? null : draft.sessionId)}>预览原文</button>
            {preview === draft.sessionId && <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', userSelect: 'text' }}>{draft.text}</pre>}
            <button type="button" onClick={() => { void copy(draft) }}>复制原文</button>{' '}
            <button type="button" disabled={input?.phase !== 'plain'} onClick={() => append(draft)}>追加到当前输入框</button>
          </section>
        })}
      </div>
    </Modal>
  </>
}

export function apply(ctx: Context): void {
  if (typeof ctx.slots?.inject !== 'function' || typeof ctx.slots?.register !== 'function') throw new Error('宿主缺少会话槽位接口，已拒绝启用草稿找回。')
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions', id: 'dsh-draft-rescue', order: 150,
  }, DraftRescue))
}
