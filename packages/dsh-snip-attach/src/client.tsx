import type { Context } from '@deepseek-ai/cordis'
export type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
export type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
export type {} from '@deepseek-ai/dsh-client-ui-session/client'
export type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { useEffect, useRef, useState } from 'react'
import { FALLBACK, abortable, fileInputFor, injectFile, requireDesktop, requireCaptureCapabilities, shotUrl } from './intake.js'

export const inject = ['slots', 'remote', 'remote.commands']
type Props = PropsRuntime<'conversation.input.left'>
export type Execute = Context['remote']['commands']['execute']

function previewUrl(blob: Blob): string {
  try {
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') return URL.createObjectURL(blob)
  } catch { /* thumbnail is optional; confirm can still proceed */ }
  return ''
}
function releaseUrl(url: string): void {
  try {
    if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url)
  } catch { /* ignore */ }
}

interface Preview {
  url: string
  file: File
  fileInput: HTMLInputElement
  button: HTMLButtonElement
}

export function SnipButton(props: Props & { execute: Execute }) {
  if (typeof props.useInput !== 'function' || typeof props.useSession !== 'function') {
    return <span role="status">宿主缺少 useInput / useSession 接口，已拒绝截图。</span>
  }
  return <SnipReady {...props} />
}

function SnipReady({ sessionId, useInput, useSession, execute }: Props & { execute: Execute }) {
  const input = useInput(value => value)
  const session = useSession(value => value)
  const live = useRef(input)
  live.current = input
  const liveSession = useRef(session)
  liveSession.current = session
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const pending = useRef<AbortController | null>(null)
  const previewRef = useRef<Preview | null>(null)
  const clearPreview = (): void => {
    if (previewRef.current) releaseUrl(previewRef.current.url)
    previewRef.current = null
    setPreview(null)
  }
  useEffect(() => {
    setBusy(false)
    setNotice('')
    clearPreview()
    return () => { pending.current?.abort(); pending.current = null; clearPreview() }
  }, [sessionId])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => { setNotice('') }, 6000)
    return () => { clearTimeout(timer) }
  }, [notice])
  const allowed = (): boolean => {
    const state = live.current
    try { requireCaptureCapabilities(state, liveSession.current, execute, sessionId) } catch { return false }
    return !liveSession.current.removed && liveSession.current.subagent === null && state.phase === 'plain'
  }
  const requireSupport = (): void => {
    requireDesktop(window.location)
    requireCaptureCapabilities(live.current, liveSession.current, execute, sessionId)
  }
  let unsupported = ''
  try { requireSupport() } catch (error) { unsupported = error instanceof Error ? error.message : '无法识别截图接口。' }

  async function take(button: HTMLButtonElement): Promise<void> {
    if (pending.current || previewRef.current || !allowed()) return
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setNotice('')
    let captured = false
    const timeout = setTimeout(() => { controller.abort() }, 160_000)
    try {
      requireSupport()
      const fileInput = fileInputFor(button)
      const execution = await abortable(execute(sessionId, '/screenshot', []), controller.signal)
      if (controller.signal.aborted) return
      if (!execution.ok) throw new Error('截图命令执行失败。')
      const result = execution.value?.result
      if (result?.kind !== 'success') throw new Error(result?.text ?? '截图命令不可用。')
      const response = await fetch(shotUrl(result.text), { signal: controller.signal, cache: 'no-store', credentials: 'omit', redirect: 'error' })
      if (response.status === 204) { setNotice('截图已取消或未完成，请重试。'); return }
      if (response.status !== 200 || response.headers.get('Content-Type') !== 'image/png') throw new Error('截图读取失败，请重试。')
      const blob = await response.blob()
      captured = true
      if (!blob.size) throw new Error(FALLBACK)
      requireSupport()
      if (controller.signal.aborted) return
      if (!allowed() || fileInputFor(button) !== fileInput) throw new Error(FALLBACK)
      const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' })
      const next = { url: previewUrl(blob), file, fileInput, button }
      previewRef.current = next
      setPreview(next)
      setNotice('请预览截图，确认后再加入待发送附件。')
    } catch (error: unknown) {
      if (!controller.signal.aborted) setNotice(captured ? FALLBACK : error instanceof Error ? error.message : '截图失败，请重试。')
      else if (pending.current === controller) setNotice('截图等待超时，请重试。')
    } finally {
      clearTimeout(timeout)
      if (pending.current === controller) { pending.current = null; setBusy(false) }
    }
  }

  async function confirm(): Promise<void> {
    const current = previewRef.current
    if (!current || pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    try {
      requireSupport()
      if (!allowed() || fileInputFor(current.button) !== current.fileInput) throw new Error(FALLBACK)
      const before = new Set(live.current.attachmentIds)
      injectFile(current.fileInput, current.file)
      const deadline = Date.now() + 2000
      while (!controller.signal.aborted && allowed() && Date.now() < deadline
        && !live.current.attachmentIds.some(id => !before.has(id))) {
        await abortable(new Promise<void>(resolve => { setTimeout(resolve, 50) }), controller.signal)
      }
      if (controller.signal.aborted) return
      if (!allowed() || !current.fileInput.isConnected || !live.current.attachmentIds.some(id => !before.has(id))) throw new Error(FALLBACK)
      setNotice('已提交截图，请核对待发送图片；若未加入，可按 Ctrl+V。')
      clearPreview()
    } catch (error: unknown) {
      // Injection already happens after a captured preview; raw DataTransfer/DOM errors must not hide the Ctrl+V fallback.
      if (!controller.signal.aborted) setNotice(FALLBACK)
    } finally {
      if (pending.current === controller) { pending.current = null; setBusy(false) }
    }
  }

  function cancel(): void {
    if (pending.current) pending.current.abort()
    clearPreview()
    setBusy(false)
    setNotice('已取消加入附件。')
  }

  return <span style={{ position: 'relative', display: 'inline-flex' }}>
    <button type="button" aria-label="截图并添加附件" title={unsupported || '截图并添加附件（Windows）'}
      disabled={!!unsupported || busy || !!preview || !allowed()} onMouseDown={event => event.preventDefault()}
      onClick={event => { void take(event.currentTarget) }}
      style={{ display: 'inline-flex', padding: 6, border: 0, borderRadius: 6, color: 'inherit', background: 'transparent', cursor: 'pointer' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M8 6l1.5-3h5L16 6h4a2 2 0 012 2v11a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" /><circle cx="12" cy="13" r="4" />
      </svg>
    </button>
    {(notice || preview || unsupported) && <span role="status" aria-live="polite" style={{ position: 'absolute', bottom: '100%', left: 0, zIndex: 30, width: 260, padding: 10, borderRadius: 8, background: 'var(--dsw-static-neutral-100, #eee)', color: 'var(--dsw-static-neutral-900, #222)', boxShadow: '0 2px 12px #0003' }}>
      {preview && <>
        {preview.url && <img src={preview.url} alt="截图预览" style={{ display: 'block', width: '100%', maxHeight: 160, objectFit: 'contain', marginBottom: 8 }} />}
        <p style={{ margin: '0 0 8px' }}>请确认后再加入待发送附件。</p>
        <button type="button" disabled={busy} onClick={() => { void confirm() }}>确认加入</button>{' '}
        <button type="button" disabled={busy} onClick={cancel}>取消</button>
      </>}
      {(notice || unsupported) && <p style={{ margin: preview ? '8px 0 0' : 0 }}>{notice || unsupported}</p>}
    </span>}
  </span>
}

export function apply(ctx: Context): void {
  if (typeof ctx.slots?.inject !== 'function' || typeof ctx.slots?.register !== 'function') throw new Error('宿主缺少输入框槽位接口，已拒绝启用截图附件。')
  if (typeof ctx.remote?.commands?.execute !== 'function') throw new Error('宿主缺少 remote.commands.execute，已拒绝启用截图附件。')
  const Button = (props: Props) => <SnipButton {...props} execute={(...args) => ctx.remote.commands.execute(...args)} />
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left', id: 'dsh-snip-attach', order: 0,
  }, Button))
}
