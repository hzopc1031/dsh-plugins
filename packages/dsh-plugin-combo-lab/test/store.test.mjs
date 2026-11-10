import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Store } from '../lib/store.js'
import { study, add, now, ID } from './fixtures.mjs'
async function fixture(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'combo-store-'))
  try { await fn(new Store(root), root) } finally { await rm(root, { recursive: true, force: true }) }
}
test('计划原子更新，重建 Store 后恢复证据，无残留临时文件', () => fixture(async (store, root) => {
  await store.save(study(), true)
  await assert.rejects(store.save(study(), true))
  const updated = add(study(), 'a')
  await store.save(updated)
  assert.deepEqual(await new Store(root).load(ID), updated)
  assert.deepEqual(await readdir(root), ['study-' + ID + '.json'])
}))
test('独立快照保留升级前结果，后续记录不改变它', () => fixture(async store => {
  const s = add(study(), 'a')
  const frozen = await store.freeze(s, '升级前', now)
  await store.save(add(s, 'a', 'fail'), true)
  const restored = await store.snapshot(frozen.id)
  assert.deepEqual(restored, frozen)
  assert.equal(restored.study.observations[0].outcome, 'pass')
  assert.equal((await store.load(ID)).observations.at(-1).outcome, 'fail')
}))
test('拒绝路径穿越与错误存档 ID', () => fixture(async (store, root) => {
  await assert.rejects(store.load('../package'))
  await assert.rejects(store.snapshot('C:\\Windows'))
  const value = study(); value.plan.id = '22222222-2222-4222-8222-222222222222'
  await writeFile(path.join(root, 'study-' + ID + '.json'), JSON.stringify(value))
  await assert.rejects(store.load(ID))
}))
test('损坏 JSON、计划和快照不会悄悄回退为空记录', () => fixture(async (store, root) => {
  const file = path.join(root, 'study-' + ID + '.json')
  await writeFile(file, 'broken')
  await assert.rejects(store.load(ID))
  await writeFile(file, JSON.stringify({ schemaVersion: 1, plan: {}, observations: [] }))
  await assert.rejects(store.load(ID))
  const frozen = await store.freeze(study(), 'before', now)
  const target = path.join(root, 'snapshot-' + frozen.id + '.json')
  const data = JSON.parse(await readFile(target, 'utf8')); data.id = ID
  await writeFile(target, JSON.stringify(data))
  await assert.rejects(store.snapshot(frozen.id))
}))
test('拒绝超限证据存档', () => fixture(async (store, root) => {
  await writeFile(path.join(root, 'study-' + ID + '.json'), ' '.repeat(8 * 1024 * 1024 + 1))
  await assert.rejects(store.load(ID), /8 MiB/)
}))
test('对照报告独立落盘并引用前后快照，拒绝时间倒序', () => fixture(async (store, root) => {
  const before = await store.freeze(add(study(), 'a'), 'before', now)
  const after = await store.freeze(add(study(), 'a', 'fail'), 'after', '2026-11-10T04:01:00.000Z')
  const result = await store.saveComparison(before, after, '2026-11-10T04:02:00.000Z')
  const persisted = JSON.parse(await readFile(path.join(root, 'comparison-' + result.id + '.json'), 'utf8'))
  assert.deepEqual(persisted, result)
  assert.equal(persisted.before.id, before.id)
  assert.equal(persisted.after.id, after.id)
  assert.equal(persisted.result.rows.find(x => x.stepId === 'a:input.commands').change, 'regression')
  await assert.rejects(store.saveComparison(after, before, now), /顺序/)
}))