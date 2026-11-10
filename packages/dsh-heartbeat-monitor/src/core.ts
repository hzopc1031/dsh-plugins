/**
 * Pure heartbeat rules: no timers, no I/O, no DSH imports.
 * Every function takes `now` explicitly so tests can drive a fake clock.
 */

export interface Settings {
  /** Master switch. */
  enabled: boolean
  /** N: minutes between progress cards while a run is active. */
  intervalMinutes: number
  /** M: minutes without any activity before a silence warning. */
  silenceMinutes: number
  /** K: consecutive identical tool calls / identical errors before a repeat warning. */
  repeatThreshold: number
  /** Whether repeated tool detection compares only the tool name (default: name + arguments). */
  repeatByNameOnly: boolean
  /** Send progress cards (warnings are always sent while enabled). */
  progressCards: boolean
  /** Also raise an OS notification for warnings. */
  systemNotification: boolean
  /** Also raise an OS notification for each progress card. */
  notifyProgress: boolean
  /** Track subagent child sessions too (their cards land in the child session). */
  includeSubagents: boolean
}

export const defaults: Readonly<Settings> = Object.freeze({
  enabled: true,
  intervalMinutes: 5,
  silenceMinutes: 10,
  repeatThreshold: 3,
  repeatByNameOnly: false,
  progressCards: true,
  systemNotification: false,
  notifyProgress: false,
  includeSubagents: false,
})

const MINUTE = 60_000

/** Merge user input over defaults and reject invalid values loudly. */
export function resolveSettings(input: Partial<Settings> | undefined): Settings {
  const s: Settings = { ...defaults, ...(input ?? {}) }
  const positive = (key: 'intervalMinutes' | 'silenceMinutes') => {
    const v = s[key]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0.1 || v > 24 * 60) {
      throw new Error(`dsh-heartbeat: ${key} 必须是 0.1 到 1440 之间的分钟数`)
    }
  }
  positive('intervalMinutes')
  positive('silenceMinutes')
  if (!Number.isSafeInteger(s.repeatThreshold) || s.repeatThreshold < 2 || s.repeatThreshold > 1000) {
    throw new Error('dsh-heartbeat: repeatThreshold 必须是 2 到 1000 之间的整数')
  }
  for (const key of ['enabled', 'repeatByNameOnly', 'progressCards', 'systemNotification', 'notifyProgress', 'includeSubagents'] as const) {
    if (typeof s[key] !== 'boolean') throw new Error(`dsh-heartbeat: ${key} 必须是布尔值`)
  }
  return s
}

/** Normalized activity observed from the session log or agent events. */
export type Activity =
  | { kind: 'step' }
  | { kind: 'model' }
  | { kind: 'tool-call'; callId: string; name: string; argsKey: string }
  | { kind: 'tool-result'; callId: string; name: string; isError: boolean; errorKey?: string; errorText?: string }
  | { kind: 'retry'; errorKey: string; errorText: string; attempt: number }
  | { kind: 'error'; errorKey: string; errorText: string }

export type AlertKind = 'progress' | 'silence' | 'repeat-tool' | 'repeat-error' | 'finished'

export interface Alert {
  kind: AlertKind
  /** Card text in Simplified Chinese. */
  text: string
  /** Short single-line form for OS notifications. */
  short: string
}

export interface RunState {
  readonly startedAt: number
  lastActivityAt: number
  lastActivity: string
  toolCalls: number
  toolErrors: number
  retries: number
  /** callId -> { name, startedAt } for tools that have not returned yet. */
  inflight: Map<string, { name: string; startedAt: number }>
  nextProgressAt: number
  /** Time of the last silence warning in the current silence episode, if any. */
  silenceWarnedAt: number | undefined
  toolKey: string | undefined
  toolStreak: number
  errorKey: string | undefined
  errorStreak: number
  ended: boolean
}

export function startRun(now: number, settings: Settings): RunState {
  return {
    startedAt: now,
    lastActivityAt: now,
    lastActivity: '任务开始',
    toolCalls: 0,
    toolErrors: 0,
    retries: 0,
    inflight: new Map(),
    nextProgressAt: now + settings.intervalMinutes * MINUTE,
    silenceWarnedAt: undefined,
    toolKey: undefined,
    toolStreak: 0,
    errorKey: undefined,
    errorStreak: 0,
    ended: false,
  }
}

