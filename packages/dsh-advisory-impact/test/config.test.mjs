import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { parseSettings, loadSettings, saveSettings, DEFAULT_WATCH, PIN_FILE, Config } from '../index.js'
import { readLocal, writeLocal } from '../lib/local.js'
import './fixture-http.mjs'

async function temp(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'advisory-pins-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

test('config has a configurable watch list and no implicit product version', () => {
  assert.deepEqual(parseSettings().watch, DEFAULT_WATCH)
  assert.deepEqual(parseSettings().pins, [])
  assert.ok(Config)
  const pins = [{ project: 'kafka', version: '3.7.0', maven: 'org.apache.kafka:kafka-clients' }]
  const result = parseSettings({ watch: ['kafka', 'custom-project'], pins })
  assert.deepEqual(result.watch, ['kafka', 'custom-project'])
  assert.deepEqual(result.pins, pins)
  result.pins[0].version = 'changed'
  assert.equal(pins[0].version, '3.7.0')
  for (const invalid of [null, [], { watch: null }, { pins: null }, { cacheTtlMs: null }, { watch: ['kafka', 'kafka'] },
    { watch: ['../escape'] }, { pins: [{ project: 'kafka', version: '' }] }, { cacheTtlMs: -1 }, { cacheTtlMs: 1.5 },
    { pins: [{ project: 'kafka', version: '3.7.0', maven: 'org.apache.kafka:kafka-clients@3.7.0' }] }, { typo: [] }]) {
    assert.throws(() => parseSettings(invalid))
  }
})

test('pin file watch/pin edits are read on each evaluation; partial file fields override config', async t => {
  const dir = await temp(t)
  const config = { watch: ['kafka'], pins: [{ project: 'kafka', version: '3.7.0' }], cacheTtlMs: 1000 }
  assert.deepEqual(await loadSettings(config, dir), parseSettings(config))
  await assert.rejects(loadSettings(config, path.join(dir, 'missing-project')), { code: 'ENOENT' })
  await saveSettings(dir, config)
  assert.deepEqual(await loadSettings({}, dir), parseSettings(config))
  await writeFile(path.join(dir, PIN_FILE), JSON.stringify({ watch: ['hadoop'], pins: [{ project: 'hadoop', version: '3.3.6' }] }))
  const next = await loadSettings(config, dir)
  assert.deepEqual(next.watch, ['hadoop'])
  assert.deepEqual(next.pins, [{ project: 'hadoop', version: '3.3.6' }])
  assert.equal(next.cacheTtlMs, 1000)
  await saveSettings(dir, { watch: [], pins: [] })
  assert.deepEqual((await loadSettings(config, dir)).watch, [])
  await assert.rejects(saveSettings(dir, { pins: Array.from({ length: 200 }, () => ({ project: 'kafka', version: '1'.repeat(200), component: 'a'.repeat(200) })) }), /64 KiB/)
  assert.deepEqual((await loadSettings(config, dir)).watch, [])
  await writeFile(path.join(dir, PIN_FILE), '{broken')
  await assert.rejects(loadSettings({}, dir), SyntaxError)
  await assert.rejects(saveSettings(dir, config), SyntaxError)
  assert.equal(await readFile(path.join(dir, PIN_FILE), 'utf8'), '{broken')
})

test('pin/cache file paths reject traversal and symlinks, preserving outside files', async t => {
  const dir = await temp(t)
  const project = path.join(dir, 'project'), outside = path.join(dir, 'outside')
  await mkdir(project); await mkdir(outside)
  const victim = path.join(outside, 'pins.json')
  await writeFile(victim, '{}')
  await symlink(victim, path.join(project, PIN_FILE))
  await assert.rejects(loadSettings({}, project))
  await assert.rejects(saveSettings(project, {}))
  assert.equal(await readFile(victim, 'utf8'), '{}')
  await symlink(outside, path.join(project, 'linked'))
  for (const dirPath of [path.join(project, 'linked'), `${project}/../outside`, 'relative']) {
    await assert.rejects(writeLocal(dirPath, 'cache.json', '{}', true))
  }
  for (const name of ['../pins.json', '/pins.json', 'nested/pins.json', '..']) {
    await assert.rejects(writeLocal(project, name, '{}'))
    await assert.rejects(readLocal(project, name, 100))
  }
  await writeLocal(project, 'small.json', '12345')
  await assert.rejects(readLocal(project, 'small.json', 4), /大小限制/)
  assert.equal(await readLocal(project, 'small.json', 5), '12345')
  await mkdir(path.join(project, 'not-a-file'))
  await assert.rejects(readLocal(project, 'not-a-file', 10), /普通文件/)
})
