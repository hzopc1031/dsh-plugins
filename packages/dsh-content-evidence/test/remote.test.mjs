import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context, Commands, mountTools } from './harness.mjs'
import { remoteErrorOf, remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import * as plugin from '../index.js'
import remote from '../lib/typert.remote-client.js'
import { TYPERT } from '../lib/typert.host.js'

test('generated Host and client contracts agree with the registered service and validate records', async t => {
  const dataDir = await mkdtemp(join(tmpdir(), 'content-evidence-remote-'))
  const ctx = new Context()
  t.after(async () => { await ctx.fiber.dispose(); await rm(dataDir, { recursive: true, force: true }) })
  await ctx.plugin(Commands)
  await mountTools(ctx)
  await ctx.plugin(plugin, { dataDir })
  const service = ctx.contentEvidence
  const endpoints = remoteMethods(service).map(item => `contentEvidence/${item.method}`).sort()
  assert.deepEqual(Object.keys(remote.methods).sort(), endpoints)
  assert.deepEqual(TYPERT.invocations.map(item => `${item.namespace}/${item.method}`).sort(), endpoints)
  assert.ok(endpoints.every(endpoint => !/\/(?:publish|post|login)/.test(endpoint)))
  const signal = new AbortController().signal
  const invoke = async (method, args) => {
    const descriptor = remote.methods[`contentEvidence/${method}`]
    const parsed = descriptor.input({ strict: true }).create().parse(args)
    const host = TYPERT.invocations.find(item => item.id === descriptor.id)
    assert.equal(host.service, 'contentEvidence')
    const values = host.parameters.map(item => parsed[item.wire])
    const result = await ctx[host.service][host.implementation ?? host.method](...values, signal)
    return descriptor.result.create().parse(result)
  }
  const topic = await invoke('createTopic', { idea: 'Remote fixture' })
  await invoke('saveClaim', { topicId: topic.id, claimText: 'Unsourced fixture', sourceId: null })
  const source = await invoke('addSource', { topicId: topic.id, sourceUrl: 'https://example.com/fixture', title: '' })
  await invoke('captureMaterial', { topicId: topic.id, input: { name: 'fixture.txt', mediaType: 'text/plain', base64: 'Zml4dHVyZQ==', sourceId: source.id } })
  const loaded = await invoke('readEvidence', { topicId: topic.id })
  assert.equal(loaded.claims[0].status, '待核实')
  assert.equal(loaded.materials.length, 1)
  assert.equal((await invoke('listTopics', {})).length, 1)
  assert.throws(() => remote.methods['contentEvidence/createTopic'].input().create().parse({ idea: 'fixture', extra: true }))
  assert.throws(() => remote.methods['contentEvidence/captureMaterial'].input({ strict: true }).create().parse({ topicId: topic.id, input: { name: 'fixture', base64: '', sourceId: null } }))
  await assert.rejects(invoke('readEvidence', { topicId: '00000000-0000-4000-8000-000000000000' }), error => {
    const failure = remoteErrorOf(error)
    assert.equal(failure.code, 'content-evidence/not-found')
    assert.equal(failure.details.topicId, '00000000-0000-4000-8000-000000000000')
    return true
  })
})
