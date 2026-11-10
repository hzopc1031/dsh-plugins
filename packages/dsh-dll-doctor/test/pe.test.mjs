import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../scripts/fixture.mjs'
import { parsePE, readPE, safeLocalPath, targetPath } from '../lib/pe.js'
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

for (const architecture of ['x86', 'x64', 'ARM64']) test(`PE ${architecture}: imports, delayed imports, CLR`, () => {
  const result = parsePE(fixture({ architecture, imports: ['KERNEL32.dll', 'odd-name.dll'], delay: ['USER32.dll'], managed: true }))
  assert.equal(result.architecture, architecture)
  assert.equal(result.format, architecture === 'x86' ? 'PE32' : 'PE32+')
  assert.equal(result.managed, true)
  assert.deepEqual(result.imports, [{ name: 'KERNEL32.dll', delay: false }, { name: 'odd-name.dll', delay: false }, { name: 'USER32.dll', delay: true }])
})
test('PE32 legacy delay VA converts relative to image base', () => {
  assert.deepEqual(parsePE(fixture({ architecture: 'x86', delay: ['legacy.dll'], legacyDelay: true })).imports, [{ name: 'legacy.dll', delay: true }])
})
test('PE with no import directories', () => assert.deepEqual(parsePE(fixture()).imports, []))
test('every truncated prefix fails with a controlled Error', () => {
  const b = fixture({ imports: ['a.dll'], delay: ['b.dll'] })
  for (let i = 0; i < b.length; i++) assert.throws(() => parsePE(b.subarray(0, i)), /PE 格式无效/)
})
for (const [name, mutate] of [
  ['DOS signature', b => b.writeUInt16LE(0, 0)], ['PE signature', b => b.writeUInt32LE(0, 0x80)],
  ['negative/outside PE pointer', b => b.writeUInt32LE(0xffffffff, 0x3c)], ['unknown machine', b => b.writeUInt16LE(1, 0x84)],
  ['format mismatch', b => b.writeUInt16LE(0x10b, 0x98)], ['too many sections', b => b.writeUInt16LE(97, 0x86)],
  ['optional header short', b => b.writeUInt16LE(8, 0x94)], ['directory count', b => b.writeUInt32LE(17, 0x98 + 108)],
  ['raw section outside file', b => b.writeUInt32LE(0xfffffff0, 0x98 + 240 + 20)],
  ['RVA unmapped', b => b.writeUInt32LE(0x80000000, 512 + 12)],
  ['directory crosses section', b => b.writeUInt32LE(0xffffff00, 0x98 + 112 + 12)],
  ['unterminated descriptor', b => b.fill(1, 532, 552)],
  ['bad delay attributes', b => b.writeUInt32LE(2, 552)],
  ['legacy VA underflow', b => { b.writeUInt32LE(0, 552); b.writeUInt32LE(1, 556) }],
]) test(`malformed PE: ${name}`, () => {
  const b = fixture({ imports: ['a.dll'], delay: ['b.dll'] }); mutate(b)
  assert.throws(() => parsePE(b), /PE 格式无效/)
})
for (const name of ['../evil.dll', 'C:\\evil.dll', 'NUL.dll', 'bad:name.dll', 'a'.repeat(256), 'bad\x01.dll']) test(`reject unsafe import ${JSON.stringify(name)}`, () => {
  assert.throws(() => parsePE(fixture({ imports: [name] })), /PE 格式无效/)
})
test('unbounded name and excessive imports rejected', () => {
  const b = fixture({ imports: ['a.dll'] }); b.fill(65, 552)
  assert.throws(() => parsePE(b), /导入名称/)
  assert.throws(() => parsePE(fixture({ imports: Array(513).fill('a.dll') })), /512/)
})
for (const value of ['', '\\\\.\\C:', '\\\\?\\C:\\a.exe', '\\\\server\\a.exe', '//server/a.exe', 'NUL', 'CON.exe', 'C:\\a\\LPT1.dll', 'C:\\a.exe:stream', 'C:app.exe', '\\??\\C:\\a.exe']) test(`path rejects ${JSON.stringify(value)}`, () => assert.throws(() => safeLocalPath(value)))
test('relative and absolute ordinary EXE/DLL paths accepted; other extensions refused', () => {
  assert.equal(targetPath('a.exe', process.cwd()), path.join(process.cwd(), 'a.exe'))
  assert.equal(targetPath(path.join(process.cwd(), 'a.dll'), process.cwd()), path.join(process.cwd(), 'a.dll'))
  assert.throws(() => targetPath('a.txt', process.cwd()))
})
test('bounded file read refuses directory, missing and large file; supports cancellation and budget', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-pe-'))
  try {
    const file = path.join(dir, 'a.exe'); await writeFile(file, fixture())
    assert.equal((await readPE(file)).architecture, 'x64')
    await assert.rejects(readPE(dir), /普通文件/)
    await assert.rejects(readPE(path.join(dir, 'absent.exe')))
    await assert.rejects(readPE(file, AbortSignal.abort()))
    await assert.rejects(readPE(file, undefined, { remaining: 0 }), /总读取上限/)
    const { open } = await import('node:fs/promises'); const h = await open(file, 'r+'); await h.truncate(64 * 1024 * 1024 + 1); await h.close()
    await assert.rejects(readPE(file), /64 MiB/)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('nonzero descriptor with zero name RVA is malformed', () => {
  const b = fixture({ imports: ['a.dll'] })
  b.writeUInt32LE(1, 512); b.writeUInt32LE(0, 524)
  assert.throws(() => parsePE(b), /RVA 为零/)
})
test('deterministic malformed PE mutations never leak RangeError or crash', () => {
  let state = 0x12345678
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return state >>> 0 }
  const original = fixture({ imports: ['a.dll'], delay: ['b.dll'] })
  for (let i = 0; i < 500; i++) {
    const b = Buffer.from(original)
    for (let j = 0; j < 4; j++) b[random() % b.length] = random() & 255
    try { parsePE(b) } catch (error) { assert.equal(error.constructor, Error); assert.match(error.message, /^PE 格式无效/) }
  }
})
