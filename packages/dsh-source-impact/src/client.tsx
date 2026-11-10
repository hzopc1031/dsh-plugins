import type { Context } from '@deepseek-ai/cordis'
export type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
export type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
export type {} from '@deepseek-ai/dsh-client-ui-session/client'
export type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { useEffect, useRef, useState } from 'react'

export const inject = ['slots', 'remote', 'remote.commands']
type Props = PropsRuntime<'conversation.session.header.actions'>
type Execute = Context['remote']['commands']['execute']

export function SourceImpactForm({ sessionId, execute }: Props & { execute: Execute }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(''), [kind, setKind] = useState('csv-key')
  const epoch = useRef(0)
  const inFlight = useRef(false)
  const close = () => { epoch.current++; inFlight.current = false; setOpen(false); setBusy(false); setNotice('') }
  useEffect(() => { close(); return () => { epoch.current++ } }, [sessionId])
  async function command(raw: string): Promise<string> {
    const response = await execute(sessionId, '/impact ' + raw, [])
    if (!response.ok || response.value?.result?.kind !== 'success') throw new Error(response.ok ? response.value?.result?.text ?? '命令不可用' : '连接失败')
    return response.value.result.text ?? ''
  }
  async function perform(work: () => Promise<void>) {
    if (inFlight.current) return
    inFlight.current = true
    const revision = epoch.current
    setBusy(true); setNotice('')
    try { await work() } catch (error) { if (epoch.current === revision) setNotice(error instanceof Error ? error.message : '操作失败') }
    finally { if (epoch.current === revision) { inFlight.current = false; setBusy(false) } }
  }
  return <>
    <button type="button" onClick={() => setOpen(true)}>资料引用登记</button>
    <Modal open={open} onClose={close} title="资料引用登记" closeLabel="关闭">
      <div style={{ width: 'min(680px, 80vw)', maxHeight: '70vh', overflowY: 'auto' }}>
        <p>用表单登记引用并保存初始基线，或在人工复核后原子接受新基线。模型侧工具仍然只读，不会改写基线。</p>
        <p role="status" aria-live="polite">{notice}</p>
        <form onSubmit={event => {
          event.preventDefault()
          const data = new FormData(event.currentTarget), value = (key: string) => String(data.get(key) ?? '').trim()
          const selector = kind === 'markdown-lines'
            ? { kind, start: Number(value('start')), end: Number(value('end')) }
            : kind === 'markdown-quote'
              ? { kind, text: value('quote') }
              : { kind, keyColumn: value('keyColumn'), keyValue: value('keyValue'), columns: value('columns').split(',').map(s => s.trim()).filter(Boolean) }
          const registration = {
            id: value('id'), source: value('source'), selector,
            conclusion: { id: value('conclusionId'), text: value('conclusion') },
            outputs: [{ path: value('outputPath'), kind: value('outputKind'), locator: value('locator'), label: value('label') }],
            recheck: value('recheck'),
          }
          void perform(async () => { setNotice(await command('register ' + JSON.stringify(registration))) })
        }}>
          <fieldset disabled={busy}><legend>登记一条引用</legend>
            <label style={{ display: 'block' }}>引用 id <input name="id" required /></label>
            <label style={{ display: 'block' }}>来源路径（项目内 .md / .csv） <input name="source" required /></label>
            <label style={{ display: 'block' }}>定位方式 <select name="kind" value={kind} onChange={event => setKind(event.target.value)}>
              <option value="csv-key">CSV 键值</option>
              <option value="markdown-lines">Markdown 行范围</option>
              <option value="markdown-quote">Markdown 原文</option>
            </select></label>
            {kind === 'csv-key' && <>
              <label style={{ display: 'block' }}>键列 <input name="keyColumn" required /></label>
              <label style={{ display: 'block' }}>键值 <input name="keyValue" required /></label>
              <label style={{ display: 'block' }}>选择列（逗号分隔） <input name="columns" required /></label>
            </>}
            {kind === 'markdown-lines' && <>
              <label style={{ display: 'block' }}>起始行 <input name="start" type="number" min={1} required /></label>
              <label style={{ display: 'block' }}>结束行 <input name="end" type="number" min={1} required /></label>
            </>}
            {kind === 'markdown-quote' && <label style={{ display: 'block' }}>引用原文 <textarea name="quote" required /></label>}
            <label style={{ display: 'block' }}>结论 id <input name="conclusionId" required /></label>
            <label style={{ display: 'block' }}>结论正文 <textarea name="conclusion" required /></label>
            <label style={{ display: 'block' }}>产出路径 <input name="outputPath" required /></label>
            <label style={{ display: 'block' }}>产出类型 <select name="outputKind" defaultValue="section"><option value="section">section</option><option value="table">table</option><option value="report">report</option></select></label>
            <label style={{ display: 'block' }}>产出定位 <input name="locator" required /></label>
            <label style={{ display: 'block' }}>产出名称 <input name="label" required /></label>
            <label style={{ display: 'block' }}>重查方法 <textarea name="recheck" required /></label>
            <button type="submit">登记并保存初始基线</button>
          </fieldset>
        </form>
        <form onSubmit={event => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          const scanId = String(data.get('scanId') ?? '').trim()
          const ids = String(data.get('ids') ?? '').trim()
          void perform(async () => { setNotice(await command('accept ' + scanId + (ids ? ' ' + ids : ''))) })
        }}>
          <fieldset disabled={busy}><legend>接受新基线</legend>
            <p>绑定刚才 check 得到的 scanId；提交前会重新核验。失败不会改写原登记，成功则保存新基线和上一版。</p>
            <label style={{ display: 'block' }}>scanId <input name="scanId" required pattern="[a-f0-9]{64}" /></label>
            <label style={{ display: 'block' }}>引用 id（可选，逗号分隔；留空则只接受已变化且可重新定位的引用） <input name="ids" /></label>
            <button type="submit">核验并接受新基线</button>
          </fieldset>
        </form>
      </div>
    </Modal>
  </>
}
export function apply(ctx: Context): void {
  const Panel = (props: Props) => <SourceImpactForm {...props} execute={(...args) => ctx.remote.commands.execute(...args)} />
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({ name: 'conversation.session.header.actions', id: 'dsh-source-impact', order: 155 }, Panel))
}
