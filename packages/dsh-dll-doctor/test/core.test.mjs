import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { analyze, resolveDLL, render, systemDirectory, suggestions } from '../lib/core.js'
import { fixture } from '../scripts/fixture.mjs'
const known = { names: new Set(), source: 'registry' }
async function environment(fn) {
  const base = await mkdtemp(path.join(tmpdir(), 'dsh-dll-'))
  const dirs = ['application', 'system32', 'sysWOW64', 'system16', 'windows', 'current', 'path1', 'path2', 'sysnative']
  const roots = Object.fromEntries(dirs.map(n => [n, path.join(base, n)]))
  for (const directory of Object.values(roots)) await mkdir(directory)
  roots.path = [roots.path1, roots.path2]; roots.os64 = true; roots.node32 = false
  const write = async (dir, name, options = {}) => { const f = path.join(roots[dir], name); await writeFile(f, fixture(options)); return f }
  const options = { platform: 'win32', cwd: roots.current, roots, known }
  try { await fn({ roots, write, options }) } finally { await rm(base, { recursive: true, force: true }) }
}
test('full SafeDllSearchMode order with removal of each winner', () => environment(async ({ roots, write }) => {
  const order = [['application', '应用目录'], ['system32', 'System32'], ['system16', '16 位系统目录'], ['windows', 'Windows 目录'], ['current', '当前目录'], ['path1', 'PATH'], ['path2', 'PATH']]
  for (const [dir] of order) await write(dir, 'a.dll')
  for (const [dir, source] of order) {
    const resolved = await resolveDLL('a.dll', 'x64', roots, known)
    assert.equal(resolved.source, source); assert.equal(resolved.file, path.join(roots[dir], 'a.dll'))
    await rm(resolved.file)
  }
  assert.equal((await resolveDLL('a.dll', 'x64', roots, known)).file, undefined)
}))
test('KnownDLLs precede application; missing KnownDLL never falls back to app', () => environment(async ({ roots, write }) => {
  await write('application', 'kernel32.dll'); await write('system32', 'kernel32.dll')
  const list = { names: new Set(['kernel32.dll']), source: 'registry' }
  const row = await resolveDLL('kernel32.dll', 'x64', roots, list)
  assert.match(row.source, /KnownDLLs/); assert.equal(row.file, path.join(roots.system32, 'kernel32.dll'))
  await rm(row.file)
  assert.equal((await resolveDLL('kernel32.dll', 'x64', roots, list)).file, undefined)
}))
test('x86 on 64-bit OS selects SysWOW64 even from a 64-bit Node process', () => environment(async ({ roots, write }) => {
  await write('system32', 'a.dll'); await write('sysWOW64', 'a.dll', { architecture: 'x86' })
  assert.equal((await resolveDLL('a.dll', 'x86', roots, known)).source, 'SysWOW64')
  roots.node32 = true
  assert.equal(systemDirectory('x64', roots).directory, roots.sysnative)
  roots.os64 = false
  assert.equal(systemDirectory('x86', roots).directory, roots.system32)
}))
test('API set and ext-ms contracts are informational, do not probe paths', () => environment(async ({ roots }) => {
  for (const name of ['api-ms-win-core-file-l1-1-0.dll', 'ext-ms-win-foo.dll', 'API-MS-WIN-FOO.DLL']) {
    const result = await resolveDLL(name, 'x64', { ...roots, application: '\\\\bad\\share' }, known)
    assert.equal(result.source, 'API set schema'); assert.equal(result.file, undefined); assert.ok(result.note)
  }
}))
for (const [targetArch, dependencyArch] of [['x64', 'x86'], ['x86', 'x64'], ['ARM64', 'x64']]) test(`architecture mismatch ${targetArch} -> ${dependencyArch}`, () => environment(async ({ write, options }) => {
  const file = await write('application', 'app.exe', { architecture: targetArch, imports: ['a.dll'] })
  await write('application', 'a.dll', { architecture: dependencyArch })
  const result = await analyze(file, options)
  assert.equal(result.architecture, targetArch); assert.equal(result.dependencies[0].status, 'mismatch')
  assert.equal(result.dependencies[0].architecture, dependencyArch); assert.match(render(result), /架构不匹配/)
}))
test('missing, api set, delay missing, unreadable DLL and suggestions preserved', () => environment(async ({ roots, write, options }) => {
  const file = await write('application', 'app.exe', { imports: ['VCRUNTIME140.dll', 'MSVCP140.dll', 'd3dx9_43.dll', 'xinput1_3.dll', 'mscoree.dll', 'other.dll', 'broken.dll', 'api-ms-win-foo.dll', 'ext-ms-foo.dll'], delay: ['optional.dll'] })
  await writeFile(path.join(roots.application, 'broken.dll'), 'not PE')
  const result = await analyze(file, options)
  assert.equal(result.dependencies.filter(r => r.status === 'missing').length, 7)
  assert.equal(result.dependencies.filter(r => r.status === 'api-set').length, 2)
  assert.equal(result.dependencies.find(r => r.name === 'broken.dll').status, 'unreadable')
  assert.ok(result.dependencies.at(-1).delay)
  assert.match(result.suggestions.join('\n'), /Visual C\+\+ 2015-2022/)
  assert.match(result.suggestions.join('\n'), /DirectX/); assert.match(result.suggestions.join('\n'), /\.NET/)
  assert.match(render(result), /延迟/)
}))
test('depth 1 default, depth 2/3 recursion, cycles visited once, original app root retained', () => environment(async ({ write, options }) => {
  const file = await write('application', 'app.exe', { imports: ['a.dll'] })
  await write('application', 'a.dll', { imports: ['b.dll'] })
  await write('system32', 'b.dll', { imports: ['a.dll', 'c.dll'] })
  await write('application', 'c.dll')
  assert.equal((await analyze(file, options)).dependencies.length, 1)
  assert.deepEqual((await analyze(file, { ...options, depth: 2 })).dependencies.map(r => r.name), ['a.dll', 'b.dll'])
  const r = await analyze(file, { ...options, depth: 3 })
  assert.deepEqual(r.dependencies.map(r => r.name), ['a.dll', 'b.dll', 'a.dll', 'c.dll'])
  assert.equal(r.dependencies.at(-1).source, '应用目录'); assert.equal(r.dependencies.at(-1).depth, 3)
  const limited = await analyze(file, { ...options, depth: 3, maxDependencies: 2 })
  assert.equal(limited.dependencies.length, 2); assert.equal(limited.limited, true); assert.match(render(limited), /上限/)
}))
test('depth and total limits reject invalid values before reading', async () => {
  for (const depth of [0, 4, NaN, 1.5]) await assert.rejects(analyze('a.exe', { cwd: process.cwd(), platform: 'win32', depth }), /depth/)
  for (const maxDependencies of [0, 513, 1.5]) await assert.rejects(analyze('a.exe', { cwd: process.cwd(), platform: 'win32', maxDependencies }), /上限/)
})
test('non-Windows refuses without launching subprocess or reading target', async () => {
  let called = false
  await assert.rejects(analyze('NUL', { platform: 'linux', cwd: '', run: async () => { called = true; throw Error() } }), /暂不支持（仅 Windows）/)
  assert.equal(called, false)
})
test('cancelled analysis never starts subprocess; cancelled KnownDLL read propagates', () => environment(async ({ write, options }) => {
  const file = await write('application', 'app.exe')
  await assert.rejects(analyze(file, { ...options, signal: AbortSignal.abort() }))
  const c = new AbortController()
  await assert.rejects(analyze(file, { ...options, known: undefined, signal: c.signal, run: async () => { c.abort(); throw Error() } }))
}))
test('KnownDLL fallback is reported and optional backend disabled by default', () => environment(async ({ write, options }) => {
  const file = await write('application', 'app.exe', { imports: ['kernel32.dll'] })
  await write('application', 'kernel32.dll'); await write('system32', 'kernel32.dll')
  let calls = 0
  const report = await analyze(file, { ...options, known: undefined, run: async argv => { calls++; assert.equal(argv[1], 'query'); throw Error() } })
  assert.equal(calls, 1); assert.equal(report.knownSource, 'fallback'); assert.match(report.warnings[0], /内置/)
  assert.match(report.dependencies[0].source, /KnownDLLs/)
  assert.equal(report.supplement, undefined)
}))
test('CLR limitation suggestion', () => assert.match(suggestions([], true).join(), /AnyCPU/))