/** Human duration: 45 秒 / 12 分 3 秒 / 1 小时 5 分. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60
  if (h > 0) return `${h} 小时 ${m} 分`
  if (m > 0) return `${m} 分 ${s} 秒`
  return `${s} 秒`
}

const SECRETISH = /(token|key|password|secret|credential|authorization|cookie)(["']?\s*[:=]\s*)["']?[^\s"',;}&]+/gi

/** One-line, length-capped, credential-scrubbed text for cards. */
export function clip(value: string, limit = 120): string {
  const flat = value
    .replace(SECRETISH, '$1$2[REDACTED]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/\bsk-[\w-]+/g, '[REDACTED]')
    .replace(/(https?:\/\/)[^/@\s]+:[^/@\s]+@/gi, '$1[REDACTED]@')
    .replace(/\s+/g, ' ')
    .trim()
  return flat.length > limit ? `${flat.slice(0, limit - 1)}…` : flat
}

function sameKeyStreak(prevKey: string | undefined, prevStreak: number, key: string): number {
  return prevKey === key ? prevStreak + 1 : 1
}

/** Warn exactly when the streak reaches K, 2K, 3K… so a stuck loop is not spammed. */
function crossesThreshold(streak: number, k: number): boolean {
  return streak >= k && streak % k === 0
}

/**
 * Fold one activity into the run. Returns alerts that must be shown now
 * (repeat warnings); progress/silence alerts come from {@link tick}.
 */
export function recordActivity(state: RunState, activity: Activity, now: number, settings: Settings): Alert[] {
  if (state.ended) return []
  const alerts: Alert[] = []
  state.lastActivityAt = now
  state.silenceWarnedAt = undefined
  switch (activity.kind) {
    case 'step':
      state.lastActivity = '开始新一步（请求模型）'
      break
    case 'model':
      state.lastActivity = '模型返回了一次回复'
      break
    case 'tool-call': {
      state.toolCalls += 1
      state.inflight.set(activity.callId, { name: activity.name, startedAt: now })
      state.lastActivity = `调用工具 ${clip(activity.name, 60)}`
      const key = settings.repeatByNameOnly ? activity.name : `${activity.name}\u0000${activity.argsKey}`
      state.toolStreak = sameKeyStreak(state.toolKey, state.toolStreak, key)
      state.toolKey = key
      if (crossesThreshold(state.toolStreak, settings.repeatThreshold)) {
        const how = settings.repeatByNameOnly ? '' : '（参数完全相同）'
        const text = [
          `⚠️ 心跳警告：同一工具连续调用 ${state.toolStreak} 次${how}`,
          `工具：${clip(activity.name, 60)}`,
          `已运行：${formatDuration(now - state.startedAt)}`,
          '可能在原地打转，建议看一下当前步骤，必要时停止并换个说法。',
        ].join('\n')
        alerts.push({ kind: 'repeat-tool', text, short: `同一工具 ${clip(activity.name, 40)} 连续调用 ${state.toolStreak} 次` })
      }
      break
    }
    case 'tool-result': {
      const started = state.inflight.get(activity.callId)
      state.inflight.delete(activity.callId)
      const took = started ? `，耗时 ${formatDuration(now - started.startedAt)}` : ''
      if (activity.isError) {
        state.toolErrors += 1
        state.lastActivity = `工具 ${clip(activity.name, 60)} 失败${took}`
        alerts.push(...recordError(state, `tool:${activity.name}:${activity.errorKey ?? ''}`, activity.errorText ?? `工具 ${activity.name} 失败`, now, settings))
      } else {
        state.lastActivity = `工具 ${clip(activity.name, 60)} 完成${took}`
        state.errorKey = undefined
        state.errorStreak = 0
      }
      break
    }
    case 'retry':
      state.retries += 1
      state.lastActivity = `模型请求失败，第 ${activity.attempt} 次重试`
      alerts.push(...recordError(state, `retry:${activity.errorKey}`, activity.errorText, now, settings))
      break
    case 'error':
      state.lastActivity = `出错：${clip(activity.errorText, 60)}`
      alerts.push(...recordError(state, `error:${activity.errorKey}`, activity.errorText, now, settings))
      break
  }
  return alerts
}

function recordError(state: RunState, key: string, errorText: string, now: number, settings: Settings): Alert[] {
  state.errorStreak = sameKeyStreak(state.errorKey, state.errorStreak, key)
  state.errorKey = key
  if (!crossesThreshold(state.errorStreak, settings.repeatThreshold)) return []
  const text = [
    `⚠️ 心跳警告：同一错误连续出现 ${state.errorStreak} 次`,
    `错误：${clip(errorText)}`,
    `已运行：${formatDuration(now - state.startedAt)}，模型重试 ${state.retries} 次，工具失败 ${state.toolErrors} 次`,
    '可能在失败重试，建议检查网络、额度或命令本身。',
  ].join('\n')
  return [{ kind: 'repeat-error', text, short: `同一错误连续 ${state.errorStreak} 次：${clip(errorText, 60)}` }]
}

function inflightLine(state: RunState, now: number): string | undefined {
  let oldest: { name: string; startedAt: number } | undefined
  for (const v of state.inflight.values()) if (!oldest || v.startedAt < oldest.startedAt) oldest = v
  return oldest ? `正在执行：${clip(oldest.name, 60)}（已 ${formatDuration(now - oldest.startedAt)}）` : undefined
}

export function renderProgress(state: RunState, now: number): Alert {
  const lines = [
    `💓 任务心跳 · 已运行 ${formatDuration(now - state.startedAt)}`,
    `工具调用：${state.toolCalls} 次（失败 ${state.toolErrors} 次）${state.retries ? `，模型重试 ${state.retries} 次` : ''}`,
    `最近活动：${state.lastActivity}（${formatDuration(now - state.lastActivityAt)}前）`,
  ]
  const running = inflightLine(state, now)
  if (running) lines.push(running)
  return { kind: 'progress', text: lines.join('\n'), short: `已运行 ${formatDuration(now - state.startedAt)}，工具 ${state.toolCalls} 次` }
}

/**
 * Advance the fake or real clock. Emits at most one progress card per call
 * (missed intervals are skipped, not replayed) and one silence warning per
 * silence period of M minutes.
 */
export function tick(state: RunState, now: number, settings: Settings): Alert[] {
  if (state.ended) return []
  const alerts: Alert[] = []
  const interval = settings.intervalMinutes * MINUTE
  if (now >= state.nextProgressAt) {
    if (settings.progressCards) alerts.push(renderProgress(state, now))
    const missed = Math.floor((now - state.nextProgressAt) / interval)
    state.nextProgressAt += (missed + 1) * interval
  }
  const silence = settings.silenceMinutes * MINUTE
  const quietFor = now - state.lastActivityAt
  const since = state.silenceWarnedAt ?? state.lastActivityAt
  if (quietFor >= silence && now - since >= silence) {
    state.silenceWarnedAt = now
    const lines = [
      `⚠️ 心跳警告：已经 ${formatDuration(quietFor)} 没有任何新活动`,
      `最近活动：${state.lastActivity}`,
      `总运行：${formatDuration(now - state.startedAt)}，工具调用 ${state.toolCalls} 次`,
    ]
    const running = inflightLine(state, now)
    lines.push(running ? `${running}，可能是命令卡住或在等待输入。` : '可能卡在模型请求或网络上。')
    alerts.push({ kind: 'silence', text: lines.join('\n'), short: `${formatDuration(quietFor)} 没有新活动` })
  }
  return alerts
}

/** Stop the run; afterwards tick/recordActivity are no-ops. */
export function endRun(state: RunState, now: number): Alert {
  state.ended = true
  state.inflight.clear()
  return {
    kind: 'finished',
    text: `✅ 本轮结束 · 总用时 ${formatDuration(now - state.startedAt)}，工具调用 ${state.toolCalls} 次（失败 ${state.toolErrors} 次）`,
    short: `本轮结束，用时 ${formatDuration(now - state.startedAt)}`,
  }
}

/** Stable key for "same arguments": raw JSON text, whitespace-insensitive, capped. */
export function argumentsKey(raw: string): string {
  let value: unknown = raw
  try { value = JSON.parse(raw) } catch { /* keep the raw string */ }
  const stable = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(stable)
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, stable((v as Record<string, unknown>)[k])]))
    return v
  }
  return JSON.stringify(stable(value)).slice(0, 4000)
}
