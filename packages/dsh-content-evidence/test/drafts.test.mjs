import test from 'node:test'
import assert from 'node:assert/strict'
import promises, { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { remoteErrorOf } from '@deepseek-ai/dsh-typert-protocol'
import { EvidenceStore } from '../lib/store.js'
import { draftInput } from './draft-fixture.mjs'

const failure = code => error => remoteErrorOf(error)?.code === `content-evidence/${code}`
async function fixture(t, terms = []) {
  const exportRoot = await mkdtemp(join(tmpdir(), 'content-evidence-drafts-'))
  const dataDir = join(exportRoot, 'data')
  t.after(() => rm(exportRoot, { recursive: true, force: true }))
  const store = new EvidenceStore(dataDir, terms)
  const topic = await store.createTopic('Synthetic draft fixture, not a product result')
  const source = await store.addSource(topic.id, 'https://example.com/fixture', 'Synthetic source, not fetched')
  const claim = await store.saveClaim(topic.id, 'Synthetic run took 12 ms', source.id)
  const save = async (target, body, claimIds = [claim.id]) => store.saveDraft(topic.id, target, draftInput(await store.readEvidence(topic.id), target, body, claimIds))
  return { store, topic, source, claim, dataDir, exportRoot, save }
}

test('four editable platform shapes and both X modes use one evidence sheet', async t => {
  const { store, topic, claim, source, dataDir, save } = await fixture(t)
  const shapes = [
    ['x', { kind: 'x-single', post: 'AI 生成：Synthetic run took 12 ms' }],
    ['x', { kind: 'x-thread', posts: ['AI 生成：Synthetic test', `Run took 12 ms ${source.url}`] }],
    ['xiaohongshu', { kind: 'xiaohongshu', title: 'Synthetic experiment', body: 'AI 生成：Run took 12 ms', cards: ['Test conditions supplied in the fact base'] }],
    ['douyin', { kind: 'douyin', voiceover: 'AI 生成：Run took 12 ms', shots: ['Show the supplied result'] }],
    ['weixin-video', { kind: 'weixin-video', voiceover: 'AI 生成：Explain the synthetic 12 ms result', shots: ['Show the test conditions', 'Show the recorded output'] }],
  ]
  for (const [target, body] of shapes) {
    const draft = await save(target, body)
    assert.deepEqual(draft.body, body)
    assert.deepEqual(draft.claimIds, [claim.id])
    assert.match(draft.content, /12 ms/)
    assert.ok(draft.content.includes(source.url))
    assert.equal((await store.reviewDraft(topic.id, target, draft.revision)).review.status, 'passed')
  }
  const sheet = await new EvidenceStore(dataDir).readEvidence(topic.id)
  assert.equal(new Set(Object.values(sheet.drafts).map(draft => draft.evidenceHash)).size, 1)
  assert.equal(sheet.claims.length, 1)
  assert.equal(sheet.sources.length, 1)
})

test('unsourced facts stay 待核实; saves cannot invent a number, URL or source reference', async t => {
  const { store, topic, source, claim: sourced, dataDir, save } = await fixture(t)
  const claim = await store.saveClaim(topic.id, 'Synthetic unverified result: 7 ms', null)
  const draft = await save('x', { kind: 'x-single', post: 'AI 生成：Synthetic result: 7 ms' }, [claim.id])
  assert.match(draft.content, /7 ms — 待核实/)
  const review = (await store.reviewDraft(topic.id, 'x', draft.revision)).review
  assert.equal(review.status, 'failed')
  assert.ok(review.findings.some(f => f.code === 'citation' && f.excerpt.includes('待核实')))
  const original = await readFile(join(dataDir, 'workspace.json'), 'utf8')
  for (const [post, claimIds] of [
    ['AI 生成：Invented result 99 ms', [claim.id]],
    [`AI 生成：${source.url}，99 ms`, [sourced.id]],
    ['AI 生成：HTTPS://example.com/invented', [claim.id]],
    ['AI 生成：Invented source https://example.com/invented', [claim.id]],
    ['AI 生成：Invented source id', ['00000000-0000-4000-8000-000000000000']],
  ]) {
    await assert.rejects(save('x', { kind: 'x-single', post }, claimIds), failure('invalid-input'))
    assert.equal(await readFile(join(dataDir, 'workspace.json'), 'utf8'), original)
  }
  const loaded = await store.readEvidence(topic.id)
  assert.equal(loaded.claims.at(-1).status, '待核实')
  assert.equal(loaded.claims.at(-1).sourceId, null)
  assert.equal(loaded.sources.length, 1)
  const noFacts = await save('douyin', { kind: 'douyin', voiceover: 'AI 生成：Unlinked claim', shots: ['Show the result'] }, [])
  assert.match(noFacts.content, /待核实/)
  assert.ok((await store.reviewDraft(topic.id, 'douyin', noFacts.revision)).review.findings.some(f => f.code === 'citation'))
})

test('review returns locations and minimum fixes for built-in patterns and literal extra terms', async t => {
  const { store, topic, save } = await fixture(t, ['custom.term'])
  const draft = await save('xiaohongshu', { kind: 'xiaohongshu', title: '保证最佳效果', body: 'İ 翻墙 custom.term customXterm', cards: ['Always guaranteed results'] })
  const { review } = await store.reviewDraft(topic.id, 'xiaohongshu', draft.revision)
  assert.equal(review.status, 'failed')
  assert.deepEqual(new Set(review.findings.map(f => f.code)), new Set(['ai-label', 'sensitive', 'absolute']))
  assert.ok(review.findings.every(f => f.location && f.fix))
  assert.ok(review.findings.some(f => f.location === 'title@0' && f.excerpt === '保证'))
  assert.equal(review.findings.filter(f => f.excerpt === 'custom.term').length, 1)
  assert.equal(review.findings.find(f => f.excerpt === 'custom.term').location, 'body@5')
  assert.ok(!review.findings.some(f => f.excerpt === 'customXterm'))
  assert.ok(review.findings.some(f => f.location.startsWith('cards[0]@')))
  for (const terms of [[''], ['x'.repeat(101)], Array(101).fill('x')]) assert.throws(() => new EvidenceStore('/tmp/unused-fixture', terms), failure('invalid-input'))
})

test('copy, shape, shot and fact-selection edits invalidate passed reviews before export', async t => {
  const { store, topic, claim, exportRoot, save } = await fixture(t)
  const variants = [
    { kind: 'x-single', post: 'AI 生成：Run took 12 ms' },
    { kind: 'x-single', post: 'AI 生成：Edited run description: 12 ms' },
    { kind: 'x-thread', posts: ['AI 生成：Edited run description: 12 ms'] },
  ]
  for (const body of variants) {
    const draft = await save('x', body)
    assert.equal(draft.review.status, 'pending')
    assert.equal((await store.requestExport(topic.id, 'x', 'markdown', exportRoot)).reviewPassed, false)
    const reviewed = await store.reviewDraft(topic.id, 'x', draft.revision)
    assert.equal(reviewed.review.status, 'passed')
    assert.equal(reviewed.review.contentHash, reviewed.contentHash)
    const exported = await store.requestExport(topic.id, 'x', 'markdown', exportRoot)
    assert.equal(exported.reviewPassed, true)
    assert.equal(exported.contentHash, draft.contentHash)
    assert.equal((await save('x', body)).review.status, 'passed')
    assert.equal((await save('x', Object.fromEntries(Object.entries(body).reverse()))).review.status, 'passed')
  }
  const another = await store.saveClaim(topic.id, 'Additional synthetic claim', claim.sourceId)
  const rebase = await save('x', variants.at(-1))
  await store.reviewDraft(topic.id, 'x', rebase.revision)
  assert.equal((await save('x', variants.at(-1), [claim.id, another.id])).review.status, 'pending')
  const video = await save('douyin', { kind: 'douyin', voiceover: 'AI 生成：Synthetic run took 12 ms', shots: ['Original shot'] })
  await store.reviewDraft(topic.id, 'douyin', video.revision)
  assert.equal((await save('douyin', { ...video.body, shots: ['Edited shot'] })).review.status, 'pending')
})

test('changed evidence and configured terms invalidate prior passes after restart', async t => {
  const { store, topic, dataDir, exportRoot, save } = await fixture(t)
  const draft = await save('x', { kind: 'x-single', post: 'AI 生成：Synthetic run took 12 ms' })
  await store.reviewDraft(topic.id, 'x', draft.revision)
  const changedRules = new EvidenceStore(dataDir, ['Synthetic'])
  assert.equal((await changedRules.readEvidence(topic.id)).drafts.x.review.status, 'pending')
  assert.equal((await changedRules.requestExport(topic.id, 'x', 'text', exportRoot)).reviewPassed, false)
  await store.reviewDraft(topic.id, 'x', draft.revision)
  const oldEvidence = await store.readEvidence(topic.id)
  await store.saveClaim(topic.id, 'New unverified synthetic fact', null)
  assert.equal((await new EvidenceStore(dataDir).readEvidence(topic.id)).drafts.x.review.status, 'pending')
  const reviewed = await store.reviewDraft(topic.id, 'x', draft.revision)
  assert.equal(reviewed.review.status, 'failed')
  assert.ok(reviewed.review.findings.some(f => f.code === 'evidence-changed'))
  await assert.rejects(store.saveDraft(topic.id, 'x', draftInput(oldEvidence, 'x', draft.body, draft.claimIds)), failure('conflict'))
  assert.equal((await store.requestExport(topic.id, 'x', 'markdown', exportRoot)).reviewPassed, false)
})

test('failed, cancelled, stale and competing retries preserve the completed winner', async t => {
  const { store, topic, dataDir, save } = await fixture(t)
  const stale = draftInput(await store.readEvidence(topic.id), 'x', { kind: 'x-single', post: 'Stale retry' })
  const completed = await save('x', { kind: 'x-single', post: 'AI 生成：Synthetic run took 12 ms' })
  await store.reviewDraft(topic.id, 'x', completed.revision)
  const file = join(dataDir, 'workspace.json'), original = await readFile(file, 'utf8')
  await assert.rejects(store.saveDraft(topic.id, 'x', stale), failure('conflict'))
  await assert.rejects(store.reviewDraft(topic.id, 'x', 0), failure('conflict'))
  const retry = draftInput(await store.readEvidence(topic.id), 'x', completed.body, completed.claimIds)
  await assert.rejects(store.saveDraft(topic.id, 'x', { ...retry, body: { kind: 'x-single', post: 'Partial unsupported 9999' } }), failure('invalid-input'))
  await assert.rejects(store.saveDraft(topic.id, 'x', retry, AbortSignal.abort(new Error('Failed generation'))), /Failed generation/)
  assert.equal(await readFile(file, 'utf8'), original)
  const other = new EvidenceStore(dataDir)
  const results = await Promise.allSettled([store, other].map((instance, i) => instance.saveDraft(topic.id, 'x', { ...retry, body: { kind: 'x-single', post: i ? 'Second complete candidate' : 'First complete candidate' } })))
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  const winner = results.find(r => r.status === 'fulfilled').value
  assert.equal(winner.status, 'complete')
  assert.deepEqual((await other.readEvidence(topic.id)).drafts.x, winner)
  await assert.rejects(store.saveDraft(topic.id, 'x', retry), failure('conflict'))
  assert.deepEqual((await other.readEvidence(topic.id)).drafts.x, winner)
})

test('invalid shapes and missing concurrency metadata cannot replace a draft', async t => {
  const { store, topic, dataDir, save } = await fixture(t)
  await save('x', { kind: 'x-single', post: 'Original artifact' })
  const sheet = await store.readEvidence(topic.id), original = await readFile(join(dataDir, 'workspace.json'), 'utf8')
  const good = draftInput(sheet, 'x', { kind: 'x-thread', posts: ['Valid post'] })
  for (const input of [
    { ...good, body: { kind: 'x-thread', posts: [] } },
    { ...good, body: { kind: 'x-single', post: 'text', extra: 'not allowed' } },
    { ...good, body: { kind: 'douyin', voiceover: 'text', shots: ['shot'] } },
    { ...good, expectedRevision: undefined }, { ...good, expectedRevision: -1 },
    { ...good, evidenceHash: 'invalid' }, { ...good, claimIds: ['bad'] },
    { ...good, claimIds: [sheet.claims[0].id, sheet.claims[0].id] },
    { ...good, extra: true }, 'legacy plain text',
  ]) {
    await assert.rejects(store.saveDraft(topic.id, 'x', input), failure('invalid-input'))
    assert.equal(await readFile(join(dataDir, 'workspace.json'), 'utf8'), original)
  }
  for (const [target, body] of [
    ['weixin-video', { kind: 'weixin-video', voiceover: 'text', shots: [] }],
    ['xiaohongshu', { kind: 'xiaohongshu', title: 'title', body: 'body', cards: [] }],
  ]) await assert.rejects(save(target, body), failure('invalid-input'))
})

test('legacy version-1 bytes remain readable but require structured save and a new review', async t => {
  const { store, topic, dataDir, exportRoot } = await fixture(t)
  const file = join(dataDir, 'workspace.json'), workspace = JSON.parse(await readFile(file, 'utf8'))
  const content = 'Legacy artifact', contentHash = createHash('sha256').update(content).digest('hex')
  workspace.topics[0].drafts.x = { content, contentHash, revision: 1, updatedAt: new Date().toISOString(), status: 'complete', review: { status: 'passed', contentHash, findings: [], reviewedAt: new Date().toISOString() } }
  await writeFile(file, JSON.stringify(workspace))
  const sheet = await store.readEvidence(topic.id)
  assert.equal(sheet.drafts.x.content, content)
  assert.equal(sheet.drafts.x.review.status, 'pending')
  const reviewed = await store.reviewDraft(topic.id, 'x', 1)
  assert.equal(reviewed.review.status, 'failed')
  assert.ok(reviewed.review.findings.some(f => f.code === 'legacy-shape'))
  assert.equal((await store.requestExport(topic.id, 'x', 'text', exportRoot)).reviewPassed, false)
})


test('snapshot rename failure preserves a reviewed completed draft and cleans up the retry', async t => {
  const { store, topic, dataDir, save } = await fixture(t)
  const draft = await save('x', { kind: 'x-single', post: 'AI 生成：Synthetic run took 12 ms' })
  await store.reviewDraft(topic.id, 'x', draft.revision)
  const file = join(dataDir, 'workspace.json'), original = await readFile(file, 'utf8')
  const input = draftInput(await store.readEvidence(topic.id), 'x', { kind: 'x-single', post: 'AI 生成：Edited fixture' }, draft.claimIds)
  const mocked = t.mock.method(promises, 'rename', async () => { throw Object.assign(new Error('Synthetic disk failure'), { code: 'EIO' }) })
  syncBuiltinESMExports()
  try { await assert.rejects(store.saveDraft(topic.id, 'x', input), { code: 'EIO' }) }
  finally { mocked.mock.restore(); syncBuiltinESMExports() }
  assert.equal(await readFile(file, 'utf8'), original)
  assert.deepEqual(await readdir(dataDir), ['workspace.json'])
  assert.equal((await store.readEvidence(topic.id)).drafts.x.review.status, 'passed')
  assert.equal((await store.saveDraft(topic.id, 'x', input)).revision, draft.revision + 1)
})


test('corrupt structured draft hashes, references and review findings are refused without overwriting', async t => {
  const { store, topic, dataDir, save } = await fixture(t)
  await save('x', { kind: 'x-single', post: 'AI 生成：Synthetic run took 12 ms' })
  await store.reviewDraft(topic.id, 'x', 1)
  const file = join(dataDir, 'workspace.json'), original = await readFile(file, 'utf8')
  for (const corrupt of [
    draft => { draft.body.post = 'Tampered copy' },
    draft => { draft.claimIds = ['bad'] },
    draft => { delete draft.evidenceHash },
    draft => { draft.review.findings = [{ code: 'unknown', location: 'post', excerpt: '', fix: 'fix' }] },
  ]) {
    const workspace = JSON.parse(original)
    corrupt(workspace.topics[0].drafts.x)
    const bytes = JSON.stringify(workspace)
    await writeFile(file, bytes)
    await assert.rejects(store.createTopic('Cannot overwrite corruption'), failure('corrupt-store'))
    assert.equal(await readFile(file, 'utf8'), bytes)
  }
  await writeFile(file, original)
})
