/** Pure diagnosis over rc.5 raw session events; never interprets arbitrary output as authority. */
export interface LogEvent { readonly seq: number; readonly time?: number; readonly type: string; readonly data: unknown }
export interface Fact { value: string | null; source: string }
export interface Permissions { preset: Fact; sandbox: Fact; approval: Fact; workspace: Fact }
export interface BashFacts { mode: string | null; denied: boolean | null; runnerFailed: boolean; exitCode: number | null; timedOut: boolean; aborted: boolean }
export interface LiveObservation {
  callId: string; name: string; anchor: number; time: number;
  permissions?: Permissions; bash?: BashFacts; message?: string;
}
export interface ApprovalRecord {
  id: string; askedSeq: number; decidedSeq: number | null; outcome: string | null;
  reason: string; policy: Fact;
}
export interface Call {
  id: string; name: string; startSeq: number | null; resultSeq: number; time: number | null;
  args: unknown; content: string; isError: boolean; error: { name: string; code: string; reason: string };
  permissions: Permissions; approvals: ApprovalRecord[]; live?: LiveObservation;
  integrity: string[]; candidate: boolean;
}
export type Category = 'rule-denied' | 'sandbox-denied' | 'approval-unavailable' | 'user-rejected' | 'system-error' | 'unknown'
export interface Evidence { source: string; detail: string }
export interface Diagnosis { category: Category; label: string; explanation: string; approvalFlow: string; evidence: Evidence[]; suggestions: string[] }
export const labels: Record<Category, string> = {
  'rule-denied': '规则拒绝', 'sandbox-denied': '沙箱拒绝', 'approval-unavailable': '审批不可用',
  'user-rejected': '用户拒绝（审批返回 rejected）', 'system-error': '普通系统错误', unknown: '原因未确定',
}
export const obj = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
export const str = (v: unknown): string => typeof v === 'string' ? v : ''
const modes = new Set(['read-only', 'workspace-write', 'danger-full-access'])
const policies = new Set(['ask', 'never'])
const outcomes = new Set(['allowed-once', 'rejected', 'cancelled', 'unavailable'])
const missing = (): Fact => ({ value: null, source: '调用时未记录；不以当前配置补齐' })
export function emptyPermissions(cwd?: string): Permissions {
  return { preset: missing(), sandbox: missing(), approval: missing(), workspace: cwd ? { value: cwd, source: '会话 header.cwd（不是目标路径）' } : missing() }
}
function update(state: Permissions, e: LogEvent): Permissions {
  const d = obj(e.data), source = e.type + ' #' + e.seq
  if (e.type === 'permission/preset') return { ...state, preset: { value: str(d.preset) || null, source } }
  if (e.type === 'sandbox/mode') return { ...state, sandbox: { value: modes.has(str(d.mode)) ? str(d.mode) : null, source } }
  if (e.type === 'approval/policy') return { ...state, approval: { value: policies.has(str(d.policy)) ? str(d.policy) : null, source } }
  return state
}
function textContent(v: unknown): string {
  return Array.isArray(v) ? v.filter(b => obj(b).type === 'text').map(b => str(obj(b).text)).join('\n') : ''
}
function argsOf(v: unknown): unknown {
  if (typeof v !== 'string') return v
  try { return JSON.parse(v) as unknown } catch { return null }
}
/** Keep only the official bash canonical DTO facts; stdout cannot impersonate these fields. */
export function bashFacts(name: string, value: unknown): BashFacts | undefined {
  const v = obj(value), s = obj(v.sandbox)
  if (name !== 'bash' || v.kind !== 'foreground' || typeof v.exitCode !== 'number' && v.exitCode !== null
    || typeof v.timedOut !== 'boolean' || typeof v.aborted !== 'boolean' || typeof v.cwd !== 'string') return undefined
  return {
    mode: modes.has(str(s.mode)) ? str(s.mode) : null,
    denied: typeof s.denied === 'boolean' ? s.denied : null,
    runnerFailed: s.runnerFailed === true,
    exitCode: typeof v.exitCode === 'number' ? v.exitCode : null, timedOut: v.timedOut, aborted: v.aborted,
  }
}
/** Best-effort display redaction only. Never serialize full arguments or non-text/media blocks. */
export function display(value: string, limit = 12000): string {
  const safe = value
    .replace(/-----BEGIN [^-\r\n]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-\r\n]*PRIVATE KEY-----|$)/g, '[私钥已遮蔽]')
    .replace(/\bBearer\s+[^\s"'<>]+/gi, 'Bearer [已遮蔽]')
    .replace(/((?:token|password|passwd|secret|api[_-]?key)\s*["']?\s*[:=]\s*["']?)[^\s"',;]+/gi, '$1[已遮蔽]')
    .replace(/\b(?:github_pat_[\w]+|gh[pousr]_[\w]+|sk-[\w-]{12,})\b/g, '[凭据已遮蔽]')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
  return safe.length > limit ? safe.slice(0, limit) + '\n[显示已截断]' : safe
}
/** Only explicit path parameters. A shell command is never parsed to guess its targets. */
export function targets(args: unknown): string[] {
  const a = obj(args), result: string[] = []
  for (const key of ['path', 'filePath', 'file_path', 'target_path', 'directory']) if (typeof a[key] === 'string') result.push(key + '=' + a[key])
  if (Array.isArray(a.paths)) for (const p of a.paths) if (typeof p === 'string') result.push('paths=' + p)
  return [...new Set(result)].slice(0, 30)
}
/** Preserve raw-log order. Duplicate IDs are scoped to their start/result interval, never joined by tool name. */
export function collectCalls(events: readonly LogEvent[], live: readonly LiveObservation[] = [], cwd?: string): Call[] {
  let state = emptyPermissions(cwd)
  const pending = new Map<string, { event: LogEvent; name: string; args: unknown; permissions: Permissions; issues: string[] }>()
  const asks: Array<ApprovalRecord & { callId: string; toolName: string }> = []
  const asksById = new Map<string, typeof asks>()
  const asksByCall = new Map<string, typeof asks>()
  const liveByCall = new Map<string, LiveObservation[]>()
  for (const observation of live) {
    const entries = liveByCall.get(observation.callId) ?? []
    entries.push(observation); liveByCall.set(observation.callId, entries)
  }
  const calls: Call[] = []
  const globalIssues: string[] = []
  let previous = -1
  for (const e of events) {
    if (!Number.isSafeInteger(e.seq) || e.seq !== previous + 1) globalIssues.push('日志序号不连续或乱序')
    previous = e.seq
    state = update(state, e)
    const d = obj(e.data)
    if (e.type === 'tool/call' || e.type === 'tool/ptc-dispatch-start') {
      const id = str(d.callId) || str(d.subCallId)
      if (id) pending.set(id, { event: e, name: str(d.name), args: argsOf(d.arguments), permissions: state,
        issues: pending.has(id) ? ['同一调用 ID 有重叠开始记录'] : [] })
    } else if (e.type === 'approval/asked') {
      const id = str(d.id)
      if (asksById.has(id)) globalIssues.push('审批请求 ID 重复')
      const ask = { id, callId: str(d.callId), toolName: str(d.toolName), reason: str(d.reason),
        askedSeq: e.seq, decidedSeq: null, outcome: null, policy: state.approval }
      asks.push(ask)
      asksById.set(id, [...(asksById.get(id) ?? []), ask])
      asksByCall.set(ask.callId, [...(asksByCall.get(ask.callId) ?? []), ask])
    } else if (e.type === 'approval/decided') {
      const matches = str(d.id) ? asksById.get(str(d.id)) ?? [] : []
      if (matches.length !== 1 || matches[0]!.decidedSeq !== null) globalIssues.push('审批决定缺少唯一的 asked 或重复决定')
      else { matches[0]!.decidedSeq = e.seq; matches[0]!.outcome = str(d.outcome) }
    } else if (e.type === 'tool/result' || e.type === 'tool/ptc-dispatch') {
      const m = e.type === 'tool/result' ? obj(d.message) : d
      const id = e.type === 'tool/result' ? str(m.toolCallId) : str(d.subCallId)
      if (!id) continue
      const start = pending.get(id), name = start?.name || str(d.name) || '未知工具'
      const lo = start?.event.seq ?? -1
      const observations = (liveByCall.get(id) ?? []).filter(o => o.name === name && o.anchor > lo && o.anchor <= e.seq)
      const observed = observations.length === 1 ? observations[0] : undefined
      const approvalRecords = (asksByCall.get(id) ?? []).filter(a => a.toolName === name && a.askedSeq > lo && a.askedSeq < e.seq).map(({ callId: _c, toolName: _t, ...a }) => ({ ...a }))
      const error = obj(d.error)
      const content = textContent(m.content)
      const isError = m.isError === true
      const bash = observed?.bash
      const candidate = isError || !!bash && (bash.denied === true || bash.runnerFailed || bash.timedOut || bash.aborted || bash.exitCode !== null && bash.exitCode !== 0)
        || name === 'bash' && (/^\[sandbox: file access denied under (?:read-only|workspace-write|danger-full-access) mode\]$/m.test(content)
          || /^\[exit code: -?[1-9]\d*\]$/m.test(content)
          || /^\[(?:timed out after \d+ms|killed by signal: [^\]\r\n]+|stopped: [^\]\r\n]+)\]$/m.test(content))
      const integrity = [...new Set([...globalIssues, ...(start?.issues ?? []),
        ...start ? [] : ['缺少调用开始记录'], ...observations.length > 1 ? ['存在多个运行时观察，未使用'] : [],
        ...approvalRecords.some(a => a.outcome !== null && !outcomes.has(a.outcome)) ? ['未知审批 outcome'] : [],
      ])]
      calls.push({ id, name, startSeq: start?.event.seq ?? null, resultSeq: e.seq, time: e.time ?? null,
        args: start?.args, content, isError, error: { name: str(error.name), code: str(error.code), reason: str(error.reason) },
        permissions: observed?.permissions ?? start?.permissions ?? emptyPermissions(cwd),
        approvals: approvalRecords, live: observed, integrity, candidate })
      pending.delete(id)
    }
  }
  return calls
}
export function diagnose(call: Call): Diagnosis {
  const evidence: Evidence[] = [{ source: '结果 #' + call.resultSeq, detail: '工具 ' + call.name + '；isError=' + call.isError + '；code=' + (call.error.code || '未记录') }]
  const suggestions: string[] = []
  for (const a of call.approvals) evidence.push({ source: 'approval/asked #' + a.askedSeq + ' → ' + (a.decidedSeq ?? '无决定'), detail: a.id + '；outcome=' + (a.outcome ?? '未记录') + '；当时策略=' + (a.policy.value ?? '未记录') })
  if (call.live?.bash) evidence.push({ source: 'tools/result 结构化 bash 观察', detail: JSON.stringify(call.live.bash) })
  const rejected = call.approvals.filter(a => a.outcome === 'rejected')
  const unavailable = call.approvals.some(a => a.outcome === 'unavailable')
  const cancelled = call.approvals.some(a => a.outcome === 'cancelled')
  const never = rejected.some(a => a.policy.value === 'never')
  const unknownRejectPolicy = rejected.some(a => a.policy.value === null)
  const denied = call.error.code === 'FS_SANDBOX_DENIED' || call.live?.bash?.denied === true && !call.live.bash.runnerFailed
  const rule = call.error.code === 'AUTO_REVIEW_DENIED' || never
  const system = ['UNKNOWN_TOOL', 'INVALID_TOOL_OUTPUT', 'TOOL_TIMEOUT'].includes(call.error.code)
    || !!call.live?.bash && (call.live.bash.runnerFailed || call.live.bash.timedOut || call.live.bash.exitCode !== null && call.live.bash.exitCode !== 0 && call.live.bash.denied === false)
  let category: Category = 'unknown', explanation = '现有日志不能可靠区分权限拒绝与普通执行失败。错误文字、路径位置与当前设置均不足以单独证明原因。'
  const sources = [denied, rule, unavailable, rejected.length > 0 && !never && !unknownRejectPolicy, system].filter(Boolean).length
  if (call.integrity.length || sources > 1 || cancelled || unknownRejectPolicy
    || call.approvals.some(a => a.outcome === null)) {
    explanation = '证据不完整、冲突、审批已取消或缺少决定/当时策略，无法可靠归因。' + call.integrity.join('；')
  } else if (denied) {
    category = 'sandbox-denied'; explanation = '结构化 FS_SANDBOX_DENIED 或 bash sandbox.denied=true 表明执行被沙箱约束拦截。'
    suggestions.push('根据记录的目标路径、工作区和调用实际沙箱档位，人工核对该操作是否在允许范围；不要绕过限制。')
  } else if (rule) {
    category = 'rule-denied'; explanation = never ? '审批服务在 never 策略下返回 rejected；这是策略自动拒绝，不能归为用户点击拒绝。' : 'AUTO_REVIEW_DENIED 表明 Auto 审查直接拒绝该调用。'
    suggestions.push('核对审查原因和用户已授权的具体动作、目标及范围；由用户或维护者决定后续处理。')
  } else if (unavailable) {
    category = 'approval-unavailable'; explanation = '匹配的审批请求返回 unavailable，服务按 fail-closed 拒绝。可能是应答器缺失、失败或返回非法值；日志不能进一步区分。'
    suggestions.push('请维护者检查该会话的审批应答器及其错误；ask 本身不提供人机界面。')
  } else if (rejected.length) {
    category = 'user-rejected'; explanation = 'ask 策略下审批应答器返回 rejected。此类别表示审批拒绝；应答器也可能是机器，日志不能证明用户点击过拒绝或看到弹窗。'
    suggestions.push('向用户核对审批意图，并由维护者确认应答器来源；尊重拒绝，不自动重试。')
  } else if (system) {
    category = 'system-error'; explanation = '结构化结果表明工具注册/输出/超时错误，或 bash 执行失败且没有报告沙箱拒绝。该类别不保证操作系统、远端服务或子程序内部没有自己的访问控制。'
    suggestions.push('按错误代码或退出码人工排查工具注册、参数、进程/超时与系统环境；不要先假定扩大 DSH 权限能解决。')
  }
  let approvalFlow: string
  if (call.approvals.length) {
    approvalFlow = never
      ? '已进入审批服务并留下 asked/decided；never 在应答器派发前拒绝，因此没有交互审批。'
      : '已进入审批服务；asked 是审计事件，不是弹窗展示凭证。' +
        (unavailable ? ' unavailable 表示应答链不可用或失败，无法保证弹出界面。' : cancelled ? ' 请求被取消；取消不等于用户拒绝。' : '')
  } else {
    approvalFlow = '本次调用区间未见匹配的 approval/asked。仅凭缺失不能断言根本未进入审批：服务缺失、早期校验/规则/沙箱拦截、日志不完整或请求未带 callId 都可能造成缺失。'
    if (rule && call.error.code === 'AUTO_REVIEW_DENIED') approvalFlow += ' AUTO_REVIEW_DENIED 支持本次直接规则拒绝，而非等待审批。'
    if (denied) {
      const requested = str(obj(call.args).sandbox_permissions), standing = call.permissions.sandbox.value
      if (!requested) approvalFlow += ' 参数未请求 sandbox_permissions；普通沙箱拒绝不会自动转成审批请求。'
      else if (requested === standing) approvalFlow += ' 请求档位与记录的当前档位相同；官方同档执行无需沙箱升级审批。'
      else approvalFlow += ' 参数含 sandbox_permissions，但没有匹配审批记录，不能推断升级已获准。'
    }
  }
  if (category === 'unknown') suggestions.push('保留本次调用 ID、结果序号、原始工具错误及 asked/decided，补齐调用当时的权限和应答器证据后再判断；不要凭 Permission denied 或 EACCES 认定沙箱原因。')
  if (call.permissions.approval.value === null) suggestions.push('调用时审批策略未记录；当前默认策略不能用来补写历史事实。')
  return { category, label: labels[category], explanation, approvalFlow, evidence, suggestions }
}
export function render(call: Call): string {
  const d = diagnose(call)
  const fact = (f: Fact): string => (f.value ?? '未记录') + '（' + f.source + '）'
  const paths = targets(call.args)
  const a = obj(call.args)
  return display([
    '权限拒绝诊断台', '调用：' + call.id + ' / ' + call.name + ' / 结果 #' + call.resultSeq,
    '结果时间：' + (call.time === null ? '未记录' : new Date(call.time).toISOString()),
    '诊断：' + d.label, d.explanation,
    '调用时权限档位：' + fact(call.permissions.preset),
    '调用时沙箱模式：' + fact(call.permissions.sandbox),
    '调用时审批策略：' + fact(call.permissions.approval),
    '工作区：' + fact(call.permissions.workspace),
    '本次实际沙箱模式：' + (call.live?.bash?.mode ?? '未观测；一次性升级不等于改变会话模式'),
    '参数目标路径（原样，未解析符号链接或确认存在）：' + (paths.join('；') || '未记录/无法从参数可靠提取；不从 shell 文本猜测'),
    '参数 workdir：' + (str(a.workdir) || '未指定/未记录'),
    '请求升级档位：' + (str(a.sandbox_permissions) || '未指定'),
    '审批流程：' + d.approvalFlow,
    '审批记录：', ...call.approvals.map(r => JSON.stringify(r)),
    ...call.approvals.length ? [] : ['无匹配记录；不按工具名/时间邻近关联其他调用。'],
    '证据：', ...d.evidence.map(e => e.source + '：' + e.detail),
    '处理建议：', ...d.suggestions,
    '工具结果（仅文本；尽力遮蔽常见凭据，截断显示）：',
    display(call.content, 6000) || '未记录文本内容',
    '结构化错误：' + JSON.stringify(call.error),
    ...call.live?.message ? ['运行时错误：' + display(call.live.message, 1500)] : [],
    '本插件只诊断；不会修改权限、发起审批或自动重跑。任何拒绝都不保证自动弹审批。',
  ].join('\n'), 16000)
}

/** Fold only the supplied historical prefix, never today's configuration. */
export function permissionsAt(events: readonly LogEvent[], cwd?: string): Permissions {
  return events.reduce((state, event) => update(state, event), emptyPermissions(cwd))
}
