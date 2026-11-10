import type { Context } from '@deepseek-ai/cordis'
export type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
export type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
export type {} from '@deepseek-ai/dsh-client-ui-session/client'
export type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { useEffect, useRef, useState } from 'react'
import type { Check, Observation, Run } from './core.js'

export const inject = ['slots', 'remote', 'remote.commands']
type Props = PropsRuntime<'conversation.session.header.actions'>
type Execute = Context['remote']['commands']['execute']
interface Failure { id: string; outcome: 'fail' | 'blocked'; evidence: string }
interface Next { planId: string; remaining: number; template: { id: string; version: string } | null; failures: Failure[]; step: { id: string; run: Run; check: Check; template: Observation } | null }

export function ComboLab({ sessionId, execute }: Props & { execute: Execute }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(''), [id, setId] = useState('')
  const [next, setNext] = useState<Next | null>(null)
  const epoch = useRef(0)
  const inFlight = useRef(false)
  const close = () => { epoch.current++; inFlight.current = false; setOpen(false); setBusy(false); setNotice(''); setNext(null); setId('') }
  useEffect(() => { close(); return () => { epoch.current++ } }, [sessionId])
  async function command(raw: string): Promise<string> {
    const response = await execute(sessionId, '/combo-lab ' + raw, [])
    if (!response.ok || response.value?.result?.kind !== 'success') throw new Error(response.ok ? response.value?.result?.text ?? '命令不可用' : '连接失败')
    return response.value.result.text ?? ''
  }
  async function perform(work: (valid: () => boolean) => Promise<void>) {
    if (inFlight.current) return
    inFlight.current = true
    const revision = epoch.current
    const valid = () => epoch.current === revision
    setBusy(true); setNotice('')
    try { await work(valid) } catch (error) { if (valid()) setNotice(error instanceof Error ? error.message : '操作失败') }
    finally { if (valid()) { inFlight.current = false; setBusy(false) } }
  }
  async function load(planId: string, valid: () => boolean) {
    const row: Next = JSON.parse(await command('next ' + planId))
    if (valid()) { setId(planId); setNext(row) }
  }
  return <>
    <button type="button" onClick={() => setOpen(true)}>插件组合检查</button>
    <Modal open={open} onClose={close} title="插件组合检查" closeLabel="关闭">
      <div style={{ width: 'min(680px, 80vw)', maxHeight: '70vh', overflowY: 'auto' }}>
        <p>每次检查两个插件。先填写计划，再按顺序人工操作、记录证据。不会安装、启停插件或自动操作桌面。</p>
        <p role="status" aria-live="polite">{notice}</p>
        {!next && <form onSubmit={event => {
          event.preventDefault()
          const data = new FormData(event.currentTarget), value = (key: string) => String(data.get(key) ?? '').trim()
          void perform(async valid => {
            const result = await command('plan ' + JSON.stringify({
              plugins: [{ name: value('a'), version: value('av') }, { name: value('b'), version: value('bv') }],
              environment: { platform: 'win32', client: 'official-desktop', version: value('version'), machine: value('machine') },
              workspace: value('workspace'), configBaseline: value('baseline'),
              ...(value('template') ? { templateId: value('template') } : {}),
            }))
            const planId = /计划：([0-9a-f-]{36})/.exec(result)?.[1]
            if (!planId) throw new Error('计划已创建但无法读取 ID，请查看 /combo-lab 输出。')
            if (valid()) await load(planId, valid)
          })
        }}>
          <fieldset disabled={busy}><legend>1. 创建计划</legend>
            {([['a','插件 A 包名'],['av','A 精确版本'],['b','插件 B 包名'],['bv','B 精确版本'],['version','桌面 DSH 版本'],['machine','机器标识'],['workspace','工作区标识'],['baseline','配置基线标识']] as const).map(([name,label]) => <label key={name} style={{ display: 'block' }}>{label} <input name={name} required defaultValue={name === 'version' ? '0.2.1-rc.5' : ''} /></label>)}
            <label style={{ display: 'block' }}>检查模板 <select name="template" defaultValue="">
              <option value="">全部交互面（默认完整矩阵）</option>
              <option value="input">仅输入框</option>
              <option value="sidebar">仅侧栏</option>
              <option value="session-menu">仅会话菜单</option>
              <option value="commands">仅命令入口</option>
              <option value="tools-and-panels">工具入口与界面面板</option>
            </select></label>
            <button type="submit">创建检查计划</button>
          </fieldset>
        </form>}
        <form onSubmit={event => { event.preventDefault(); void perform(valid => load(id.trim(), valid)) }}>
          <label>继续已有计划 <input aria-label="计划 ID" value={id} onChange={event => setId(event.target.value)} required /></label>
          <button type="submit" disabled={busy}>读取下一步</button>
        </form>
        {next && <p>计划：{next.planId} · 检查模板：{next.template ? next.template.id + '@' + next.template.version : 'all-surfaces（未记录，等同完整矩阵）'} · 尚未记录 {next.remaining} 步。完整记录、重录及升级快照：/combo-lab help。</p>}
        {next?.step && <form key={next.step.id} onSubmit={event => {
          event.preventDefault()
          const data = new FormData(event.currentTarget), step = next.step!
          const observation = { ...step.template, outcome: String(data.get('outcome')), observer: String(data.get('observer')), evidence: String(data.get('evidence')),
            ...(step.check.kind === 'persistence' ? { restart: { before: String(data.get('before')), after: String(data.get('after')), fullyExited: data.get('restart') === 'on' } } : {}),
          }
          void perform(async valid => {
            await command('record ' + next.planId + ' ' + JSON.stringify(observation))
            if (valid()) await load(next.planId, valid)
          })
        }}><fieldset disabled={busy}><legend>2. 人工检查：{next.step.id}</legend>
          <p>{next.step.run.instructions}</p><p>本轮目标启用顺序：{next.step.run.enabled.map(p => p.name + '@' + p.version).join(' → ') || '两个目标均关闭'}</p>
          <p>{next.step.check.instructions}</p>
          <label>结果 <select name="outcome" defaultValue="blocked"><option value="blocked">受阻</option><option value="unsupported">无相关入口 / 不适用</option><option value="pass">人工核对通过</option><option value="fail">人工核对失败</option></select></label>
          <label style={{ display: 'block' }}>记录人 <input name="observer" required /></label>
          <label style={{ display: 'block' }}>实际动作与结果 <textarea name="evidence" required maxLength={8000} /></label>
          {next.step.check.kind === 'persistence' && <><label>重启前值 <input name="before" /></label><label>重启后值 <input name="after" /></label><label><input type="checkbox" name="restart" />已完全退出（含托盘）后重启</label></>}
          <label style={{ display: 'block' }}><input type="checkbox" required />我已核对本机桌面版本、工作区、配置基线及实际启用集与计划一致；记录为人工观察。</label>
          <button type="submit">保存证据并继续</button>
        </fieldset></form>}
        {next && next.failures && next.failures.length > 0 && <section>
          <h3>失败与受阻项</h3>
          <p>受阻和不适用不代表通过。点击可查看或重录该步。</p>
          {next.failures.map(item => <p key={item.id}>
            <button type="button" disabled={busy} onClick={() => { void perform(valid => load(next.planId + ' ' + item.id, valid)) }}>{item.id} · {item.outcome === 'fail' ? '失败' : '受阻'}</button>
            {' '}{item.evidence}
          </p>)}
        </section>}
        {next && !next.step && <p>当前计划步骤均有记录；受阻和不适用不代表通过。用 /combo-lab show {next.planId} 核对结论。</p>}
      </div>
    </Modal>
  </>
}
export function apply(ctx: Context): void {
  const Panel = (props: Props) => <ComboLab {...props} execute={(...args) => ctx.remote.commands.execute(...args)} />
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({ name: 'conversation.session.header.actions', id: 'dsh-plugin-combo-lab', order: 160 }, Panel))
}
