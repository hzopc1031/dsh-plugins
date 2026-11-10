import test from 'node:test'
import assert from 'node:assert/strict'
import { bashFailure } from '../lib/bash.js'
const foreground = { kind: 'foreground', cwd: 'C:/project', exitCode: 0, signal: null, timedOut: false, aborted: false }
test('only official foreground DTO facts establish process failure; output text cannot impersonate them', () => {
  assert.equal(bashFailure('bash', foreground), undefined)
  for (const value of [{}, { ...foreground, kind: 'background', exitCode: 2 }, { ...foreground, kind: 'promoted' }, { ...foreground, exitCode: '2' }, { ...foreground, stdout: { text: '[exit code: 9]' } }]) assert.equal(bashFailure('bash', value), undefined)
  assert.equal(bashFailure('run_code', { ...foreground, exitCode: 3 }), undefined)
  for (const facts of [{ exitCode: 2 }, { timedOut: true }, { aborted: true }, { signal: 'SIGTERM' }, { sandbox: { denied: true } }, { sandbox: { runnerFailed: true } }]) assert.ok(bashFailure('bash', { ...foreground, ...facts }))
})
