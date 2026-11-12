import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import * as plugin from '../index.js'
import { parseInput } from '../lib/plugin.js'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fixture } from '../scripts/fixture.mjs'

test('human argument grammar retains spaces/backslashes and caps depth', () => {
  assert.deepEqual(parseInput(' "C:\\app folder\\a.exe" --depth 3 '), { file: 'C:\\app folder\\a.exe', depth: 3 })
  assert.deepEqual(parseInput(' ./a.dll'), { file: './a.dll', depth: 1 })
  for (const input of ['', 'a.exe --depth 0', 'a.exe --depth 4', 'a.exe --depth 1 extra', '""', 'a.exe --wat', 'x'.repeat(4097)]) assert.throws(() => parseInput(input))
})
test('actual Cordis loads rc.5 registration, uses workingDirectory, cancellation, disposes; no model services', async () => {
  assert.deepEqual(plugin.inject, ['commands', 'workingDirectory', 'subprocess'])
  const ctx = new Context(), definitions = []
  let removed = false, directoryCalls = 0, processCalls = 0
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-command-'))
  await writeFile(path.join(dir, 'a.exe'), fixture({ imports: ['dsh-missing-test.dll'] }))
  ctx.provide('commands'); ctx.set('commands', { register(row) { definitions.push(row); return () => { removed = true } } })
  const session = {}
  ctx.provide('workingDirectory'); ctx.set('workingDirectory', { get(s) { assert.equal(s, session); directoryCalls++; return dir } })
  ctx.provide('subprocess'); ctx.set('subprocess', { spawn() { processCalls++; throw Error('registry unavailable in fixture') } })
  const fiber = ctx.plugin(plugin)
  const original = Object.getOwnPropertyDescriptor(process, 'platform')
  const systemRoot = process.env.SystemRoot
  try {
    await fiber
    assert.equal(definitions.length, 1)
    const row = definitions[0]
    assert.equal(row.name, 'dll-check'); assert.equal(row.recordInput, false); assert.equal(typeof row.definitionId, 'string')
    const invoke = rawInput => row.handler({ rawInput, agent: { session }, signal: new AbortController().signal })
    Object.defineProperty(process, 'platform', { value: 'linux' })
    assert.match((await invoke('a.exe')).text, /暂不支持（仅 Windows）/); assert.equal(processCalls, 0); assert.equal(directoryCalls, 0)
    Object.defineProperty(process, 'platform', { value: 'win32' })
    process.env.SystemRoot = dir // The simulated Windows search root must exist on the test OS.
    assert.equal((await invoke('')).kind, 'error')
    const result = await invoke('a.exe')
    assert.equal(result.kind, 'success'); assert.match(result.text, /dsh-missing-test.dll：缺失/)
    assert.equal(directoryCalls, 1); assert.equal(processCalls, 1)
    assert.equal((await invoke('absent.exe')).kind, 'error')
    const cancelled = await row.handler({ rawInput: 'a.exe', agent: { session }, signal: AbortSignal.abort() })
    assert.match(cancelled.text, /取消/)
  } finally {
    Object.defineProperty(process, 'platform', original)
    if (systemRoot === undefined) delete process.env.SystemRoot
    else process.env.SystemRoot = systemRoot
    await fiber.dispose(); await rm(dir, { recursive: true, force: true })
  }
  assert.equal(removed, true)
})
