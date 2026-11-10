import type { Context } from '@deepseek-ai/cordis'
export type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
export type {} from '@deepseek-ai/dsh-client-ui-session/client'
export type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { useState } from 'react'
import { copyText, listDrafts, prepareAppend, requireVersion, type Draft } from './core.js'

export const inject = ['slots']
type Props = PropsRuntime<'conversation.session.header.actions'>
function boot(): unknown { return (window as unknown as { __DSH_BOOT__?: unknown }).__DSH_BOOT__ }

export function DraftRescue({ useInput, inputActions }: Props) {
  const input = useInput(value => value)
  const [open, setOpen] = useState(false)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [notice, setNotice] = useState('')
  function refresh() {
    try {
      requireVersion(boot()) // Do not even obtain localStorage until release is checked.
      setDrafts(listDrafts(window.localStorage, boot()))
      setNotice('')
    } catch (error) {
      setDrafts([])
      setNotice(error instanceof Error ? error.message : '无法访问本机草稿存储。')
    }
  }
  async function copy(draft: Draft) {
    try {
      requireVersion(boot())
      await navigator.clipboard.writeText(copyText(draft))
      setNotice('已复制原文。')
    } catch { setNotice('复制失败；请刷新并检查版本、剪贴板权限，或从预览手动复制。') }
  }
  function append(draft: Draft) {
    try {
      requireVersion(boot())
      const prepared = prepareAppend(draft, input)
      if (!inputActions.insertText(prepared.text, prepared.span)) throw new Error('输入框已变化或暂不可编辑，请重试。')
      setNotice('已追加到当前输入框，尚未发送。')
    } catch (error) { setNotice(error instanceof Error ? error.message : '追加失败。') }
  }
  return <>
    <button type="button" title="找回本机未发送的文字草稿" onClick={() => { refresh(); setOpen(true) }}>未发送草稿</button>
    <Modal open={open} onClose={() => { setOpen(false); setDrafts([]); setNotice('') }} title="未发送草稿" closeLabel="关闭">
      <div style={{ width: 'min(640px, 75vw)', maxHeight: '65vh', overflowY: 'auto' }}>
        <p>只恢复文字；引用胶囊显示为文字，附件不恢复。按会话 ID 排序。</p>
        <button type="button" data-modal-autofocus onClick={refresh}>刷新草稿</button>
        <p role="status" aria-live="polite">{notice}</p>
        {!drafts.length && !notice && <p>本机没有非空文字草稿。</p>}
        {drafts.map(draft => <section key={draft.sessionId} style={{ marginTop: 16 }}>
          <details><summary>会话 {draft.sessionId} · {draft.text.length} 字符</summary>
            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', userSelect: 'text' }}>{draft.text}</pre>
          </details>
          <button type="button" onClick={() => { void copy(draft) }}>复制原文</button>{' '}
          <button type="button" disabled={input.phase !== 'plain'} onClick={() => append(draft)}>追加到当前输入框</button>
        </section>)}
      </div>
    </Modal>
  </>
}

export function apply(ctx: Context): void {
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions', id: 'dsh-draft-rescue', order: 150,
  }, DraftRescue))
}
