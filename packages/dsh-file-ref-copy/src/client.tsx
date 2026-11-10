import type { Context } from '@deepseek-ai/cordis'
export type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
export type {} from '@deepseek-ai/dsh-client-ui-chat/client'
export type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { useState } from 'react'
import { completedMarkdown, copyPath, extractReferences, type FileReference } from './core.js'

export const inject = ['slots']
type Props = PropsRuntime<'conversation.chat.assistant-actions'>

export function FileRefCopy({ messageId, sessionId, useChat, useSessions }: Props) {
  const markdown = useChat(snapshot => completedMarkdown(
    snapshot.legacy.nodes.filter(node => node.kind === 'assistant'), messageId,
  ))
  const cwd = useSessions(snapshot => snapshot.byId[sessionId]?.cwd)
  const [open, setOpen] = useState(false)
  const [refs, setRefs] = useState<FileReference[]>([])
  const [notice, setNotice] = useState('')
  if (markdown === undefined) return null
  async function copy(ref: FileReference, mode: 'absolute' | 'relative' | 'line') {
    try {
      const value = copyPath(ref, mode)
      if (value === undefined) throw new Error('当前路径形式不可用。')
      await navigator.clipboard.writeText(value)
      setNotice('已复制：' + value)
    } catch { setNotice('复制失败，请检查剪贴板权限，或从路径预览手动复制。') }
  }
  return <>
    <button type="button" title="从这条已完成回答的原始 Markdown 提取本地文件链接" onClick={() => {
      try { setRefs(extractReferences(markdown, cwd)); setNotice('') }
      catch { setRefs([]); setNotice('解析失败，未复制任何内容。') }
      setOpen(true)
    }}>复制文件路径</button>
    <Modal open={open} onClose={() => { setOpen(false); setRefs([]); setNotice('') }} title="回答中的文件引用" closeLabel="关闭">
      <div style={{ width: 'min(640px, 75vw)', maxHeight: '65vh', overflowY: 'auto' }}>
        <p>仅来自这条已加载且已完成的回答。路径使用 /；带行号复制保留 #L 起止范围。</p>
        <p role="status" aria-live="polite">{notice}</p>
        {!refs.length && !notice && <p>这条回答没有符合 rc.5 规则的本地文件链接。</p>}
        {refs.map((ref, index) => <section key={index} style={{ marginTop: 16 }}>
          <strong>{ref.label}</strong>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', userSelect: 'text' }}>{ref.path}</pre>
          <div>绝对：{ref.absolute ?? '工作区目录未知，无法解析'}</div>
          <div>相对：{ref.relative ?? '无可用工作区或跨盘路径'}</div>
          <button type="button" data-modal-autofocus={index === 0 || undefined} disabled={!ref.absolute} onClick={() => { void copy(ref, 'absolute') }}>复制绝对路径</button>{' '}
          <button type="button" disabled={!ref.relative} onClick={() => { void copy(ref, 'relative') }}>复制相对路径</button>{' '}
          <button type="button" disabled={ref.line === undefined} onClick={() => { void copy(ref, 'line') }}>复制带行号路径</button>
        </section>)}
      </div>
    </Modal>
  </>
}

export function apply(ctx: Context): void {
  ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
    name: 'conversation.chat.assistant-actions', id: 'dsh-file-ref-copy', order: 150,
  }, FileRefCopy))
}