test('optional backend supplements core results; malformed backend preserves missing results', () => environment(async ({ roots, write, options }) => {
  const file = await write('application', 'app.exe', { imports: ['missing.dll'] })
  const exe = path.join(roots.current, 'Dependencies.exe'); await writeFile(exe, 'not executed')
  const good = await analyze(file, { ...options, dependenciesExe: exe, run: async argv => { assert.deepEqual(argv, [exe, '-json', '-imports', file]); return '{"Imports":[{"Name":"extra.dll"}]}' } })
  assert.deepEqual(good.supplement, ['extra.dll']); assert.equal(good.dependencies[0].status, 'missing'); assert.match(render(good), /extra.dll/)
  const bad = await analyze(file, { ...options, dependenciesExe: exe, run: async () => 'not JSON' })
  assert.equal(bad.dependencies[0].status, 'missing'); assert.equal(bad.supplement, undefined); assert.match(bad.warnings.join(), /补充失败/)
}))

test('never runs selected Dependencies.exe or its hardlink as the optional helper', () => environment(async ({ roots, write, options }) => {
  const file = await write('application', 'Dependencies.exe')
  const { link } = await import('node:fs/promises')
  const alias = path.join(roots.current, 'Dependencies.exe'); await link(file, alias)
  for (const executable of [file, alias]) {
    let calls = 0
    const result = await analyze(file, { ...options, dependenciesExe: executable, run: async () => { calls++; return '{"Imports":[]}' } })
    assert.equal(calls, 0); assert.match(result.warnings.join(), /补充失败/)
  }
}))
test('analyzing the registry helper falls back without executing the target', () => environment(async ({ roots, options }) => {
  const directory = path.join(roots.windows, 'System32'); await mkdir(directory)
  const file = path.join(directory, 'reg.exe'); await writeFile(file, fixture())
  let calls = 0
  const result = await analyze(file, { ...options, known: undefined, run: async () => { calls++; throw Error() } })
  assert.equal(calls, 0); assert.equal(result.knownSource, 'fallback')
}))
