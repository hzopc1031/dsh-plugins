import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import * as host from '../index.js'

test('host injects commands; actual Cordis loads/registers/unloads with no screen capture', async () => {
  assert.deepEqual(host.inject, ['commands'])
  const ctx = new Context()
  let definition, removed = false
  ctx.provide('commands')
  ctx.set('commands', { register(row) { definition = row; return () => { removed = true } } })
  const fiber = ctx.plugin(host)
  await fiber
  try {
    assert.equal(definition.name, 'screenshot')
    assert.equal(definition.recordInput, false)
    assert.equal(definition.handler({ rawInput: ' unwanted' }).kind, 'error')
    assert.equal(typeof definition.definitionId, 'string')
  } finally { await fiber.dispose() }
  assert.equal(removed, true)
})
