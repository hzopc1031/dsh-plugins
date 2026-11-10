/**
 * Clock-injected run tracker shared by the plugin and the tests. It owns no
 * timers and no DSH objects: the caller feeds status changes, log events and
 * ticks, and receives alerts through `deliver`.
 */
import { endRun, recordActivity, renderProgress, startRun, tick, type Alert, type RunState, type Settings } from './core.js'
import { activityOf, type LogEvent } from './events.js'

export interface ControllerDeps {
  readonly settings: Settings
  readonly now: () => number
  /** Show an alert for one tracked session. */
  readonly deliver: (sessionId: string, alert: Alert) => void
}

interface Tracked {
  state: RunState
  names: Map<string, string>
  progressSent: number
}

export class HeartbeatController {
  private readonly runs = new Map<string, Tracked>()
  constructor(private readonly deps: ControllerDeps) {}

  /** Whether any run is active (the plugin only keeps a timer while true). */
  get active(): boolean { return this.runs.size > 0 }

  isTracking(sessionId: string): boolean { return this.runs.has(sessionId) }

  /** `running` starts a run (idempotent); `idle` ends it. */
  status(sessionId: string, status: 'running' | 'idle'): void {
    const { settings, now } = this.deps
    if (!settings.enabled) return
    if (status === 'running') {
      if (!this.runs.has(sessionId)) this.runs.set(sessionId, { state: startRun(now(), settings), names: new Map(), progressSent: 0 })
      return
    }
    const run = this.runs.get(sessionId)
    if (!run) return
    this.runs.delete(sessionId)
    const finished = endRun(run.state, now())
    // Only long runs that already showed a heartbeat get a closing card.
    if (settings.progressCards && run.progressSent > 0) this.deps.deliver(sessionId, finished)
  }

  /** Feed one appended session-log event. */
  event(sessionId: string, event: LogEvent): void {
    const run = this.runs.get(sessionId)
    if (!run) return
    const activity = activityOf(event, run.names)
    if (!activity) return
    for (const alert of recordActivity(run.state, activity, this.deps.now(), this.deps.settings)) this.deps.deliver(sessionId, alert)
  }

  /** Advance every active run to the current clock. */
  tick(): void {
    const now = this.deps.now()
    for (const [id, run] of this.runs) {
      for (const alert of tick(run.state, now, this.deps.settings)) {
        if (alert.kind === 'progress') run.progressSent += 1
        this.deps.deliver(id, alert)
      }
    }
  }

  /** On-demand card for `/heartbeat`; undefined when the session is not running. */
  snapshot(sessionId: string): Alert | undefined {
    const run = this.runs.get(sessionId)
    return run ? renderProgress(run.state, this.deps.now()) : undefined
  }

  /** Drop everything (plugin disposal); no closing cards. */
  clear(): void {
    for (const run of this.runs.values()) run.state.ended = true
    this.runs.clear()
  }
}
