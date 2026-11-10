/** rc.5 official bash foreground canonical DTO only; output text is untrusted. */
export function bashFailure(name: string, value: unknown): string | undefined {
  if (name !== 'bash' || !value || typeof value !== 'object' || Array.isArray(value)) return
  const v = value as Record<string, unknown>
  if (v.kind !== 'foreground' || typeof v.cwd !== 'string'
    || !(v.exitCode === null || typeof v.exitCode === 'number' && Number.isInteger(v.exitCode))
    || typeof v.timedOut !== 'boolean' || typeof v.aborted !== 'boolean') return
  const s = v.sandbox as Record<string, unknown> | undefined
  if (s?.runnerFailed === true) return 'bash runner failed'
  if (s?.denied === true) return 'bash sandbox denied'
  if (v.timedOut) return 'bash timed out'
  if (v.aborted) return 'bash aborted'
  if (typeof v.signal === 'string' && v.signal) return 'bash signalled'
  if (typeof v.exitCode === 'number' && v.exitCode !== 0) return 'bash exitCode=' + v.exitCode
}
