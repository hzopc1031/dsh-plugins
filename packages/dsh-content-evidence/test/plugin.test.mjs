import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import Commands from '@deepseek-ai/dsh-commands'
import * as plugin from '../index.js'

test('bundle loads with the command service and removes its help command on disposal', async () => {
  assert.equal(plugin.name, 'content-evidence')
  assert.deepEqual(plugin.inject, ['commands'])
  assert.deepEqual(plugin.Config({}), {})
  const ctx = new Context()
  try {
    await ctx.plugin(Commands)
    const fiber = await ctx.plugin(plugin, {})
    const agent = { ctx }
    assert.deepEqual(ctx.commands.list(agent).map(c => c.name), ['content-evidence'])
    const command = ctx.commands.find(agent, 'content-evidence')
    assert.equal(command.recordInput, false)
    const result = await command.handler({ rawInput: '', signal: new AbortController().signal })
    assert.equal(result.kind, 'success')
    assert.match(result.text, /scaffold/)
    assert.match(result.text, /Nothing is published automatically/)
    assert.match(result.text, /不会自动发布/)
    await fiber.dispose()
    assert.deepEqual(ctx.commands.list(agent), [])
  } finally {
    await ctx.fiber.dispose()
  }
})
