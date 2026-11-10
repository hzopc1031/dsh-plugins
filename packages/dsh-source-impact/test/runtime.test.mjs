import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import os from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import { Context } from '@deepseek-ai/cordis'
import Commands from '@deepseek-ai/dsh-commands'
import Tools from '@deepseek-ai/dsh-tools'
import * as plugin from '../index.js'

test('rc.5 real Cordis registries load, dispatch command/tool and unload without any profile', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-impact-runtime-'))
  const ctx = new Context(), events = []
  const prompt = ctx.provide('systemPrompt', { tools() {} })
  const commands = ctx.plugin(Commands)
  await commands
  const tools = ctx.plugin(Tools)
  await tools
  const scope = ctx.plugin(plugin)
  try {
    await scope
    const agent = { session: { header: { cwd: root }, append(type, data) { events.push({ type, data }); return events.length } } }
    const signal = new AbortController().signal
    assert.equal(ctx.commands.list(agent)[0].name, 'impact')
    assert.equal(ctx.tools.schemas(agent)[0].name, 'source_impact_check')
    const command = await ctx.commands.execute(agent, '/impact check', [], signal)
    assert.equal(command.result.kind, 'success')
    assert.match(command.result.text, /已登记 0 条/)
    assert.deepEqual(events.map(e => e.type), ['command/run', 'command/done'])
    const result = await ctx.tools.execute({ callId: 'impact-test', name: 'source_impact_check', arguments: {}, agent, signal })
    assert.equal(result.isError, false)
    assert.equal(JSON.parse(result.value).impacts.length, 0)
    await scope.dispose()
    assert.equal(ctx.commands.find(agent, 'impact'), undefined)
    assert.equal(ctx.tools.get('source_impact_check'), undefined)
  } finally {
    await scope.dispose(); await tools.dispose(); await commands.dispose(); await prompt()
    await rm(root, { recursive: true, force: true })
  }
})
