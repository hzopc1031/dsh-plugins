import test from 'node:test'
import assert from 'node:assert/strict'
import { Context, Commands, mountTools } from './harness.mjs'
import { remoteMethods, remoteErrorOf } from '@deepseek-ai/dsh-typert-protocol'
import * as plugin from '../index.js'

test('bundle loads with the command service and removes its help command on disposal', async () => {
  assert.equal(plugin.name, 'content-evidence')
  assert.deepEqual(plugin.inject, ['commands', 'tools'])
  assert.deepEqual(plugin.Config({}), { extraSensitiveTerms: [] })
  const ctx = new Context()
  try {
    await ctx.plugin(Commands)
    await mountTools(ctx)
    const fiber = await ctx.plugin(plugin, {})
    assert.equal(ctx.contentEvidence.typertRemote.serviceKey, 'contentEvidence')
    assert.equal(ctx.contentEvidence.typertRemote.namespace, 'contentEvidence')
    assert.deepEqual(remoteMethods(ctx.contentEvidence).map(marker => marker.method), [
      'listTopics', 'createTopic', 'readEvidence', 'addSource', 'captureMaterial',
      'readMaterial', 'logExperiment', 'saveClaim', 'saveDraft', 'reviewDraft', 'backfillPublishedLink', 'requestExport',
    ])
    const signal = new AbortController().signal
    await assert.rejects(ctx.contentEvidence.readEvidence('../escape', signal), error => remoteErrorOf(error)?.code === 'content-evidence/invalid-input')
    const agent = { ctx }
    assert.deepEqual(ctx.commands.list(agent).map(c => c.name), ['content-evidence'])
    const command = ctx.commands.find(agent, 'content-evidence')
    assert.equal(command.recordInput, false)
    const result = await command.handler({ agent, rawInput: '', signal: new AbortController().signal })
    assert.equal(result.kind, 'success')
    assert.match(result.text, /local storage/)
    assert.match(result.text, /Nothing is published automatically/)
    assert.match(result.text, /不会自动发布/)
    await fiber.dispose()
    assert.deepEqual(ctx.commands.list(agent), [])
    assert.equal(ctx.get('contentEvidence'), undefined)
    assert.deepEqual(ctx.tools.schemas().map(tool => tool.name), [])
  } finally {
    await ctx.fiber.dispose()
  }
})
