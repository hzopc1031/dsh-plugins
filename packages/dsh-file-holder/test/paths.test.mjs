import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, symlink, rm, realpath } from 'node:fs/promises'
import { resolve, join, win32 } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inputPath, validateProjectFile } from '../lib/paths.js'

for (const value of ['', ' ', '""', '\\\\.\\PhysicalDrive0', '\\\\?\\C:\\project\\a.txt', '\\\\server\\share\\a.txt',
  '//server/share/a.txt', 'CON', 'sub/NUL.txt', 'aux', 'PRN.log', 'COM1', 'LPT9.x', 'COM¹', 'CONIN$', 'CONOUT$', 'CON .txt', 'sub/NUL .log',
  'file.txt:stream', 'C:relative.txt', '\\rooted.txt', 'trailing.', 'dir /a.txt', 'a"b', 'a\0b', 'a\nb']) {
  test('reject unsafe input ' + JSON.stringify(value), () => { assert.throws(() => inputPath(value)) })
}
test('quoted path with spaces, Unicode and shell metacharacters stays literal', () => {
  assert.equal(inputPath('  "目录/a & $(literal).txt"  '), '目录/a & $(literal).txt')
})
const root = 'C:\\project'
function mockIO({ canonical = 'C:\\project\\file.txt', isFile = true, isDirectory = true, missing = false } = {}) {
  return {
    async realpath(file) { if (missing) throw new Error('ENOENT'); return file === root ? root : canonical },
    async stat(file) { return { isDirectory: () => file === root && isDirectory, isFile: () => file !== root && isFile } },
  }
}
test('returns canonical root and normal file', async () => {
  assert.deepEqual(await validateProjectFile('file.txt', root, mockIO()), { root, file: root + '\\file.txt' })
})
for (const value of ['..\\outside.txt', 'C:\\project-sibling\\file.txt', 'D:\\file.txt', 'C:\\project']) {
  test('reject lexical boundary ' + value, async () => {
    await assert.rejects(validateProjectFile(value, root, { realpath() { assert.fail('must reject before I/O') } }), /项目内/)
  })
}
for (const [label, config] of [
  ['directory', { isFile: false }], ['missing file', { missing: true }],
  ['non-directory project', { isDirectory: false }],
  ['symlink escape', { canonical: 'C:\\outside\\file.txt' }],
  ['junction sibling escape', { canonical: 'C:\\project-other\\file.txt' }],
  ['canonical UNC', { canonical: '\\\\server\\share\\file.txt' }],
  ['canonical device namespace', { canonical: '\\\\?\\C:\\project\\file.txt' }],
]) test('reject resolved boundary: ' + label, async () => {
  await assert.rejects(validateProjectFile('file.txt', root, mockIO(config)), /普通文件/)
})
test('Windows case comparison accepts equivalent paths', async () => {
  assert.equal((await validateProjectFile('file.txt', root, mockIO({ canonical: 'c:\\PROJECT\\file.txt' }))).file, 'c:\\PROJECT\\file.txt')
})
test('symlink within project resolves to regular file', async () => {
  assert.equal((await validateProjectFile('link.txt', root, mockIO({ canonical: root + '\\nested\\file.txt' }))).file, root + '\\nested\\file.txt')
})
test('UNC project rejected without filesystem access', async () => {
  await assert.rejects(validateProjectFile('file.txt', '\\\\server\\share', { realpath() { assert.fail('I/O') } }), /本机 Windows/)
})
test('actual filesystem normal/missing/directory/junction boundaries', { skip: process.platform !== 'win32' }, async () => {
  const workspace = fileURLToPath(new URL('../../../', import.meta.url))
  const scratch = join(workspace, '.tmp')
  await mkdir(scratch, { recursive: true })
  const area = await mkdtemp(join(scratch, 'file-holder-paths-'))
  assert.ok(resolve(area).startsWith(resolve(scratch) + '\\'))
  try {
    const project = join(area, 'project')
    const outside = join(area, 'outside')
    await mkdir(project)
    await mkdir(outside)
    await writeFile(join(project, '你好 & literal.txt'), 'test')
    await writeFile(join(outside, 'other.txt'), 'test')
    await symlink(outside, join(project, 'escape'), 'junction')
    const target = await validateProjectFile('你好 & literal.txt', project)
    assert.equal(target.file, await realpath(join(project, '你好 & literal.txt')))
    await assert.rejects(validateProjectFile('missing.txt', project), /存在的普通文件/)
    await assert.rejects(validateProjectFile('.', project), /项目内/)
    await assert.rejects(validateProjectFile('escape/other.txt', project), /普通文件/)
  } finally {
    // Both the generated junction and its target are inside this verified scratch directory.
    assert.ok(resolve(area).startsWith(resolve(scratch) + '\\'))
    await rm(area, { recursive: true, force: true })
  }
})
