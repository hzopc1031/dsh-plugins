import assert from 'node:assert/strict'
import test from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { CommandRuntime } from '@deepseek-ai/dsh-commands'
import * as plugin from '../index.js'

test('public entry exposes the help-only Cordis plugin', () => {
  assert.equal(plugin.name, 'html-deck-export')
  assert.deepEqual(plugin.inject, ['commands'])
  assert.equal(typeof plugin.apply, 'function')
  assert.deepEqual(plugin.Config({}), {})
})

test('plugin loads with real commands and unregisters on disposal', async () => {
  const ctx = new Context()
  try {
    await ctx.plugin(CommandRuntime)
    const fork = ctx.plugin(plugin, {})
    await fork
    const command = ctx.commands.find(undefined, 'html-deck-export')
    assert.ok(command, 'help command registered')
    const result = await command.handler({ rawInput: '', attachments: [], signal: new AbortController().signal })
    assert.equal(result.kind, 'success')
    assert.match(result.text, /not implemented yet/)
    assert.match(result.text, /image-based 16:9 PPTX/)
    assert.match(result.text, /HTML remains the source of truth/)
    assert.match(result.text, /No deck generation, editable shapes, or preserved animations/)
    assert.match(result.text, /Nothing is uploaded automatically/)
    assert.match(result.text, /导出尚未实现/)
    await fork.dispose()
    assert.equal(ctx.commands.find(undefined, 'html-deck-export'), undefined)
  } finally {
    await ctx.fiber.dispose()
  }
})
