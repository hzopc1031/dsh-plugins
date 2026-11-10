import test from 'node:test'
import assert from 'node:assert/strict'
import { runBounded, parseKnownDLLs, knownDLLs, parseDependencies, supplement, OUTPUT_LIMIT } from '../lib/process.js'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
function service({ text = 'ok', stderr = '', code = 0, hang = false, lossy = false, reject = false } = {}) {
  let spec, kills = 0
  const reader = value => ({ readFrom: () => ({ text: value, nextOffset: Buffer.byteLength(value), lossy }) })
  return {
    spawn(value) {
      spec = value
      return { collected: { stdout: reader(text), stderr: reader(stderr) }, done: hang ? new Promise(() => {}) : reject ? Promise.reject(Error('failed')) : Promise.resolve({ exitCode: code, signal: null }), terminate() { kills++ } }
    },
    get spec() { return spec }, get kills() { return kills },
  }
}
test('subprocess uses fixed argv, explicit bounded collection, no spill and abort signal', async () => {
  const s = service(), argv = ['C:\\Windows\\System32\\reg.exe', 'query', 'fixed key']
  assert.equal(await runBounded(s, argv, process.cwd()), 'ok')
  assert.deepEqual(s.spec.argv, argv); assert.equal(s.spec.cwd, process.cwd())
  assert.deepEqual(s.spec.stdio, { stdin: 'ignore', stdout: { maxBytes: OUTPUT_LIMIT }, stderr: { maxBytes: OUTPUT_LIMIT } })
  assert.ok(s.spec.signal instanceof AbortSignal); assert.ok(s.kills)
})
test('subprocess timeout terminates and settles even when provider hangs', async () => {
  const s = service({ hang: true }); await assert.rejects(runBounded(s, ['fixed'], '.', undefined, 20), /超时/); assert.ok(s.kills)
})
test('subprocess cancellation before spawn and during execution', async () => {
  const before = service(); await assert.rejects(runBounded(before, ['fixed'], '.', AbortSignal.abort())); assert.equal(before.spec, undefined)
  const during = service({ hang: true }), c = new AbortController()
  const pending = runBounded(during, ['fixed'], '.', c.signal); c.abort()
  await assert.rejects(pending, /取消/); assert.ok(during.kills)
})
for (const options of [{ text: 'a'.repeat(101) }, { stderr: 'a'.repeat(101) }, { lossy: true }, { hang: true, text: 'a'.repeat(101) }]) test(`output limit ${JSON.stringify(options).slice(0, 70)}`, async () => {
  const s = service(options); await assert.rejects(runBounded(s, ['fixed'], '.', undefined, 500, 100), /上限/); assert.ok(s.kills)
})
test('spawn error, process failure and rejected done are contained', async () => {
  await assert.rejects(runBounded({ spawn() { throw Error('spawn') } }, ['fixed'], '.'), /spawn/)
  await assert.rejects(runBounded(service({ code: 1 }), ['fixed'], '.'), /失败/)
  await assert.rejects(runBounded(service({ reject: true }), ['fixed'], '.'), /failed/)
})
test('KnownDLLs reg.exe output parsed case insensitively; non-DLL values ignored', () => {
  const result = parseKnownDLLs('HKEY_LOCAL_MACHINE\\key\r\n    DllDirectory    REG_SZ    C:\\Windows\\system32\r\n    kernel32    REG_SZ    KERNEL32.dll\r\n    user32    REG_EXPAND_SZ    user32.dll\r\n    bad REG_SZ ..\\evil.dll\r\n')
  assert.deepEqual([...result], ['kernel32.dll', 'user32.dll'])
})
for (const text of ['', 'garbage', '    a REG_BINARY 112233', 'x'.repeat(OUTPUT_LIMIT + 1)]) test(`invalid KnownDLL output (${text.length} bytes)`, () => assert.throws(() => parseKnownDLLs(text)))
test('KnownDLL registry success and malformed/empty/error fallback', async () => {
  const run = async argv => { assert.match(argv[0], /reg\.exe$/); assert.deepEqual(argv.slice(1), ['query', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\KnownDLLs']); return '    kernel32 REG_SZ kernel32.dll' }
  assert.equal((await knownDLLs(run, 'C:\\Windows')).source, 'registry')
  for (const run of [async () => '', async () => 'bad', async () => { throw Error() }]) {
    const r = await knownDLLs(run, 'C:\\Windows'); assert.equal(r.source, 'fallback'); assert.ok(r.names.has('kernel32.dll'))
  }
})
test('Dependencies official Imports envelope normal and empty', () => {
  assert.deepEqual(parseDependencies(JSON.stringify({ Imports: [{ Name: 'a.dll', ImportList: [] }, { Name: 'b.dll' }] })), ['a.dll', 'b.dll'])
  assert.deepEqual(parseDependencies('{"Imports":[]}'), [])
})
for (const text of ['', '{}', 'null', '[]', '{"Imports":[{}]}', '{"Imports":[{"Name":"../bad.dll"}]}', 'x'.repeat(OUTPUT_LIMIT + 1)]) test(`invalid Dependencies output (${text.length} bytes)`, () => assert.throws(() => parseDependencies(text)))
test('configured Dependencies uses verified local CLI path and fixed flags', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-deps-'))
  try {
    const exe = path.join(dir, 'Dependencies.exe'); await writeFile(exe, 'synthetic placeholder: never executed')
    let called = false
    const result = await supplement(async argv => { called = true; assert.deepEqual(argv, [exe, '-json', '-imports', 'C:\\app.exe']); return '{"Imports":[{"Name":"a.dll"}]}' }, exe, 'C:\\app.exe')
    assert.ok(called); assert.deepEqual(result, ['a.dll'])
    for (const invalid of ['Dependencies.exe', '\\\\server\\Dependencies.exe', path.join(dir, 'other.exe')]) await assert.rejects(supplement(async () => { throw Error('must not run') }, invalid, 'a.exe'))
  } finally { await rm(dir, { recursive: true, force: true }) }
})
