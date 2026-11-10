import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import os from 'node:os'
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, symlink } from 'node:fs/promises'
import { ImpactStore, MAX_BYTES } from '../lib/store.js'
import { createPlan } from '../lib/core.js'

const csv = 'item,price\nA,100\nB,200\n'
const ref = id => ({
  id, source: 'quotes.csv', selector: { kind: 'csv-key', keyColumn: 'item', keyValue: 'A', columns: ['price'] },
  conclusion: { id: 'buy', text: '建议 A' },
  outputs: [{ path: 'report.md', kind: 'section', locator: '## 建议', label: '建议章节' }],
  recheck: '重算 10 件采购总价并核对建议依据。',
})
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-source-impact-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeFile(path.join(root, 'quotes.csv'), csv)
  await writeFile(path.join(root, 'report.md'), '# Report\n原结论\n')
  return { root, store: new ImpactStore(root), state: path.join(root, '.dsh', 'source-impact', 'registry.json') }
}
test('read-only scan on new project creates no registry folders', async t => {
  const { root, store } = await fixture(t)
  assert.equal((await store.scan()).impacts.length, 0)
  assert.deepEqual((await readdir(root)).sort(), ['quotes.csv', 'report.md'])
})
test('persistent registration survives a fresh instance; checks/plans preserve baseline and report', async t => {
  const { root, store, state } = await fixture(t)
  await store.add(ref('a'))
  const baseline = await readFile(state, 'utf8'), report = await readFile(path.join(root, 'report.md'), 'utf8')
  await writeFile(path.join(root, 'quotes.csv'), csv.replace('100', '120'))
  const reopened = new ImpactStore(root), scan = await reopened.scan()
  assert.equal(scan.impacts[0].citationContentChanged, true)
  createPlan(scan, ['a'], scan.scanId)
  assert.equal(await readFile(state, 'utf8'), baseline)
  assert.equal(await readFile(path.join(root, 'report.md'), 'utf8'), report)
  await reopened.remove('a')
  assert.equal((await reopened.load()).references.length, 0)
  assert.equal(await readFile(path.join(root, 'quotes.csv'), 'utf8'), csv.replace('100', '120'))
})
test('failed registration preserves state and removes temporary/lock files', async t => {
  const { store, state } = await fixture(t)
  await store.add(ref('a'))
  const baseline = await readFile(state, 'utf8')
  await assert.rejects(store.add(ref('a')), /已存在/)
  await assert.rejects(store.add({ ...ref('bad'), selector: { kind: 'csv-key', keyColumn: 'missing', keyValue: 'A', columns: ['price'] } }), /列已不存在/)
  assert.equal(await readFile(state, 'utf8'), baseline)
  assert.deepEqual(await readdir(path.dirname(state)), ['registry.json'])
})
test('missing source yields unknown version and manual review; corrupt state never resets', async t => {
  const { root, store, state } = await fixture(t)
  await store.add(ref('a'))
  await rm(path.join(root, 'quotes.csv'))
  const i = (await store.scan()).impacts[0]
  assert.equal(i.sourceVersionChanged, null)
  assert.equal(i.needsManualReview, true)
  await writeFile(state, '{broken')
  await assert.rejects(store.load(), /有效 JSON/)
  await assert.rejects(store.remove('a'), /有效 JSON/)
  assert.equal(await readFile(state, 'utf8'), '{broken')
})
test('single-writer lock rejects a competing writer without deleting its lock', async t => {
  const { store, state } = await fixture(t)
  await store.add(ref('a'))
  const lock = path.join(path.dirname(state), 'registry.lock')
  await writeFile(lock, 'another writer')
  await assert.rejects(store.add(ref('b')), /登记正在被修改/)
  assert.equal(await readFile(lock, 'utf8'), 'another writer')
  assert.equal((await store.load()).references.length, 1)
})
test('concurrent add operations cannot lose a successful registration', async t => {
  const { store } = await fixture(t)
  const results = await Promise.allSettled(['a','b','c'].map(id => store.add(ref(id))))
  const successful = results.filter(r => r.status === 'fulfilled').length
  assert.ok(successful >= 1)
  assert.equal((await store.load()).references.length, successful)
})
test('oversized and invalid UTF-8 source files require manual review', async t => {
  const { root, store } = await fixture(t)
  await store.add(ref('a'))
  await writeFile(path.join(root, 'quotes.csv'), Buffer.alloc(MAX_BYTES + 1, 120))
  assert.match((await store.scan()).impacts[0].reason, /大小限制/)
  await writeFile(path.join(root, 'quotes.csv'), Buffer.from([0xc3, 0x28]))
  assert.match((await store.scan()).impacts[0].reason, /UTF-8/)
})
test('already cancelled read and mutation perform no state writes', async t => {
  const { root, store } = await fixture(t)
  const signal = AbortSignal.abort()
  await assert.rejects(store.scan(signal))
  await assert.rejects(store.add(ref('a'), signal))
  assert.equal((await readdir(root)).includes('.dsh'), false)
})
test('source path rules reject unsupported files, remote and parent paths', async t => {
  const { store } = await fixture(t)
  for (const source of ['../quotes.csv', 'https://example.com/q.csv', 'x.xlsx']) await assert.rejects(store.add({ ...ref('a'), source }))
  assert.throws(() => new ImpactStore('relative'), /绝对路径/)
})
test('directory junction outside project is rejected before file content is read', async t => {
  const { root, store } = await fixture(t)
  const outside = await mkdtemp(path.join(os.tmpdir(), 'dsh-impact-outside-'))
  t.after(() => rm(outside, { recursive: true, force: true }))
  await writeFile(path.join(outside, 'quotes.csv'), csv)
  await symlink(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(store.readSource('linked/quotes.csv'), /越出项目/)
})
test('state junction is rejected and never used for registry writes', async t => {
  const { root, store } = await fixture(t)
  const outside = await mkdtemp(path.join(os.tmpdir(), 'dsh-impact-state-'))
  t.after(() => rm(outside, { recursive: true, force: true }))
  await symlink(outside, path.join(root, '.dsh'), process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(store.add(ref('a')), /普通目录/)
  assert.deepEqual(await readdir(outside), [])
})
