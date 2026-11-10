import { createHash } from 'node:crypto'

export type Presence = 'yes' | 'no' | 'unknown' | 'not-applicable'
export type Category = 'project' | 'global' | 'runtime' | 'skill' | 'other'
export interface ObservedMessage {
  seq: number; time: number; role: string; body: string; source: Record<string, unknown>
  current: boolean; baseline?: boolean
}
export interface FileFact { key: string; path: string; category: Category; exists: Presence; note?: string }
export interface RuleVersion {
  id: string; key: string; label: string; category: Category; producer: string; scope?: string
  path?: string; role: string; seq: number; time: number; body: string
  digest: string; declaredDigest?: string; action: 'set' | 'replace' | 'remove'
  current: boolean; lifecycle: 'active' | 'superseded' | 'removed' | 'not-retained'
  bodyQuality: 'rendered' | 'partial' | 'ambiguous'; note?: string
}
export interface RuleRow {
  key: string; label: string; category: Category; fileExists: Presence; fileNote?: string
  everInjected: boolean; currentContext: boolean; versions: RuleVersion[]
}
export interface ConflictSide {
  versionId: string; source: string; category: Category; role: string; seq: number
  digest: string; current: boolean; lifecycle: RuleVersion['lifecycle']; line: number; quote: string
}
export interface SuspectedConflict {
  label: '疑似冲突'; topic: string; window: 'current' | 'historical'
  left: ConflictSide; right: ConflictSide; explanation: string; suggestion: string
}
export interface Report {
  capturedThroughSeq: number; rows: RuleRow[]; conflicts: SuspectedConflict[]; notices: string[]
  analysis: { limited: boolean; eligibleVersions: number; inspectedVersions: number; checks: number }; limitations: string[]
}
export const hash = (body: string): string => createHash('sha256').update(body).digest('hex')
export function categoryOf(source: Record<string, unknown>, scope?: string, path?: string): Category {
  if (source.kind === 'agent-instructions') {
    if (/^(user-global|agents-global)(?:\u0000|\/|$)/.test(scope ?? '') || /^(~\/(?:\.dsh|\.agents)|\$(?:DSH_HOME|DSH_AGENTS_HOME))\//.test(path ?? '')) return 'global'
    return 'project'
  }
  if (/skill/i.test(String(source.kind))) return 'skill'
  if (source.kind === 'system-prompt' || source.kind === 'runtime-context' || source.form === 'snapshot') return 'runtime'
  return 'other'
}
export function instructionKey(scope: string): string { return 'agent-instructions:' + scope }
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
interface Change { action: RuleVersion['action']; scope: string; path: string; digest?: string }
function changesOf(source: Record<string, unknown>): Change[] {
  if (!Array.isArray(source.changes)) return []
  return source.changes.filter((c): c is Change => record(c) && ['set','replace','remove'].includes(String(c.action)) && typeof c.scope === 'string' && typeof c.path === 'string' && (c.digest === undefined || typeof c.digest === 'string'))
}
function version(m: ObservedMessage, key: string, label: string, body: string, extra: Partial<RuleVersion> = {}): RuleVersion {
  return { id: `${m.seq}:${key}`, key, label, category: categoryOf(m.source), producer: String(m.source.kind ?? 'unknown'),
    role: m.role, seq: m.seq, time: m.time, body, digest: hash(body), action: 'set', current: m.current,
    lifecycle: m.current ? 'active' : 'not-retained', bodyQuality: 'rendered', ...extra }
}
/** Only structured sources enable workspace parsing; text alone cannot impersonate a producer. */
export function extractVersions(m: ObservedMessage): RuleVersion[] {
  const source = m.source
  if (source.kind === 'user' || source.kind === 'model' || source.kind === 'tool') return []
  if (m.role === 'system' && Array.isArray(source.observedSystemSections)) {
    const parts = source.observedSystemSections.filter((s): s is {name: string; text: string} => record(s) && typeof s.name === 'string' && typeof s.text === 'string' && s.text.length > 0)
    if (parts.map(p => p.text).join('\n\n') === m.body) return parts.map(p => version(m, 'system-prompt:' + p.name, 'system-prompt / ' + p.name, p.text))
  }
  if (source.kind === 'agent-instructions') {
    const changes = changesOf(source)
    const headings = [...m.body.matchAll(/^(Instructions from|Additional instructions from|Updated instructions from|Instructions removed): (.+)\r?$/gm)]
    const valid = changes.length > 0 && changes.length === headings.length && changes.every((c, i) => headings[i]?.[2]?.replace(/\r$/, '') === c.path)
    if (!valid) return [version(m, `opaque:agent-instructions:${m.seq}`, '工作区指令（来源段边界无法可靠拆分）', m.body, { bodyQuality: 'ambiguous', note: '保留完整注入文本，不把正文中的伪造标题当作文件边界；不参与自动冲突检测。' })]
    return changes.map((c, i) => {
      const heading = headings[i]!
      let body = m.body.slice(heading.index! + heading[0].length, headings[i + 1]?.index ?? m.body.length)
        .replace(/^\r?\n\r?\n/, '').replace(/\r?\n<\/system-reminder>\s*$/, '').trimEnd()
      if (heading[1] === 'Additional instructions from' || heading[1] === 'Updated instructions from') {
        const split = body.indexOf('\n\n')
        if (split >= 0) body = body.slice(split + 2)
      }
      if (c.action === 'remove') body = ''
      return version(m, instructionKey(c.scope), c.path, body, {
        category: categoryOf(source, c.scope, c.path), path: c.path, scope: c.scope, action: c.action,
        declaredDigest: c.digest,
        bodyQuality: /Workspace instruction budget [^\n]*truncated/.test(m.body) ? 'partial' : 'rendered',
        note: '正文来自注入消息，可能含官方截断及转义；不是当前磁盘文件的副本。',
      })
    })
  }
  // Snapshot sections are attribution metadata; require an exact body match before splitting.
  if (source.form === 'snapshot' && Array.isArray(source.sections)) {
    const sections = source.sections.filter((s): s is { name: string; text: string } => record(s) && typeof s.name === 'string' && typeof s.text === 'string')
    if (sections.length && (m.body === sections.map(s => s.text).join('\n\n') || m.body === 'Current runtime context. This snapshot supersedes earlier runtime-context snapshots.\n\n' + sections.map(s => s.text).join('\n\n'))) return sections.map(s =>
      version(m, `${String(source.kind)}:${s.name}`, `${String(source.kind)} / ${s.name}`, s.text))
  }
  // Unknown sourced notices/catalogs are visible but are not assumed to be rules.
  if (m.role !== 'system' && m.role !== 'developer' && source.form !== 'instructions' && source.form !== 'snapshot' && !/skill|runtime-context/.test(String(source.kind))) return []
  const identity = [source.path, source.name, source.skillName].find((s): s is string => typeof s === 'string' && s.length > 0)
  const key = m.role === 'system' || source.form === 'snapshot' ? `${String(source.kind)}:${m.role}` : `${String(source.kind)}:message:${m.seq}`
  return [version(m, key, String(source.kind ?? '未声明来源') + (identity ? ' / ' + identity : ''), m.body)]
}

interface Directive { topic: string; polarity: 'require' | 'forbid'; line: number; quote: string }
const topics: [string, RegExp][] = [
  ['全局安装依赖', /全局(?:安装|依赖)|(?:global(?:ly)?\s+install|install\w*\s+(?:\S+\s+){0,3}global)|\b(?:npm|pnpm|yarn|bun)\s+(?:install|add|i)\b[^\n;；]*?(?:\s-g\b|--global\b)/i],
  ['改写指令文件', /(?:(?:改写|修改|编辑|重写|write|edit|rewrite)[^。.!！\n]{0,30}(?:AGENTS\.md|CLAUDE\.md|指令文件))|(?:(?:AGENTS\.md|CLAUDE\.md|指令文件)[^。.!！\n]{0,20}(?:改写|修改|编辑))/i],
  ['提交 Git', /git\s+commit|(?:创建|执行|进行|自动)?(?:git\s*)?提交(?:代码|变更|更改)|\bcommits?\b/i],
  ['推送 Git', /git\s+push|推送(?:代码|分支|仓库|变更)|\bpush\b/i],
  ['发布 npm', /npm\s+publish|发布(?:到\s*)?npm/i],
  ['委派子代理', /(?:创建|启动|使用|委派|spawn|delegate)[^。.!！\n]{0,25}(?:子代理|sub[ -]?agents?)/i],
  ['联网', /联网|访问互联网|(?:access|use|connect to)\s+(?:the\s+)?(?:internet|network)/i],
]
/** Deliberately bounded template heuristic, never a language-wide satisfiability claim. */
export function directives(body: string): Directive[] {
  const result: Directive[] = []
  let fence = ''
  for (const [i, raw] of body.split('\n').entries()) {
    const f = /^\s*(`{3,}|~{3,})/.exec(raw)
    if (f) { fence = fence ? '' : f[1]!; continue }
    if (fence || /^\s*>/.test(raw) || /^\s*#/.test(raw)) continue
    for (const part of raw.split(/[。；;！!?？]/)) {
      const quote = part.trim()
      if (!quote || quote.length > 1000 || /(?:不要|禁止|不得)\s*(?:禁止|阻止)|not\s+(?:prohibit|forbid)/i.test(quote)) continue
      const forbid = /禁止|不要|不得|严禁|不能|不允许|避免|不(?:要)?做|\b(?:must not|do not|don't|never|avoid|forbidden|prohibited)\b/i.test(quote)
      const require = /必须|务必|应当|请(?:执行|安装|使用|全局)|\b(?:must|should|always|required|require)\b/i.test(quote)
        || /(?:需要|要求)[^。\n]{0,20}(?:全局安装|安装全局|修改|编辑|联网|git\s+(?:commit|push)|npm\s+publish|使用子代理)/i.test(quote)
        || /^[-*\s]*(?:npm|pnpm|yarn|bun)\s+(?:i|install|add)\b/i.test(quote)
        || /^[-*\s]*(?:全局安装(?:依赖|工具|包)|(?:please\s+)?(?:install|run|spawn|delegate)\b)/i.test(quote)
      if (!forbid && !require) continue
      for (const [topic, pattern] of topics) if (pattern.test(quote)) result.push({ topic, polarity: forbid ? 'forbid' : 'require', line: i + 1, quote })
    }
  }
  return result
}
const side = (v: RuleVersion, d: Directive): ConflictSide => ({ versionId: v.id, source: v.label, category: v.category, role: v.role, seq: v.seq, digest: v.digest, current: v.current, lifecycle: v.lifecycle, line: d.line, quote: d.quote })
export interface ConflictScan { conflicts: SuspectedConflict[]; limited: boolean; eligibleVersions: number; inspectedVersions: number; checks: number }
export function scanConflicts(versions: readonly RuleVersion[], includeHistory = false): ConflictScan {
  const eligible = versions.filter(v => v.action !== 'remove' && v.bodyQuality !== 'ambiguous' && (includeHistory || v.current && v.lifecycle === 'active'))
  // Keep the latest bounded window; the complete version ledger remains available in the report.
  const candidates = eligible.slice(-300), parsed = candidates.map(v => directives(v.body))
  const result: ConflictScan = { conflicts: [], limited: eligible.length > candidates.length, eligibleVersions: eligible.length, inspectedVersions: candidates.length, checks: 0 }
  for (let i = 0; i < candidates.length; i++) {
    const a = candidates[i]!, da = parsed[i]!
    for (let j = i; j < candidates.length; j++) {
      const b = candidates[j]!, db = parsed[j]!
      for (const [ai, x] of da.entries()) for (const [bi, y] of db.entries()) {
        if (i === j && bi <= ai) continue
        if (++result.checks > 20000) { result.limited = true; return result }
        if (x.topic !== y.topic || x.polarity === y.polarity) continue
        result.conflicts.push({ label: '疑似冲突', topic: x.topic,
          window: a.current && b.current && a.lifecycle === 'active' && b.lifecycle === 'active' ? 'current' : 'historical',
          left: side(a, x), right: side(b, y),
          explanation: '同一动作同时出现禁止与要求措辞；适用目录、条件、例外和引用语境仍需人工核对。角色及展示顺序不构成自动裁决。',
          suggestion: '核对两侧适用范围，为该动作明确允许条件、禁止条件或例外；人工修订对应来源。本插件不修改文件。' })
        if (result.conflicts.length >= 100) { result.limited = true; return result }
      }
    }
  }
  return result
}
export function detectConflicts(versions: readonly RuleVersion[], includeHistory = false): SuspectedConflict[] { return scanConflicts(versions, includeHistory).conflicts }
export function buildReport(messages: readonly ObservedMessage[], files: readonly FileFact[] = [], includeHistory = false, capturedThroughSeq = -1): Report {
  const all: RuleVersion[] = [], active = new Map<string, RuleVersion>()
  for (const m of messages) {
    // Baseline reset has explicit producer semantics. It is unrelated to numeric load order.
    if (m.current && m.source.kind === 'agent-instructions' && m.source.baseline === true) {
      for (const [key, prev] of active) if (prev.producer === 'agent-instructions') { prev.lifecycle = 'superseded'; active.delete(key) }
    }
    if (m.current && m.role === 'system') {
      for (const [key, prev] of active) if (prev.role === 'system') { prev.lifecycle = 'superseded'; active.delete(key) }
    }
    if (m.current && m.source.form === 'snapshot') {
      for (const [key, prev] of active) if (prev.producer === m.source.kind) { prev.lifecycle = 'superseded'; active.delete(key) }
    }
    for (const v of extractVersions(m)) {
      if (v.current) {
        const prev = active.get(v.key)
        if (prev) prev.lifecycle = v.action === 'remove' ? 'removed' : 'superseded'
        v.lifecycle = v.action === 'remove' ? 'removed' : 'active'
        active.set(v.key, v)
      }
      all.push(v)
    }
  }
  const rows = new Map<string, RuleRow>()
  for (const file of files) rows.set(file.key, { key: file.key, label: file.path, category: file.category, fileExists: file.exists, fileNote: file.note, everInjected: false, currentContext: false, versions: [] })
  for (const v of all) {
    let row = rows.get(v.key)
    if (!row) { row = { key: v.key, label: v.label, category: v.category, fileExists: v.path ? 'unknown' : 'not-applicable', everInjected: false, currentContext: false, versions: [] }; rows.set(v.key, row) }
    row.everInjected ||= v.action !== 'remove'
    // A removal notice is retained evidence, but contains no retained rule body.
    row.currentContext ||= v.current && v.action !== 'remove'
    row.versions.push(v)
  }
  const scan = scanConflicts(all, includeHistory)
  return { capturedThroughSeq, rows: [...rows.values()], conflicts: scan.conflicts, analysis: { limited: scan.limited, eligibleVersions: scan.eligibleVersions, inspectedVersions: scan.inspectedVersions, checks: scan.checks }, notices: scan.limited ? ['冲突扫描已达到上限：只检查最近 300 个候选版本，最多 20,000 次原句对照 / 100 项发现；结果不完整。正文版本台账未截断。'] : [], limitations: [
    '当前上下文指已记录的模型 surface，尚未发起请求时不代表请求已发送；不包含未入日志的 inbox。',
    '曾经注入指进入过日志的模型上下文；不证明服务商收到或模型遵守。压缩摘要不证明原规则正文仍完整保留。',
    '疑似冲突使用有限的中英文动作模板；未检出不代表没有冲突，也无法解释模型为何没有遵守某条规则。',
    '加载顺序、展示顺序、system-prompt section order 均不是通用指令优先级；不同范围和条件需要人工判断。',
  ] }
}
const labels: Record<Category, string> = { project: '项目指令', global: '全局指令', runtime: '运行时规则', skill: '技能指令', other: '其他带来源指令' }
const states: Record<Presence, string> = { yes: '是', no: '否', unknown: '未知', 'not-applicable': '不适用' }
const lifecycle: Record<RuleVersion['lifecycle'], string> = { active: '当前版本', superseded: '已被替换（正文可能仍保留）', removed: '已撤回（正文可能仍保留）', 'not-retained': '原文不在当前 surface' }
const cell = (s: string): string => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\|/g,'&#124;').replace(/`/g,'&#96;').replace(/[\\[\]()*!_#]/g, '\\$&').replace(/\r?\n/g,'<br>')
export function renderReport(report: Report, includeHistory = false, compact = false): string {
  const out = ['# 指令冲突解释器', `观察截止 seq：${report.capturedThroughSeq}。来源顺序不是优先级。`,
    '', '| 来源 / 分类 | 文件存在 | 曾经注入 | 当前上下文仍含规则正文 |', '| --- | --- | --- | --- |']
  const rows = compact ? report.rows.slice(0, 20) : report.rows
  if (compact) out.push('摘要最多 20 个来源、10 项冲突、20 段正文，每段最多 3000 字符。完整正文：/instruction-conflicts json；历史：history-json。')
  for (const row of rows) out.push(`| ${cell(row.label)} / ${labels[row.category]} | ${states[row.fileExists]} | ${row.everInjected ? '是' : '否（未观察到）'} | ${row.currentContext ? '是' : '否'} |`)
  out.push('', '## 正文疑似冲突')
  if (!report.conflicts.length) out.push('有限模板未检出疑似冲突；这不证明规则一致。')
  for (const c of compact ? report.conflicts.slice(0, 10) : report.conflicts) {
    out.push('', `### 疑似冲突：${c.topic} / ${c.window === 'current' ? '当前版本' : '历史对照，非当前同时生效结论'}`,
      '| 左侧来源与原句 | 右侧来源与原句 |', '| --- | --- |',
      `| ${cell(c.left.source)} / ${c.left.role} / seq ${c.left.seq} / L${c.left.line}<br>${cell(c.left.quote)} | ${cell(c.right.source)} / ${c.right.role} / seq ${c.right.seq} / L${c.right.line}<br>${cell(c.right.quote)} |`,
      c.explanation, '修订建议：' + c.suggestion)
  }
  out.push('', '## 实际注入正文与版本')
  let rendered = 0
  for (const row of rows) {
    if (row.fileNote) out.push('', cell(row.label) + '：' + cell(row.fileNote))
    for (const v of row.versions.filter(v => includeHistory || v.current)) {
      if (compact && rendered++ >= 20) break
      out.push('', `### ${cell(v.label)} / seq ${v.seq} / ${cell(v.role)}`,
        `版本 SHA-256：${v.digest}；${lifecycle[v.lifecycle]}；原文仍保留：${v.current && v.action !== 'remove' ? '是' : '否'}；正文：${v.bodyQuality}。`,
        ...(v.declaredDigest ? ['来源记录 digest：' + cell(v.declaredDigest) + '（文件身份，不等同于注入正文 SHA-256）。'] : []),
        cell(compact && v.body.length > 3000 ? v.body.slice(0, 3000) + '\n[正文截断，完整内容见 json]' : v.body) || '（撤回通知或空正文）', ...(v.note ? [v.note] : []))
    }
  }
  out.push('', ...report.notices, '', ...report.limitations)
  return out.join('\n')
}




