import type { Schedule } from './types.js'
/** Latest due slot; callers inject now and commit lastRun only after success. */
export function dueSlot(schedule: Schedule | undefined, lastRun: number | undefined, now: number): number | undefined {
  if (!schedule) return undefined
  if (lastRun !== undefined && now <= lastRun) return undefined
  if (schedule.kind === 'every') {
    const period = schedule.hours * 3_600_000
    if (lastRun === undefined) return now
    return now - lastRun >= period ? now : undefined
  }
  const [hour, minute] = schedule.time.split(':').map(Number)
  const slot = new Date(now)
  slot.setHours(hour, minute, 0, 0)
  if (slot.getTime() > now) slot.setDate(slot.getDate() - 1)
  return lastRun === undefined || slot.getTime() > lastRun ? slot.getTime() : undefined
}

