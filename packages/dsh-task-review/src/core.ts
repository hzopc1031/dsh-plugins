import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface Call {
  id: string; name: string; args: string; paths: string[]; started: number; duration: number | null
  status: 'success' | 'failure' | 'pending' | 'unknown'; changes: Change[]
}
export interface Change { path: string; kind: '新建' | '修改' | '删除' | '变更（类型不可用）' }
export interface Segment {
  goal: string; calls: Call[]; changes: Change[]; started: number; ended: number
  usage: string; outcome: string; from: number; to: number
}
export interface Settings { auto: boolean; toolThreshold: number; fileThreshold: number; durationMinutes: number; reportDir: string }
export const defaults: Settings = { auto: true, toolThreshold: 10, fileThreshold: 3, durationMinutes: 10, reportDir: '.dsh/reports' }
const sensitive = /token|key|password|secret|credential|authorization|cookie/i
/** Redact before truncation, persistence, path extraction or retry comparison. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 12) return '[深度限制]'
  if (typeof value === 'string') return value
    .replace(/((?:[\w-]*(?:token|key|password|secret|credential|authorization|cookie)[\w-]*)["']?\s*(?:=|:|\s)\s*)["'][^"']*["']/gi, '$1[REDACTED]')
    .replace(/\bBearer\s+[^\s"'`,;]+/gi, 'Bearer [REDACTED]')
    .replace(/((?:[\w-]*(?:token|key|password|secret|credential|authorization|cookie)[\w-]*)["']?\s*(?:=|:|\s)\s*)[^\s,;"'&}]+/gi, '$1[REDACTED]')
    .replace(/\bsk-[\w-]+/g, '[REDACTED]')
    .replace(/(https?:\/\/)[^/@\s]+:[^/@\s]+@/gi, '$1[REDACTED]@')
  if (Array.isArray(value)) return value.map(v => redact(v, depth + 1))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sensitive.test(k) ? '[REDACTED]' : redact(v, depth + 1)]))
  return value
}
export function text(value: unknown, limit = 200): string { return String(redact(value) ?? '').replace(/[\r\n\t]+/g, ' ').slice(0, limit) }
export function summary(value: unknown): string { return JSON.stringify(redact(value)).slice(0, 500) }
/** Arbitrary source, scripts and payload bodies cannot be safely summarized as credentials. */
export function argumentSummary(value: unknown): string {
  const omit = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(omit)
    if (!v || typeof v !== 'object') return v
    return Object.fromEntries(Object.entries(v).map(([k, child]) => [k, /^(code|command|content|text|file_text|new_str|old_str|old_string|new_string|body|script)$/i.test(k) ? '[正文省略]' : omit(child)]))
  }
  return summary(omit(value))
}
export function pathsFrom(value: unknown): string[] {
  const found = new Set<string>()
  const walk = (v: unknown) => {
    if (!v || typeof v !== 'object') return
    for (const [k, child] of Object.entries(v)) {
      if (/^(file_?path|path|filename|target)$/i.test(k) && typeof child === 'string') found.add(text(child, 500))
      else if (!sensitive.test(k)) walk(child)
    }
  }
  walk(redact(value)); return [...found]
}
export function eligible(s: Segment, c: Settings): boolean {
  return c.auto && (s.calls.length >= c.toolThreshold || new Set(s.changes.map(f => f.path)).size >= c.fileThreshold || s.ended - s.started >= c.durationMinutes * 60000)
}
export function filename(goal: string, now: number): string {
  const slug = text(goal, 48).replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').trim() || 'review'
  return `${new Date(now).toISOString().replace(/[:.]/g, '-')}-${slug}-${randomUUID().slice(0, 8)}.md`
}
export function reportDirectory(cwd: string | undefined, dir: string): string {
  if (!path.isAbsolute(dir) && !cwd) throw new Error('当前会话没有项目目录；请配置绝对 reportDir')
  return path.resolve(cwd ?? '', dir)
}
export async function archive(dir: string, goal: string, now: number, markdown: string): Promise<string> {
  await mkdir(dir, { recursive: true })
  const file = path.join(dir, filename(goal, now))
  await writeFile(file, markdown, { encoding: 'utf8', flag: 'wx' })
  return file
}
const cell = (s: string) => s.replace(/[|`<>]/g, c => `&#${c.charCodeAt(0)};`).replace(/[\r\n]/g, ' ')
export function render(s: Segment): string {
  const failed = s.calls.filter(c => c.status === 'failure'), pending = s.calls.filter(c => c.status === 'pending'), unknown = s.calls.filter(c => c.status === 'unknown')
  const retries = s.calls.filter((c, i) => s.calls.slice(0, i).some(p => p.status === 'failure' && p.name === c.name && p.args === c.args))
  return [`# 任务复盘：${text(s.goal) || '目标不可用'}`, '',
    `摘要：${s.calls.length} 次工具调用，${s.changes.length} 项文件变更，${failed.length} 次失败，${pending.length} 次未完成，${unknown.length} 次进程状态未知。`, '',
    `目标：${text(s.goal) || '不可用（本段没有人类用户消息）'}`,
    `结果：${s.outcome}；此处仅记录执行状态，不推断任务已完成。`,
    `范围：事件 [${s.from}, ${s.to})；耗时 ${Math.max(0, s.ended - s.started)} ms。`, '',
    '## 改动清单', ...(s.changes.length ? s.changes.map(f => `- ${f.kind}：${cell(f.path)}`) : ['- 没有可确认的文件改动证据。']), '',
    '## 失败与重试', `失败 ${failed.length} 次；同名同脱敏参数再次调用 ${retries.length} 次（疑似重试，不代表因果）。`,
    ...failed.map(c => `- ${cell(c.name)}：失败（调用 ${cell(c.id)}）`), '',
    '## 用量与耗时', `Token：${s.usage}。费用：不可用（宿主未提供账单金额）。`,
    '工具耗时仅计观察到的调用生命周期；缺失计时标为不可用。', '',
    '## 需要确认 / 下一步',
    ...(failed.length ? ['- 检查失败调用是否仍需处理；后续成功不自动消除早先失败。'] : []),
    ...(pending.length ? ['- 核对尚未收到最终结果的调用。'] : []),
    ...(unknown.length ? ['- 历史 bash 结果缺少 canonical value；工具流水线成功不证明进程成功。'] : []),
    ...(!failed.length && !pending.length && !unknown.length ? ['- 未发现失败或未完成调用；没有额外确认事项的客观证据。'] : []), '',
    '## 工具明细', '| 工具 | 参数摘要（脱敏） | 结果 | 耗时 ms | 涉及路径 |', '| --- | --- | --- | --- | --- |',
    ...s.calls.map(c => `| ${cell(c.name)} | ${cell(c.args)} | ${c.status} | ${c.duration ?? '不可用'} | ${cell(c.paths.join(', '))} |`), '',
    '限制：shell/外部工具的任意写入无法从参数可靠还原；仅列宿主变更摘要或已验证文件工具结果。', ''].join('\n')
}
