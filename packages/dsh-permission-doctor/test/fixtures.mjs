export function fixture({ policy = 'ask', code = '', outcome, name = 'write', args = { path: 'C:\\project\\out.txt' }, content = 'Error: blocked', isError = true, prefix = true } = {}) {
  const events = []
  const add = (type, data) => { const seq = events.length; events.push({ seq, time: 1000 + seq, type, data }); return seq }
  if (prefix) {
    add('permission/preset', { preset: 'workspace-write' })
    add('sandbox/mode', { mode: 'workspace-write' })
    if (policy !== null) add('approval/policy', { policy })
  }
  add('tool/call', { callId: 'call-a', name, arguments: JSON.stringify(args), turn: 1, step: 1 })
  if (outcome !== undefined) {
    add('approval/asked', { id: 'req-a', toolName: name, callId: 'call-a', reason: 'sensitive action' })
    if (outcome !== null) add('approval/decided', { id: 'req-a', outcome })
  }
  const resultSeq = add('tool/result', { message: { toolCallId: 'call-a', isError, content: [{ type: 'text', text: content }] },
    ...(code ? { error: { name: code === 'FS_SANDBOX_DENIED' ? 'FsError' : 'HarnessError', code } } : {}) })
  return { events, add, resultSeq }
}
export function liveBash(resultSeq, changes = {}) {
  return { callId: 'call-a', name: 'bash', anchor: resultSeq, time: 1000, bash: {
    mode: 'workspace-write', denied: false, runnerFailed: false, exitCode: 1, timedOut: false, aborted: false, ...changes,
  } }
}
