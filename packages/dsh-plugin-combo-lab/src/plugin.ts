import type { Context } from '@deepseek-ai/cordis'
import { CommandDefinitionId, type CommandResult } from '@deepseek-ai/dsh-commands'
import z from '@deepseek-ai/schemastery'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createPlan, observationTemplate, record, renderStudy } from './core.js'
import { Store } from './store.js'

export const name = 'plugin-combo-lab'
export const inject = ['commands']
export const Config = z.object({
  reportDir: z.string().default('.dsh/combo-lab').description('相对会话工作区的存档目录，或绝对路径；只保存用户录入的回归证据')
})
export interface Settings { reportDir: string }
const help = [
  '桌面组合回归台 /combo-lab',
  'plan <JSON>：选择两个插件及精确版本，创建 50 步计划',
  'show <计划ID>：查看计划、证据状态及最小复现清单',
  'template <计划ID> <步骤ID>：生成可编辑的 record JSON',
  'record <计划ID> <JSON>：追加一条操作证据（不自动验证桌面）',
  'snapshot <计划ID> <标签>：保存独立快照，建议升级前/后各一份',
  'compare <升级前快照ID> <升级后快照ID>：对照版本、证据及回归',
  '记录仅存本地工作区；待桌面验证、无法自动验证、headless/static 都不算桌面通过。',
  '不会安装、启停目标插件或操作桌面；请按计划人工执行。'
].join('\n')
export function apply(ctx: Context, settings: Partial<Settings> = {}): void {
  const reportDir = settings.reportDir ?? '.dsh/combo-lab'
  if (typeof reportDir !== 'string' || !reportDir.trim() || /[\x00-\x1f]/.test(reportDir)) throw new Error('reportDir 无效')
  // Serialize read-modify-write operations across sessions sharing a directory.
  let queue: Promise<unknown> = Promise.resolve()
  let disposed = false
  ctx.effect(() => ctx.commands.register({
    definitionId: CommandDefinitionId('dsh-plugin-combo-lab'),
    name: 'combo-lab', description: '桌面双插件回归计划、人工证据与升级快照对照',
    input: { hint: 'plan <JSON> | show <ID> | template <ID> <step> | record <ID> <JSON> | snapshot <ID> <label> | compare <before> <after>' },
    recordInput: false,
    handler: invocation => {
      const task = queue.catch(() => {}).then(async (): Promise<CommandResult> => {
        if (disposed || invocation.signal?.aborted) return { kind: 'error', text: '操作已取消或插件已停止' }
        const raw = invocation.rawInput.trim()
        if (!raw || raw === 'help') return { kind: 'success', text: help }
        if (raw.length > 40000) return { kind: 'error', text: '输入过长' }
        const cwd = invocation.agent.session.header.cwd
        if (!path.isAbsolute(reportDir) && (!cwd || !path.isAbsolute(cwd))) return { kind: 'error', text: '需要会话工作区绝对路径，或配置绝对 reportDir；未写入任何文件。' }
        const directory = path.isAbsolute(reportDir) ? path.normalize(reportDir) : path.resolve(cwd!, reportDir)
        const store = new Store(directory)
        const match = /^(\S+)(?:\s+([\s\S]*))?$/.exec(raw)!
        const action = match[1], rest = match[2]?.trim() ?? ''
        const parts = rest.split(/\s+/)
        let text: string
        try {
          if (action === 'plan') {
            const study = createPlan(JSON.parse(rest), randomUUID(), new Date().toISOString())
            await store.save(study, true)
            text = renderStudy(study) + '\n存档目录：' + directory
          } else if (action === 'show' && parts.length === 1 && rest) {
            text = renderStudy(await store.load(rest))
          } else if (action === 'template' && parts.length === 2) {
            const study = await store.load(parts[0])
            const template = observationTemplate(study, parts[1], new Date().toISOString())
            text = '人工核对后编辑 JSON；record 时 observedAt 会替换为实际录入时间。持久化 pass/fail 还需 restart 字段。\n/combo-lab record ' + parts[0] + ' ' + JSON.stringify(template)
          } else if (action === 'record') {
            const recordMatch = /^(\S+)\s+([\s\S]+)$/.exec(rest)
            if (!recordMatch) throw new Error('record 需要 ID 与 JSON')
            const study = await store.load(recordMatch[1])
            const observation: unknown = JSON.parse(recordMatch[2])
            if (!observation || typeof observation !== 'object' || Array.isArray(observation)) throw new Error('需要证据对象')
            const updated = record(study, { ...observation, observedAt: new Date().toISOString() })
            if (invocation.signal?.aborted) return { kind: 'error', text: '录入已取消' }
            await store.save(updated)
            text = renderStudy(updated)
          } else if (action === 'snapshot') {
            const snapshotMatch = /^(\S+)\s+([\s\S]+)$/.exec(rest)
            if (!snapshotMatch) throw new Error('snapshot 需要 ID 与标签')
            const study = await store.load(snapshotMatch[1])
            const snapshot = await store.freeze(study, snapshotMatch[2], new Date().toISOString())
            text = '已保存独立快照：' + snapshot.id + '\n标签：' + snapshot.label + '\n计划：' + study.plan.id + '\n存档目录：' + directory
          } else if (action === 'compare' && parts.length === 2) {
            const before = await store.snapshot(parts[0]), after = await store.snapshot(parts[1])
            const report = await store.saveComparison(before, after, new Date().toISOString())
            text = '升级快照对照（人工录入证据）\n' + before.label + ' → ' + after.label + '\n' + JSON.stringify(report.result, null, 2) +
              '\n对照结果已保存：' + path.join(directory, 'comparison-' + report.id + '.json')
          } else return { kind: 'error', text: help }
        } catch (error) {
          // Domain errors are safe; OS/JSON errors may echo paths or user input.
          const message = error instanceof Error && error.constructor === Error ? error.message : 'JSON、存档或目录读写失败，请核对参数与权限。'
          return { kind: 'error', text: message }
        }
        return { kind: 'success', text }
      })
      queue = task
      return task
    }
  }))
  ctx.effect(() => async () => { disposed = true; await queue.catch(() => {}) })
}