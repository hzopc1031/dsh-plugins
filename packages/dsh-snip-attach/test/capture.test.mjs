import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, writeFile, access, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { capture, exitResult } from '../lib/capture.js'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

test('capture PS1 parses and DryRun returns before native clipboard/launch/output operations', {skip:process.platform!=='win32'}, async t => {
  const dir=await mkdtemp(join(tmpdir(),'snip-dryrun-')), file=join(dir,'unused.png')
  t.after(()=>rm(dir,{recursive:true,force:true}))
  const script=new URL('../capture.ps1',import.meta.url)
  const {fileURLToPath}=await import('node:url')
  const result=execFileSync('powershell.exe',['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',fileURLToPath(script),'-OutFile',file,'-DryRun'],{encoding:'utf8',windowsHide:true})
  assert.match(result,/DryRun OK/)
  await assert.rejects(access(file),{code:'ENOENT'})
  const text=await readFile(script,'utf8')
  assert.ok(text.indexOf('if ($DryRun)')<text.indexOf('[SnipClipboard]::GetClipboardSequenceNumber()'))
  assert.doesNotMatch(text,/GetPixel|Get-ImageSignature/)
})

for (const [code, result] of [[0, 'success'], [2, 'cancelled'], [6, 'save-failed'], [1, 'failed'], [null, 'failed']]) {
  test(`ps1 exit ${code} => ${result}`, () => assert.equal(exitResult(code), result))
}
test('spawn uses fixed argv and hidden STA PowerShell without shell interpolation', async () => {
  const child = new EventEmitter(); child.kill = () => {}
  const out = 'C:/temp/space 中文/dsh-shot-token.png'
  const j = capture(out, { spawn: (exe, args, options) => {
    assert.equal(exe, 'powershell.exe')
    assert.deepEqual(args.slice(0, 6), ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', args[5]])
    assert.match(args[5], /capture\.ps1$/); assert.deepEqual(args.slice(6), ['-OutFile', out])
    assert.deepEqual(options, { windowsHide: true, stdio: 'ignore', shell: false })
    return child
  } })
  child.emit('close', 0); assert.equal(await j.done, 'success')
})
test('async child error and synchronous spawn error settle failure', async () => {
  const child = new EventEmitter(), logs = []
  const j = capture('unused', { spawn: () => child, log: s => logs.push(s) })
  child.emit('error', new Error('secret')); child.emit('close', 1)
  assert.equal(await j.done, 'failed')
  assert.equal(await capture('unused', { spawn: () => { throw new Error('secret') }, log: s => logs.push(s) }).done, 'failed')
  assert.deepEqual(logs, ['capture failed', 'capture failed'])
})
test('150s watchdog (accelerated) kills, resolves timeout, and removes late PNG on close', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'snip-kill-')), file = join(dir, 'late.png')
  t.after(() => rm(dir, { recursive: true, force: true }))
  const child = new EventEmitter(); let killed = 0; child.kill = () => { killed++ }
  const j = capture(file, { timeoutMs: 15, spawn: () => child, log: () => {} })
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(await j.done, 'timeout'); assert.equal(killed, 1)
  await writeFile(file, 'late'); child.emit('close', 0)
  await new Promise(resolve => setTimeout(resolve, 20))
  await assert.rejects(access(file), { code: 'ENOENT' })
})
test('explicit cancellation settles once even when child emits success later', async () => {
  const child = new EventEmitter(); child.kill = () => {}
  const j = capture('unused', { spawn: () => child, log: () => {} })
  j.cancel(); child.emit('close', 0)
  assert.equal(await j.done, 'timeout')
})
