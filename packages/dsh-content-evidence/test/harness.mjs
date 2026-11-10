import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as plugin from '../index.js'

// An explicit installed Host path also exercises 0.2.2's split native executor.
const host = createRequire(process.env.DSH_TEST_HOST || import.meta.url)
export const { Context } = host('@deepseek-ai/cordis')
export const { default: Commands } = host('@deepseek-ai/dsh-commands')
export const { default: Tools, defineTool } = host('@deepseek-ai/dsh-tools')
export const { default: SystemPrompt } = host('@deepseek-ai/dsh-system-prompt')
const { createScope } = host('@deepseek-ai/dsh-scope')

export async function agentScope(ctx, key, options) {
  let scope
  await ctx.plugin(Object.assign(inner => { scope = createScope(inner, key, options) }, { inject: ['tools'] }))
  return scope
}

export async function mountTools(ctx) {
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(Tools)
  if (typeof ctx.tools.setExecutor === 'function') {
    await ctx.plugin(host('@deepseek-ai/dsh-tool-executor-native'))
  }
}

export async function harness(t) {
  const dataDir = await mkdtemp(join(tmpdir(), 'content-evidence-tools-'))
  const ctx = new Context()
  t.after(async () => { await ctx.fiber.dispose(); await rm(dataDir, { recursive: true, force: true }) })
  await ctx.plugin(Commands)
  await mountTools(ctx)
  const fiber = await ctx.plugin(plugin, { dataDir })
  const agent = { status: 'idle' }
  const scope = await agentScope(ctx, agent)
  agent.ctx = scope.ctx
  const signal = new AbortController().signal
  const topic = await ctx.contentEvidence.createTopic('Tool fixture', signal)
  const run = async (name, args, owner = agent, callSignal = signal) => {
    const input = { name, arguments: args, agent: owner, signal: callSignal, callId: randomUUID() }
    if (typeof ctx.tools.setExecutor !== 'function') return ctx.tools.execute(input)
    const batch = await ctx.tools.execute({
      agent: owner, signal: callSignal,
      calls: [{ type: 'tool-call', id: input.callId, name, arguments: JSON.stringify(args) }],
    })
    return batch.results[0].result
  }
  const command = rawInput => ctx.commands.find(agent, 'content-evidence').handler({ agent, rawInput, signal })
  return { ctx, fiber, dataDir, agent, scope, signal, topic, run, command }
}
