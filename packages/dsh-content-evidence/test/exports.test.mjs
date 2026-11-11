import test from 'node:test'
import assert from 'node:assert/strict'
import promises, { mkdtemp, mkdir, readFile, writeFile, rm, readdir, stat, symlink } from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import { renameSync, symlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { nativeIO, Directory } from '../lib/directory-io.js'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { remoteErrorOf } from '@deepseek-ai/dsh-typert-protocol'
import { EvidenceStore } from '../lib/store.js'
import { draftInput } from './draft-fixture.mjs'
import { harness } from './harness.mjs'

const backends = ['procfs', '/dev/fd fallback', 'native (both fd paths disabled)']

function disableFdPaths(t, backend) {
  const original = promises.open
  const mocked = t.mock.method(promises, 'open', async (path, ...args) => {
    if (String(path).startsWith('/proc/self/fd/') || (backend === backends[2] && String(path).startsWith('/dev/fd/'))) throw Object.assign(new Error('fd path unavailable (test)'), { code: 'ENOTDIR' })
    return original(path, ...args)
  })
  syncBuiltinESMExports()
  t.after(() => { mocked.mock.restore(); syncBuiltinESMExports() })
}

async function fixture(t, backend = backends[0]) {
  if (backend !== backends[0]) disableFdPaths(t, backend)
  const root = await mkdtemp(join(tmpdir(), 'content-evidence-export-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const directory = join(root, 'exports'), dataDir = join(root, 'data')
  await mkdir(directory)
  const store = new EvidenceStore(dataDir)
  const topic = await store.createTopic('Synthetic export fixture, not a real result')
  const source = await store.addSource(topic.id, 'https://example.com/synthetic', 'Synthetic citation')
  const claim = await store.saveClaim(topic.id, 'Synthetic fixture took 12 ms', source.id)
  const save = async (body = { kind: 'x-single', post: 'AI 生成：Synthetic fixture took 12 ms' }) => store.saveDraft(topic.id, 'x', draftInput(await store.readEvidence(topic.id), 'x', body, [claim.id]))
  await save()
  return { root, directory, dataDir, store, topic, save, source, claim }
}

for (const backend of backends) test(`exports all four artifacts with citations, experiments and manual URLs; repeated exports preserve existing work (${backend})`, async t => {
  const { store, topic, directory, dataDir, save, source, claim } = await fixture(t, backend)
  const bytes = Buffer.from([0, 128, 255, 10])
  const material = await store.captureMaterial(topic.id, { name: '截图.png', mediaType: 'image/png', base64: bytes.toString('base64'), sourceId: source.id })
  await store.logExperiment(topic.id, { command: 'synthetic command', output: 'synthetic output', versions: 'synthetic version', conditions: 'synthetic conditions' })
  await store.saveClaim(topic.id, 'Unsourced synthetic fact', null)
  for (const platform of ['x', 'xiaohongshu', 'douyin', 'weixin-video']) {
    await store.backfillPublishedLink(topic.id, platform, `https://example.com/manual/${platform}`)
  }
  await save()
  const draft = await store.reviewDraft(topic.id, 'x', 2)
  const exported = await store.requestExport(topic.id, 'x', 'all', directory)
  assert.equal(exported.status, 'complete')
  assert.equal(exported.reviewPassed, true)
  assert.equal(exported.contentHash, draft.contentHash)
  assert.equal(exported.directory, join(directory, `content-evidence-${exported.id}`))
  assert.deepEqual(exported.files.sort(), ['draft.md', 'draft.txt', 'citations.txt', 'materials/index.json', `materials/${material.id}`].sort())
  assert.deepEqual(await readFile(join(exported.directory, 'materials', material.id)), bytes)
  assert.deepEqual(JSON.parse(await readFile(join(exported.directory, 'materials/index.json'), 'utf8')), (await store.readEvidence(topic.id)).materials)
  for (const name of ['draft.md', 'draft.txt', 'citations.txt']) {
    const output = await readFile(join(exported.directory, name), 'utf8')
    for (const expected of [source.url, claim.text, '待核实', 'synthetic command', 'synthetic output', 'synthetic version', 'synthetic conditions', 'Review: 审阅通过', draft.contentHash, 'https://example.com/manual/weixin-video']) assert.ok(output.includes(expected), `${name}: ${expected}`)
  }
  assert.equal((await stat(join(exported.directory, 'draft.txt'))).mode & 0o777, 0o600)
  assert.equal((await stat(exported.directory)).mode & 0o777, 0o700)
  assert.equal((await stat(join(exported.directory, 'materials'))).mode & 0o777, 0o700)
  assert.equal((await stat(join(exported.directory, 'materials', material.id))).mode & 0o777, 0o600)
  const original = await readFile(join(exported.directory, 'draft.md'), 'utf8')
  const repeated = await store.requestExport(topic.id, 'x', 'all', directory)
  assert.notEqual(repeated.directory, exported.directory)
  assert.equal(await readFile(join(exported.directory, 'draft.md'), 'utf8'), original)
  const reloaded = await new EvidenceStore(dataDir).readEvidence(topic.id)
  assert.deepEqual(reloaded.drafts.x, draft)
  assert.equal(reloaded.publishedLinks.length, 4)
  assert.equal(reloaded.exports.length, 2)
})

for (const backend of backends) test(`each single format works and legacy pending export records remain readable (${backend})`, async t => {
  const { store, topic, directory, dataDir } = await fixture(t, backend)
  for (const [format, files] of [
    ['markdown', ['draft.md']], ['text', ['draft.txt']], ['citations', ['citations.txt']],
    ['materials', ['export.txt', 'materials/index.json']],
  ]) {
    const exported = await store.requestExport(topic.id, 'x', format, directory)
    assert.deepEqual(exported.files, files)
    assert.equal(exported.reviewPassed, false)
  }
  const file = join(dataDir, 'workspace.json')
  const workspace = JSON.parse(await readFile(file, 'utf8'))
  const historical = workspace.topics[0].exports[0]
  historical.status = 'pending'
  delete historical.directory
  delete historical.files
  await writeFile(file, JSON.stringify(workspace))
  assert.equal((await new EvidenceStore(dataDir).readEvidence(topic.id)).exports[0].status, 'pending')
})

test('exports do not stamp passed after draft, evidence or configured rules change', async t => {
  const { store, topic, save, directory, dataDir } = await fixture(t)
  await store.reviewDraft(topic.id, 'x', 1)
  const approved = await store.requestExport(topic.id, 'x', 'all', directory)
  await save({ kind: 'x-thread', posts: ['AI 生成：Edited synthetic fixture', 'Synthetic fixture took 12 ms'] })
  const assertUnapproved = async exporter => {
    const exported = await exporter.requestExport(topic.id, 'x', 'all', directory)
    assert.equal(exported.reviewPassed, false)
    for (const file of ['draft.md', 'draft.txt', 'citations.txt']) assert.doesNotMatch(await readFile(join(exported.directory, file), 'utf8'), /Review: 审阅通过/)
  }
  await assertUnapproved(store)
  await store.reviewDraft(topic.id, 'x', 2)
  await assertUnapproved(new EvidenceStore(dataDir, ['synthetic']))
  await store.saveClaim(topic.id, 'New synthetic fact', null)
  await assertUnapproved(store)
  assert.equal((await store.readEvidence(topic.id)).exports.find(item => item.id === approved.id).reviewPassed, true)
})

test('corrupt completed export metadata and a mismatched passed-review hash are refused without writes', async t => {
  const { store, topic, directory, dataDir } = await fixture(t)
  await store.reviewDraft(topic.id, 'x', 1)
  await store.requestExport(topic.id, 'x', 'all', directory)
  const file = join(dataDir, 'workspace.json'), original = await readFile(file, 'utf8')
  const folders = await readdir(directory)
  for (const corrupt of [
    topic => { topic.exports[0].directory = 'relative' },
    topic => { topic.exports[0].files = ['../outside'] },
    topic => { delete topic.exports[0].contentHash },
    topic => { topic.drafts.x.review.contentHash = '0'.repeat(64) },
  ]) {
    const workspace = JSON.parse(original)
    corrupt(workspace.topics[0])
    const bytes = JSON.stringify(workspace)
    await writeFile(file, bytes)
    await assert.rejects(store.requestExport(topic.id, 'x', 'all', directory), error => remoteErrorOf(error)?.code === 'content-evidence/corrupt-store')
    assert.equal(await readFile(file, 'utf8'), bytes)
    assert.deepEqual(await readdir(directory), folders)
  }
})

for (const backend of backends) test(`rejects relative paths, dot traversal, symlink targets/ancestors, package and data roots without writes (${backend})`, async t => {
  const { store, topic, directory, root, dataDir } = await fixture(t, backend)
  const outside = join(root, 'outside')
  await mkdir(outside)
  const alias = join(root, 'alias')
  await symlink(outside, alias)
  await mkdir(join(outside, 'child'))
  await mkdir(join(dataDir, 'nested'))
  const file = join(dataDir, 'workspace.json'), original = await readFile(file, 'utf8')
  const targets = ['', '.', 'relative', '/', `${directory}/../outside`, `${directory}/./child`, `${directory}/a/../../outside`, alias, join(alias, 'child'), dataDir, join(dataDir, 'nested'), resolve('.'), resolve('lib'), `${directory}\0bad`, `${directory}\\..\\outside`]
  for (const target of targets) {
    await assert.rejects(store.requestExport(topic.id, 'x', 'all', target), error => remoteErrorOf(error)?.code === 'content-evidence/invalid-input')
    assert.equal(await readFile(file, 'utf8'), original)
  }
  await assert.rejects(store.requestExport(topic.id, 'x', 'all', join(directory, 'missing')), { code: 'ENOENT' })
  await assert.rejects(store.requestExport(topic.id, 'xiaohongshu', 'all', directory))
  await assert.rejects(store.requestExport(topic.id, 'x', 'all', directory, AbortSignal.abort()))
  assert.deepEqual(await readdir(directory), [])
  assert.deepEqual(await readdir(outside), ['child'])
  assert.deepEqual(await readdir(join(outside, 'child')), [])
  assert.equal(await readFile(file, 'utf8'), original)
})

for (const backend of backends) for (const nested of [false, true]) test(`a destination ${nested ? "ancestor" : "directory"} swapped to a symlink cannot redirect export writes (${backend})`, async t => {
  const { store, topic, directory, root } = await fixture(t, backend)
  const outside = join(root, 'outside'), moved = join(root, 'chosen-moved')
  const target = nested ? join(directory, 'child') : directory
  await mkdir(outside)
  if (nested) { await mkdir(target); await mkdir(join(outside, 'child')) }
  const native = backend === backends[2]
  const io = native ? nativeIO() : promises, originalMkdir = io.mkdir
  const original = await readFile(join(root, 'data/workspace.json'), 'utf8')
  let swapped = false
  const swap = path => {
    if (!swapped && String(path).endsWith('.tmp')) {
      swapped = true
      renameSync(directory, moved)
      symlinkSync(outside, directory)
    }
  }
  const mocked = t.mock.method(io, 'mkdir', native ? (fd, name) => {
    swap(name)
    return originalMkdir(fd, name)
  } : async (path, options) => {
    swap(path)
    return originalMkdir(path, options)
  })
  syncBuiltinESMExports()
  let exported
  try {
    if (native) await assert.rejects(store.requestExport(topic.id, 'x', 'all', target), error => remoteErrorOf(error)?.code === 'content-evidence/invalid-input')
    else exported = await store.requestExport(topic.id, 'x', 'all', target)
  }
  finally { mocked.mock.restore(); syncBuiltinESMExports() }
  assert.equal(swapped, true)
  assert.deepEqual(await readdir(outside), nested ? ['child'] : [])
  if (nested) assert.deepEqual(await readdir(join(outside, 'child')), [])
  if (native) {
    assert.deepEqual(await readdir(nested ? join(moved, 'child') : moved), [])
    assert.equal(await readFile(join(root, 'data/workspace.json'), 'utf8'), original)
  } else {
    assert.equal(exported.directory, join(moved, nested ? 'child' : '', `content-evidence-${exported.id}`))
    assert.match(await readFile(join(exported.directory, 'draft.txt'), 'utf8'), /Synthetic fixture/)
  }
})

for (const backend of backends) test(`corrupt or symlinked source material fails export, cleans staging, and preserves the completed draft (${backend})`, async t => {
  const { store, topic, directory, dataDir, root } = await fixture(t, backend)
  const material = await store.captureMaterial(topic.id, { name: 'fixture.txt', mediaType: 'text/plain', base64: Buffer.from('Original fixture').toString('base64'), sourceId: null })
  const file = join(dataDir, 'workspace.json'), original = await readFile(file, 'utf8')
  await writeFile(join(dataDir, material.path), 'Changed fixture')
  await assert.rejects(store.requestExport(topic.id, 'x', 'all', directory), error => remoteErrorOf(error)?.code === 'content-evidence/corrupt-store')
  await rm(join(dataDir, material.path))
  await writeFile(join(root, 'external'), 'Original fixture')
  await symlink(join(root, 'external'), join(dataDir, material.path))
  await assert.rejects(store.requestExport(topic.id, 'x', 'all', directory), { code: 'ELOOP' })
  assert.deepEqual(await readdir(directory), [])
  assert.equal(await readFile(file, 'utf8'), original)
})

for (const backend of backends) test(`direct material reads pin their directory, check size/hash and honor cancellation (${backend})`, async t => {
  const { store, topic, root, dataDir } = await fixture(t, backend)
  const bytes = Buffer.from([0, 128, 255, 10])
  const material = await store.captureMaterial(topic.id, { name: 'bytes.bin', mediaType: 'application/octet-stream', base64: bytes.toString('base64'), sourceId: null })
  const originalState = await readFile(join(dataDir, 'workspace.json'), 'utf8')
  assert.deepEqual(Buffer.from((await store.readMaterial(topic.id, material.id)).base64, 'base64'), bytes)
  const outside = join(root, 'outside'), moved = join(dataDir, 'materials-moved')
  await mkdir(outside)
  await writeFile(join(outside, material.id), 'external bytes must not be read')
  const originalOpen = Directory.prototype.openFile
  let swapped = false
  const mock = t.mock.method(Directory.prototype, 'openFile', async function (name, ...args) {
    if (name === material.id && !swapped) {
      swapped = true
      renameSync(join(dataDir, 'materials'), moved)
      symlinkSync(outside, join(dataDir, 'materials'))
    }
    return originalOpen.call(this, name, ...args)
  })
  try { assert.deepEqual(Buffer.from((await store.readMaterial(topic.id, material.id)).base64, 'base64'), bytes) }
  finally { mock.mock.restore() }
  assert.equal(swapped, true)
  await rm(join(dataDir, 'materials'))
  renameSync(moved, join(dataDir, 'materials'))
  for (const corrupted of [Buffer.alloc(bytes.length, 1), Buffer.alloc(10 * 1024 * 1024 + 1)]) {
    await writeFile(join(dataDir, material.path), corrupted)
    await assert.rejects(store.readMaterial(topic.id, material.id), error => ['content-evidence/invalid-input', 'content-evidence/corrupt-store'].includes(remoteErrorOf(error)?.code))
  }
  await writeFile(join(dataDir, material.path), bytes)
  const controller = new AbortController()
  const cancelled = t.mock.method(Directory.prototype, 'openFile', async function (name, ...args) {
    const handle = await originalOpen.call(this, name, ...args)
    if (name === material.id) controller.abort(new Error('cancel material read'))
    return handle
  })
  try { await assert.rejects(store.readMaterial(topic.id, material.id, controller.signal), /cancel material read/) }
  finally { cancelled.mock.restore() }
  assert.equal(await readFile(join(dataDir, 'workspace.json'), 'utf8'), originalState)
  assert.equal(await readFile(join(outside, material.id), 'utf8'), 'external bytes must not be read')
})

for (const backend of backends) test(`partial file sync, rename failures and mid-export cancellation clean staging (${backend})`, async t => {
  const { store, topic, directory, dataDir } = await fixture(t, backend)
  const material = await store.captureMaterial(topic.id, { name: 'fixture.txt', mediaType: 'text/plain', base64: Buffer.from('fixture').toString('base64'), sourceId: null })
  const originalState = await readFile(join(dataDir, 'workspace.json'), 'utf8')
  const originalOpen = Directory.prototype.openFile
  for (const failure of ['sync', 'cancel', 'rename']) {
    const controller = new AbortController()
    const mock = failure === 'rename'
      ? t.mock.method(Directory.prototype, 'rename', () => { throw new Error('injected rename failure') })
      : t.mock.method(Directory.prototype, 'openFile', async function (name, ...args) {
        const handle = await originalOpen.call(this, name, ...args)
        if (name === material.id) {
          if (failure === 'sync') handle.sync = async () => { throw new Error('injected sync failure') }
          else controller.abort(new Error('injected cancellation'))
        }
        return handle
      })
    try { await assert.rejects(store.requestExport(topic.id, 'x', 'all', directory, controller.signal), /injected/) }
    finally { mock.mock.restore() }
    assert.deepEqual(await readdir(directory), [])
    assert.equal(await readFile(join(dataDir, 'workspace.json'), 'utf8'), originalState)
    assert.equal(await readFile(join(dataDir, material.path), 'utf8'), 'fixture')
  }
})

test('fd-path probes with mismatched directory identities are discarded', async t => {
  const { store, topic, directory, root } = await fixture(t)
  const decoy = join(root, 'decoy')
  await mkdir(decoy)
  const originalOpen = promises.open
  const mock = t.mock.method(promises, 'open', (path, ...args) => originalOpen(/^\/(proc\/self|dev)\/fd\//.test(String(path)) ? decoy : path, ...args))
  syncBuiltinESMExports()
  try {
    const exported = await store.requestExport(topic.id, 'x', 'all', directory)
    assert.match(await readFile(join(exported.directory, 'draft.txt'), 'utf8'), /Synthetic fixture/)
    assert.deepEqual(await readdir(decoy), [])
  } finally { mock.mock.restore(); syncBuiltinESMExports() }
})

test('JS, shell and HTML previews and exports only read/copy bytes, with no side effects or network', async t => {
  const { ctx, topic, dataDir, run, signal } = await harness(t)
  const directory = await mkdtemp(join(tmpdir(), 'content-evidence-inert-export-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const sentinel = join(dataDir, 'executed')
  const mockedFetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Network must not be called') })
  const payloads = [
    ['evil.js', 'text/javascript', `require('node:fs').writeFileSync(${JSON.stringify(sentinel)}, 'executed')`],
    ['evil.sh', 'text/x-shellscript', `#!/bin/sh\ntouch '${sentinel}'`],
    ['evil.html', 'text/html', '<script>globalThis.__contentEvidenceExecuted = true</script>\n```\n<script>alert("fixture")</script>'],
  ]
  const materials = []
  for (const [name, mediaType, payload] of payloads) {
    const material = await ctx.contentEvidence.captureMaterial(topic.id, { name, mediaType, base64: Buffer.from(payload).toString('base64'), sourceId: null }, signal)
    const preview = await run('content_evidence_read_evidence', { topicId: topic.id, materialId: material.id })
    assert.equal(preview.isError, false)
    assert.equal(JSON.parse(preview.value).material.content, payload)
    materials.push(material)
  }
  const body = { kind: 'x-single', post: payloads[2][2] }
  await ctx.contentEvidence.saveDraft(topic.id, 'x', draftInput(await ctx.contentEvidence.readEvidence(topic.id, signal), 'x', body), signal)
  const result = await run('content_evidence_export_draft', { topicId: topic.id, platform: 'x', format: 'all', directory })
  assert.equal(result.isError, false)
  const exported = JSON.parse(result.value)
  for (const [index, material] of materials.entries()) {
    assert.equal(await readFile(join(exported.directory, 'materials', material.id), 'utf8'), payloads[index][2])
    assert.equal((await stat(join(exported.directory, 'materials', material.id))).mode & 0o111, 0)
  }
  const markdown = await readFile(join(exported.directory, 'draft.md'), 'utf8')
  assert.match(markdown, /````\npost:/)
  assert.equal(globalThis.__contentEvidenceExecuted, undefined)
  assert.equal(mockedFetch.mock.callCount(), 0)
  await assert.rejects(stat(sentinel), { code: 'ENOENT' })
})

test('manual URL backfill validates input and never visits platform endpoints', async t => {
  const { store, topic, dataDir } = await fixture(t)
  const mockedFetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Backfill must not call a network API') })
  for (const platform of ['x', 'xiaohongshu', 'douyin', 'weixin-video']) await store.backfillPublishedLink(topic.id, platform, `https://example.com/${platform}`)
  const file = join(dataDir, 'workspace.json'), original = await readFile(file, 'utf8')
  for (const url of ['javascript:alert(1)', 'file:///tmp/publication', 'https://user:password@example.com', 'invalid']) await assert.rejects(store.backfillPublishedLink(topic.id, 'x', url))
  await assert.rejects(store.backfillPublishedLink(topic.id, 'unknown', 'https://example.com'))
  assert.equal(await readFile(file, 'utf8'), original)
  assert.equal((await new EvidenceStore(dataDir).readEvidence(topic.id)).publishedLinks.length, 4)
  assert.equal(mockedFetch.mock.callCount(), 0)
})

test('missing native helper and unusable fd paths refuse before export writes, preserving drafts/history', async t => {
  const { store, topic, directory, dataDir } = await fixture(t)
  const original = await readFile(join(dataDir, 'workspace.json'), 'utf8')
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict'
    import Module, { syncBuiltinESMExports } from 'node:module'
    import promises from 'node:fs/promises'
    import { remoteErrorOf } from '@deepseek-ai/dsh-typert-protocol'
    import { EvidenceStore } from './lib/store.js'
    const originalOpen = promises.open, originalLoad = Module._load
    promises.open = (path, ...args) => {
      if (/^\\/(proc\\/self|dev)\\/fd\\//.test(String(path))) throw Object.assign(new Error('No fd paths'), { code: 'ENOTDIR' })
      return originalOpen(path, ...args)
    }
    Module._load = function(name, ...args) {
      if (name.startsWith('@koromix/koffi-')) throw new Error('Missing prebuilt helper (fixture)')
      return originalLoad.call(this, name, ...args)
    }
    syncBuiltinESMExports()
    await assert.rejects(new EvidenceStore(process.argv[1]).requestExport(process.argv[2], 'x', 'all', process.argv[3]), error => {
      assert.equal(remoteErrorOf(error)?.code, 'content-evidence/export-unsupported')
      assert.match(error.message, /no export files were written/)
      return true
    })
  `, dataDir, topic.id, directory], { cwd: new URL('..', import.meta.url), stdio: 'pipe' })
  assert.deepEqual(await readdir(directory), [])
  assert.equal(await readFile(join(dataDir, 'workspace.json'), 'utf8'), original)
})

test('Windows refuses before trying POSIX flags or touching the export path', async t => {
  const { writeExport } = await import('../lib/exports.js')
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')
  const mocked = t.mock.method(promises, 'open', () => { assert.fail('unsupported host must not open any path') })
  syncBuiltinESMExports()
  Object.defineProperty(process, 'platform', { value: 'win32' })
  try {
    await assert.rejects(writeExport('C:\\Exports', [], '00000000-0000-4000-8000-000000000000', {}, null, async () => Buffer.alloc(0)), error => remoteErrorOf(error)?.code === 'content-evidence/export-unsupported')
    assert.equal(mocked.mock.callCount(), 0)
  } finally {
    Object.defineProperty(process, 'platform', descriptor)
    mocked.mock.restore(); syncBuiltinESMExports()
  }
})
