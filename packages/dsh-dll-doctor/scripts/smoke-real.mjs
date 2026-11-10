// Core-only Windows smoke check. Does not execute any target or generated PE.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { analyze, render } from '../lib/core.js'
import { fixture } from './fixture.mjs'
const exec = promisify(execFile)
if (process.platform !== 'win32') {
  console.error('暂不支持（仅 Windows）。'); process.exitCode = 1
} else {
  const run = async (argv, signal) => (await exec(argv[0], argv.slice(1), {
    cwd: process.cwd(), encoding: 'utf8', timeout: 5000, maxBuffer: 256 * 1024, windowsHide: true, signal,
  })).stdout
  let failed = false
  try {
    const report = await analyze('C:\\Windows\\System32\\notepad.exe', { cwd: process.cwd(), run })
    console.log(render(report))
    assert.ok(report.dependencies.length > 0, 'notepad must expose direct dependencies')
    assert.ok(report.dependencies.every(r => ['found', 'api-set'].includes(r.status)), 'all direct dependencies must resolve or be API sets')
    console.log(`PASS notepad: ${report.architecture}, ${report.dependencies.length} direct import records; KnownDLLs=${report.knownSource}`)
  } catch (error) {
    failed = true
    // Do not print arbitrary filesystem/provider exception text.
    console.error('FAIL notepad: target/registry access or dependency assertion failed; rerun outside sandbox to investigate.')
  }
  const directory = await mkdtemp(path.join(tmpdir(), 'dsh-dll-smoke-'))
  try {
    const missing = path.join(directory, 'missing.exe')
    await writeFile(missing, fixture({ imports: ['dsh-missing-test.dll'] }))
    const m = await analyze(missing, { cwd: directory, run })
    assert.equal(m.dependencies[0].status, 'missing')
    console.log('PASS synthetic x64 missing import: dsh-missing-test.dll')
    const mismatch = path.join(directory, 'mismatch.exe')
    await writeFile(mismatch, fixture({ imports: ['dsh-x86-test.dll'] }))
    await writeFile(path.join(directory, 'dsh-x86-test.dll'), fixture({ architecture: 'x86' }))
    const x = await analyze(mismatch, { cwd: directory, run })
    assert.equal(x.dependencies[0].status, 'mismatch'); assert.equal(x.dependencies[0].architecture, 'x86')
    console.log('PASS synthetic x64 -> application x86 DLL mismatch')
  } finally {
    await rm(directory, { recursive: true, force: true })
    console.log('Temporary synthetic files removed.')
  }
  if (failed) process.exitCode = 1
}
