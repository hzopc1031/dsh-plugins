import type { Context } from '@deepseek-ai/cordis'
export type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
export type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
export type {} from '@deepseek-ai/dsh-client-ui-session/client'
export type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { useEffect, useRef, useState } from 'react'
import { FALLBACK, abortable, fileInputFor, injectFile, requireDesktop, shotUrl } from './intake.js'

export const inject = ['slots', 'remote', 'remote.commands']
type Props = PropsRuntime<'conversation.input.left'>
export type Execute = Context['remote']['commands']['execute']
const boot = (): unknown => (window as unknown as { __DSH_BOOT__?: unknown }).__DSH_BOOT__

export function SnipButton({ sessionId, useInput, useSession, execute }: Props & { execute: Execute }) {
  const input = useInput(value => value)
  const unavailable = useSession(value => value.removed || value.subagent !== null)
  const live = useRef(input)
  live.current = input
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const pending = useRef<AbortController | null>(null)
  useEffect(() => {
    setBusy(false)
    setNotice('')
    return () => { pending.current?.abort(); pending.current = null }
  }, [sessionId])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => { setNotice('') }, 6000)
    return () => { clearTimeout(timer) }
  }, [notice])
  const allowed = (): boolean => {
    const state = live.current
    return !unavailable && state.phase === 'plain'
  }
  let supported = true
  try { requireDesktop(boot(), window.location) } catch { supported = false }

  async function take(button: HTMLButtonElement): Promise<void> {
    if (pending.current || !allowed()) return
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setNotice('')
    let captured = false
    const timeout = setTimeout(() => { controller.abort() }, 160_000)
    try {
      requireDesktop(boot(), window.location)
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
      requireDesktop(boot(), window.location)
      if (controller.signal.aborted) return
      if (!allowed() || fileInputFor(button) !== fileInput) throw new Error(FALLBACK)
      const before = new Set(live.current.attachmentIds)
      const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' })
      injectFile(fileInput, file)
      // onChange may reject silently (phase/image limits). Confirm the live input grew.
      await new Promise<void>(resolve => { setTimeout(resolve, 100) })
      if (controller.signal.aborted) return
      if (!live.current.attachmentIds.some(id => !before.has(id))) throw new Error(FALLBACK)
      setNotice('截图已加入待发送消息')
    } catch (error: unknown) {
      if (!controller.signal.aborted) setNotice(captured ? FALLBACK : error instanceof Error ? error.message : '截图失败，请重试。')
      else if (pending.current === controller) setNotice('截图等待超时，请重试。')
    } finally {
      clearTimeout(timeout)
      if (pending.current === controller) { pending.current = null; setBusy(false) }
    }
  }

  return <span style={{ position: 'relative', display: 'inline-flex' }}>
    <button type="button" aria-label="截图并添加附件" title="截图并添加附件（Windows）"
      disabled={!supported || busy || !allowed()} onMouseDown={event => event.preventDefault()}
      onClick={event => { void take(event.currentTarget) }}
      style={{ display: 'inline-flex', padding: 6, border: 0, borderRadius: 6, color: 'inherit', background: 'transparent', cursor: 'pointer' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M8 6l1.5-3h5L16 6h4a2 2 0 012 2v11a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" /><circle cx="12" cy="13" r="4" />
      </svg>
    </button>
    {notice && <span role="status" aria-live="polite" style={{ position: 'absolute', bottom: '100%', left: 0, zIndex: 30, width: 260, padding: 10, borderRadius: 8, background: 'var(--dsw-static-neutral-100, #eee)', color: 'var(--dsw-static-neutral-900, #222)', boxShadow: '0 2px 12px #0003' }}>{notice}</span>}
  </span>
}

export function apply(ctx: Context): void {
  const Button = (props: Props) => <SnipButton {...props} execute={(...args) => ctx.remote.commands.execute(...args)} />
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left', id: 'dsh-snip-attach', order: 0,
  }, Button))
}
